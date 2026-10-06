// 全语料（或单例）的 MathML 文本 diff：git ref 版 vs 工作区，review 页「变更」标签的命令行版。
//
//   pnpm diff                       全语料，base=HEAD
//   pnpm diff --id display-1        只跑指定例（可重复，或逗号分隔）
//   pnpm diff --base v1.1.3         对比任意 git ref（src/ 导出后走 vite SSR 加载）
//   pnpm diff --verbose             打印每个差异的首个不同位置前后文
//   pnpm diff --expr 'sum_1^2'      单表达式（不经语料），block/inline 各跑一遍
//   pnpm diff --json                JSON 输出（不进 git，结果现算）
//
// 退出码默认恒 0（差异是常态，基线本来就有变化的例）；加 --exit-code 则有差异退出 1。
// base 的 src/ 导出到 test/review/cache/base/<sha>/（与 review 页 /__review/base 共用缓存）。
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "test", "review", "cache");

function git(args) {
	// show 的输出按 buffer 收，避免个别文件被当文本管道处理丢字节
	return execFileSync("git", args, {
		cwd: ROOT,
		maxBuffer: 64 * 1024 * 1024,
		encoding: args.includes("show") ? "buffer" : "utf8",
	});
}

// ---- 参数 ----
function parseArgs(argv) {
	const o = { ids: [], verbose: false, json: false, exitCode: false, base: "HEAD", expr: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--id") o.ids.push(...String(argv[++i] ?? "").split(",").filter(Boolean));
		else if (a === "--base") o.base = String(argv[++i] ?? "HEAD");
		else if (a === "--verbose" || a === "-v") o.verbose = true;
		else if (a === "--json") o.json = true;
		else if (a === "--exit-code") o.exitCode = true;
		else if (a === "--expr") o.expr = String(argv[++i] ?? "");
		else if (a === "--help" || a === "-h") o.help = true;
		else throw new Error(`未知参数: ${a}`);
	}
	return o;
}

const HELP = `用法: pnpm diff [--id <id>[,<id>…]] [--base <ref>] [--verbose] [--json] [--exit-code]
      pnpm diff --expr '<数学表达式>' [--verbose]

  --id         只跑语料中指定的用例（可重复 / 逗号分隔）
  --base       对比的 git ref，默认 HEAD
  --verbose    打印差异处的前后文（默认只列 id 与长度/首个不同位置）
  --json       机器可读输出
  --exit-code  有差异时退出码 1`;

// ---- 把 base ref 的 src/ 导出到缓存（与 review 页共用同一份） ----
function exportBaseSrc(ref) {
	const sha = git(["rev-parse", ref]).toString().trim();
	const dir = join(CACHE, "base", sha);
	if (!existsSync(join(dir, "src", "main.ts"))) {
		const files = git(["ls-tree", "-r", "--name-only", ref, "--", "src"])
			.toString()
			.split("\n")
			.filter(Boolean);
		if (!files.length) throw new Error(`${ref} 里没有 src/`);
		for (const rel of files) {
			const dest = join(dir, rel);
			mkdirSync(dirname(dest), { recursive: true });
			writeFileSync(dest, git(["show", `${ref}:${rel}`]));
		}
	}
	return { sha, dir };
}

// ---- vite SSR 加载一个 src/（base 是导出目录，work 是仓库根） ----
async function loadSrc(root) {
	const { createServer } = await import("vite");
	const server = await createServer({
		root,
		configFile: false,
		server: { middlewareMode: true, hmr: false },
		appType: "custom",
		logLevel: "silent",
	});
	const mod = await server.ssrLoadModule("/src/main.ts");
	return { server, mod };
}

// ---- 单例渲染（抛错也记录，knownBroken 例两边都抛算一致） ----
function render(mod, text, inline) {
	try {
		return { throw: null, html: mod.toMMLHTML(text, inline) };
	} catch (e) {
		return { throw: String(e?.message ?? e), html: null };
	}
}

