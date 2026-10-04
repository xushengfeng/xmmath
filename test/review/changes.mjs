// 快照变更提取：给出「旧预期 vs 本次实际输出」的用例清单，写 test/review/cache/changes.json
// 供 review 页「变更」标签使用，同时打印摘要给 AI/人直接读。
//
//   pnpm test                # 跑测试（顺带写出 cache/current.json = 本次实际输出）
//   pnpm review:changes      # 对比 git 基线
//   node test/review/changes.mjs --base v1.0.9
//   node test/review/changes.mjs --base ""        # 基线用暂存区（index）而非 HEAD
//   node test/review/changes.mjs --only root-01,mat-03
//   node test/review/changes.mjs --json
//
// 两种模式：
//   accepted —— 工作区 .snap 已与基线不同（跑过 -u），比较两个 .snap，diff 精确
//   pending  —— 测试失败但 .snap 未更新，比较基线 .snap 与 current.json，
//               即「尚未被接受的新输出」，确认后 pnpm snap:update
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const SNAP_REL = "test/corpus/__snapshots__/math.test.ts.snap";
const CURRENT = join(here, "cache/current.json");
const OUT = join(here, "cache/changes.json");

const argv = process.argv.slice(2);
const opt = { base: "HEAD", only: null, json: false };
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === "--base") opt.base = argv[++i];
	else if (a === "--only")
		opt.only = argv[++i]
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	else if (a === "--json") opt.json = true;
	else if (a === "-h" || a === "--help") {
		console.log(
			"用法: changes.mjs [--base <ref>] [--only id1,id2] [--json]\n默认对比 HEAD，结果写入 test/review/cache/changes.json",
		);
		process.exit(0);
	}
}

// 与 pretty-format 一致：对象键按字母序
function sortKeys(_k, v) {
	if (v && typeof v === "object" && !Array.isArray(v))
		return Object.fromEntries(
			Object.keys(v)
				.sort()
				.map((k) => [k, v[k]]),
		);
	return v;
}

// ---- vitest .snap 解析 ----
// 格式：exports[`corpus/<cat> > <id> <n>`] = `\n<body>\n`;\n
function parseSnap(text) {
	const out = new Map();
	if (!text) return out;
	const re = /exports\[`(.+?)`\] = `\n([\s\S]*?)\n`;\n/g;
	let m = re.exec(text);
	while (m) {
		const body = m[2].replace(/\\`/g, "`").replace(/\\\$\{/g, "${");
		const idm = m[1].match(/>\s*([A-Za-z0-9][A-Za-z0-9-]*)\s+\d+$/);
		if (idm)
			out.set(idm[1], {
				cat: m[1]
					.split(">")[0]
					.trim()
					.replace(/^corpus\//, ""),
				body,
			});
		m = re.exec(text);
	}
	return out;
}

// 快照体不是合法 JSON（pretty-format 不转义字符串内的引号），按行取单行字段
function field(body, key) {
	const m = body.match(new RegExp(`^  "${key}": "(.*)",?$`, "m"));
	return m ? m[1] : null;
}

function snapEntry(e) {
	return e
		? {
				cat: e.cat,
				body: e.body,
				html: field(e.body, "html"),
				error: field(e.body, "error"),
			}
		: null;
}

function gitShow(ref, relPath) {
	const r = spawnSync("git", ["show", `${ref}:${relPath}`], {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	return r.status === 0 ? r.stdout : null;
}

const baseline = parseSnap(gitShow(opt.base, SNAP_REL));
const worktree = parseSnap(
	existsSync(join(root, SNAP_REL))
		? readFileSync(join(root, SNAP_REL), "utf8")
		: "",
);
let actual = null;
try {
	actual = JSON.parse(readFileSync(CURRENT, "utf8")).cases || {};
} catch {
	actual = null;
}

// 工作区 .snap 与基线不同 → 已接受预期；否则用本次实际输出（尚未接受）
const acceptedDiffers = [
	...new Set([...baseline.keys(), ...worktree.keys()]),
].some((id) => baseline.get(id)?.body !== worktree.get(id)?.body);
const mode = !acceptedDiffers && actual ? "pending" : "accepted";

function nowEntry(id) {
	if (mode === "accepted") return snapEntry(worktree.get(id));
	const a = actual[id];
	if (!a) return null;
	return {
		cat: id.replace(/-\d+$/, ""),
		body: JSON.stringify(
			{
				block: a.block,
				error: a.error,
				html: a.html,
				text: a.text,
				vdom: a.vdom,
			},
			sortKeys,
			2,
		),
		html: a.html ?? null,
		error: a.error ?? null,
	};
}

const items = [];
let unchanged = 0;
const ids = [
	...new Set([
		...baseline.keys(),
		...Object.keys(actual || {}),
		...worktree.keys(),
	]),
].sort();
for (const id of ids) {
	const a = snapEntry(baseline.get(id));
	const b = nowEntry(id);
	const same = !!a && !!b && a.html === b.html && a.error === b.error;
	let status = !a ? "added" : !b ? "removed" : same ? "same" : "changed";
	if (status === "same") {
		unchanged++;
		if (!opt.only?.includes(id)) continue;
		status = "unchanged";
	} else if (opt.only && !opt.only.includes(id)) continue;
	items.push({
		id,
		cat: (b || a).cat,
		status,
		oldHtml: a ? a.html : null,
		newHtml: b ? b.html : null,
		oldError: a ? a.error : null,
		newError: b ? b.error : null,
		oldSnap: a ? a.body : null,
		newSnap: b ? b.body : null,
	});
}

const summary = {
	base: opt.base,
	mode,
	generatedAt: new Date().toISOString(),
	changed: items.filter((i) => i.status === "changed").length,
	added: items.filter((i) => i.status === "added").length,
	removed: items.filter((i) => i.status === "removed").length,
	unchanged,
};
const payload = { summary, items };

mkdirSync(dirname(OUT), { recursive: true });
const tmp = `${OUT}.tmp`;
writeFileSync(tmp, `${JSON.stringify(payload, null, "\t")}\n`);
renameSync(tmp, OUT);

if (opt.json) {
	console.log(JSON.stringify(payload, null, 2));
} else {
	const byCat = {};
	for (const i of items) byCat[i.cat] = (byCat[i.cat] || 0) + 1;
	console.log(
		`基线 ${opt.base} → ${mode === "pending" ? "本次实际输出（尚未写入快照）" : "已接受快照"}：变更 ${summary.changed}，新增 ${summary.added}，删除 ${summary.removed}，未变 ${summary.unchanged}`,
	);
	if (Object.keys(byCat).length)
		console.log(`按分类：${JSON.stringify(byCat)}`);
	for (const i of items.slice(0, 30)) {
		const old_ = i.oldError
			? `error: ${i.oldError}`
			: (i.oldHtml || "").slice(0, 90);
		const now_ = i.newError
			? `error: ${i.newError}`
			: (i.newHtml || "").slice(0, 90);
		console.log(`\n[${i.status}] ${i.id}\n  旧: ${old_}\n  新: ${now_}`);
	}
	if (items.length > 30)
		console.log(`\n…另有 ${items.length - 30} 条，见 ${OUT}`);
	console.log(`\n已写入 ${OUT}（review 页「变更」标签读取此文件）`);
}
