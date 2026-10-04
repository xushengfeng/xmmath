// 快照变更清单：对比 git 里的快照（默认 HEAD）与工作区的快照文件，
// 写 test/review/cache/changes.json 供 review 页「变更」标签使用，并打印摘要。
//
// 约定：改代码后测试变红就立刻 pnpm snap:update 并接受、提交快照，
// 于是 git 里那份永远是「上一次认可的预期」，这里只比 git vs 工作区。
//
//   pnpm review:changes                 # HEAD vs 工作区
//   node test/review/changes.mjs --base v1.0.9
//   node test/review/changes.mjs --base ""          # 基线取暂存区
//   node test/review/changes.mjs --only root-01,mat-03
//   node test/review/changes.mjs --json
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
const SNAP_ABS = join(root, SNAP_REL);
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
			"用法: changes.mjs [--base <ref>] [--only id1,id2] [--json]\n基线默认 HEAD，与工作区的 " +
				SNAP_REL +
				" 对比",
		);
		process.exit(0);
	}
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

// 快照体不是合法 JSON（pretty-format 不转义字符串内的引号），按行取单行字段。
// pretty-format 会把反斜杠转义成 \\，这里还原，否则含 `\` 的输出会被误报为变更。
function field(body, key) {
	const m = body.match(new RegExp(`^  "${key}": "(.*)",?$`, "m"));
	return m ? m[1].replace(/\\\\/g, "\\") : null;
}

function toEntry(e) {
	if (!e) return null;
	return {
		cat: e.cat,
		body: e.body,
		html: field(e.body, "html"),
		error: field(e.body, "error"),
	};
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
	existsSync(SNAP_ABS) ? readFileSync(SNAP_ABS, "utf8") : "",
);

const items = [];
let unchanged = 0;
for (const id of [
	...new Set([...baseline.keys(), ...worktree.keys()]),
].sort()) {
	const a = toEntry(baseline.get(id));
	const b = toEntry(worktree.get(id));
	let status = !a
		? "added"
		: !b
			? "removed"
			: a.body !== b.body
				? "changed"
				: "same";
	if (status === "same") {
		unchanged++;
		if (!opt.only?.includes(id)) continue;
		status = "unchanged";
	} else if (opt.only && !opt.only.includes(id)) continue;
	items.push({
		id,
		cat: (b || a).cat,
		status,
		oldHtml: a?.html ?? null,
		newHtml: b?.html ?? null,
		oldError: a?.error ?? null,
		newError: b?.error ?? null,
		oldSnap: a?.body ?? null,
		newSnap: b?.body ?? null,
	});
}

const summary = {
	base: opt.base || "(暂存区)",
	generatedAt: new Date().toISOString(),
	baselineCases: baseline.size,
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

if (opt.json) console.log(JSON.stringify(payload, null, 2));
else {
	if (!baseline.size)
		console.log(
			`警告：基线 ${opt.base} 里没有 ${SNAP_REL}，全部会被算成新增。快照要先提交进 git 才有可比的历史。`,
		);
	const byCat = {};
	for (const i of items) byCat[i.cat] = (byCat[i.cat] || 0) + 1;
	console.log(
		`基线 ${summary.base} → 工作区：变更 ${summary.changed}，新增 ${summary.added}，删除 ${summary.removed}，未变 ${summary.unchanged}`,
	);
	if (Object.keys(byCat).length)
		console.log(`按分类：${JSON.stringify(byCat)}`);
	for (const i of items.slice(0, 30))
		console.log(
			`\n[${i.status}] ${i.id}\n  旧: ${(i.oldError ? `error: ${i.oldError}` : i.oldHtml) || ""}`.slice(
				0,
				200,
			) +
				`\n  新: ${(i.newError ? `error: ${i.newError}` : i.newHtml) || ""}`.slice(
					0,
					200,
				),
		);
	if (items.length > 30)
		console.log(`\n…另有 ${items.length - 30} 条，见 ${OUT}`);
	console.log(`\n已写入 ${OUT}（review 页「变更」标签读取此文件）`);
}