// 首个不同位置 + 前后文；--verbose 才打印
function excerpt(a, b, i, pad = 48) {
	const lo = Math.max(0, i - pad);
	const cut = (s) => (s.length ? (lo > 0 ? "…" : "") + s.slice(lo, i + pad) + (i + pad < s.length ? "…" : "") : s);
	return `      base: ${cut(a)}\n      work: ${cut(b)}`;
}

function compare(a, b) {
	if (a.throw !== null || b.throw !== null) {
		if (a.throw === b.throw) return null; // 两边抛同样错：一致
		return { kind: "throw", first: -1 };
	}
	if (a.html === b.html) return null;
	// 首个不同位置（长度不同时在公共前缀末尾分叉）
	let i = 0;
	const n = Math.min(a.html.length, b.html.length);
	while (i < n && a.html[i] === b.html[i]) i++;
	return { kind: "text", first: i };
}

async function main() {
	let opts;
	try {
		opts = parseArgs(process.argv.slice(2));
	} catch (e) {
		console.error(e.message);
		process.exit(2);
	}
	if (opts.help) {
		console.log(HELP);
		return;
	}

	const { sha, dir } = exportBaseSrc(opts.base);
	const base = await loadSrc(dir);
	const work = await loadSrc(ROOT);

	// 语料（或单表达式）两边各渲染一遍，逐例比字符串
	let cases;
	if (opts.expr !== null) {
		cases = ["block", "inline"].map((m) => ({
			id: `${opts.expr} [${m}]`,
			block: m === "block",
			text: opts.expr,
		}));
	} else {
		const all = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "math.json"), "utf8")).cases;
		cases = opts.ids.length ? all.filter((c) => opts.ids.includes(c.id)) : all;
		if (opts.ids.length) {
			const missing = opts.ids.filter((id) => !cases.some((c) => c.id === id));
			if (missing.length) {
				console.error(`语料里没有: ${missing.join(", ")}`);
				process.exit(2);
			}
		}
	}

	const changed = [];
	let same = 0;
	const seen = new Set();
	for (const c of cases) {
		if (seen.has(c.id)) continue; // --id 重复指定去重
		seen.add(c.id);
		const inline = !c.block;
		const a = render(base.mod, c.text, inline);
		const b = render(work.mod, c.text, inline);
		const diff = compare(a, b);
		if (!diff) {
			same++;
			continue;
		}
		const la = a.html?.length ?? `THROW: ${a.throw}`;
		const lb = b.html?.length ?? `THROW: ${b.throw}`;
		changed.push({
			id: c.id,
			block: c.block,
			text: c.text,
			base: a,
			work: b,
			kind: diff.kind,
			first: diff.first,
			lenBase: typeof la === "number" ? la : String(la),
			lenWork: typeof lb === "number" ? lb : String(lb),
		});
	}

	await base.server.close();
	await work.server.close();

	const report = {
		base: opts.base,
		sha,
		dirty: git(["status", "--porcelain", "--", "src"]).toString().split("\n").filter(Boolean),
		total: seen.size,
		same,
		changed: changed.length,
		changedCases: changed,
	};

	if (opts.json) {
		console.log(JSON.stringify(report, null, "\t"));
	} else {
		console.log(`base=${opts.base}(${sha.slice(0, 7)}) dirty=${report.dirty.length ? "yes" : "no"}`);
		console.log(`cases=${report.total} same=${same} changed=${changed.length}`);
		for (const c of changed) {
			console.log(
				`  ${c.id} [${c.block ? "block" : "inline"}] ${c.kind === "throw" ? "throw差异" : `len ${c.lenBase}→${c.lenWork} first@+${c.first}`}`,
			);
		}
		if (opts.verbose) {
			for (const c of changed) {
				console.log(`--- ${c.id} [${c.block ? "block" : "inline"}]`);
				if (c.kind === "throw") {
					console.log(`      base: THROW: ${c.base.throw}\n      work: THROW: ${c.work.throw}`);
				} else {
					console.log(excerpt(c.base.html, c.work.html, c.first));
				}
			}
		}
	}
	if (opts.exitCode && changed.length) process.exit(1);
}

main().catch((e) => {
	console.error(e?.stack || e);
	process.exit(2);
});
