// 同一表达式 xmmath 与 typst 各渲一张 PNG，拼成一张并排对照图（左 = xmmath，
// 右 = typst 官方），并打印双方尺寸。给 AI/人眼直接看差异用。
//
//   pnpm cmp --expr 'sum^x_y gcd^x_y'              块级（默认）
//   pnpm cmp --expr 'sum_(i=1)^n i' --inline       行内
//   pnpm cmp --id display-1                        从语料取式子和 block/inline 模式
//   pnpm cmp --id display-1 --out /tmp/x.png --dpi 200 --typst v0.15.1 --json
//
// typst 版本与 dpi 默认取 test/review/config.json（与 review 页同基准，默认 0.11.1）；
// `--typst system` 用本机/环境变量的 typst。两侧中间留 16px 白缝 + 1px 灰分隔线，
// 上缘对齐（两边都是 6pt margin 的内容框，firefox 多出来的窗口余量只在下/右侧）。
// 中间产物（两侧单独的 PNG）与合成图落在同一目录，便于单独取用。
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyCase } from "../test/fixtures/case.mjs";
import { render as renderXmmath, closeXmmath } from "../test/xmmath/render.mjs";
import { render as renderTypst } from "../test/typst/render.mjs";
import { composite, decodePng, encodePng, vline, whiteCanvas } from "./png.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_ROOT =
	process.env.XMMATH_RENDER_CACHE ||
	join(homedir(), ".cache", "xmmath", "render");

const HELP = `cmp -> 并排对照图（左 xmmath | 右 typst 官方）

  --expr <str>    数学表达式（与 --id 二选一）
  --id <cid>      用 test/fixtures/math.json 里 <cid> 的文字与 block/inline 模式
  --inline        行内模式（--id 时默认取语料例的模式，显式 flag 覆盖）
  --block         块级模式
  --out <path>    合成图路径（默认 <cache>/cmp-<n>.png；两侧单图同目录同名前缀）
  --dpi <n>       两边统一的渲染 dpi（默认取 review config 的 dpi）
  --typst <ver>   typst 版本（默认取 review config；system = 本机/环境变量的 typst）
  --json          机器可读输出
  -h, --help      本帮助`;

function parseArgs(argv) {
	const o = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => argv[++i];
		switch (a) {
			case "--expr":
				o.expr = next();
				break;
			case "--id":
				o.id = next();
				break;
			case "--inline":
				o.inline = true;
				break;
			case "--block":
				o.block = true;
				break;
			case "--out":
				o.out = next();
				break;
			case "--dpi":
				o.dpi = Number(next());
				break;
			case "--typst":
				o.typst = next();
				break;
			case "--json":
				o.json = true;
				break;
			case "-h":
			case "--help":
				o.help = true;
				break;
			default:
				throw new Error(`未知参数: ${a}`);
		}
	}
	return o;
}

function reviewConfig() {
	try {
		return JSON.parse(readFileSync(join(ROOT, "test", "review", "config.json"), "utf8"));
	} catch {
		return {};
	}
}

export async function cmp(argv = process.argv.slice(2)) {
	let opts;
	try {
		opts = parseArgs(argv);
	} catch (e) {
		return { ok: false, error: e.message, help: HELP };
	}
	if (opts.help) return { ok: true, help: HELP };

	// 来源与模式：--id 走语料（applyCase 处理互斥与模式继承），--expr 默认块级
	const applied = applyCase(opts);
	if (applied && !applied.ok) return { ok: false, error: applied.error, help: HELP };
	if (opts.expr == null)
		return { ok: false, error: "need --expr <math source> or --id <corpus id>", help: HELP };
	if (opts.inline && opts.block)
		return { ok: false, error: "--inline 与 --block 互斥" };
	const expr = opts.expr;
	const inline = !!opts.inline;

	const cfg = reviewConfig();
	const dpi = Number.isFinite(opts.dpi) ? opts.dpi : Number(cfg.dpi) || 150;
	const typstVer =
		opts.typst !== undefined ? opts.typst : cfg.typst || undefined; // undefined = 系统 typst

	// 输出路径：默认 <cache>/cmp-<n>.png，两侧单图同前缀
	const name = opts.id || `${createHash("sha1").update(expr).digest("hex").slice(0, 8)}`;
	const out = opts.out || join(CACHE_ROOT, `cmp-${name}.png`);
	const stem = out.slice(0, out.length - extname(out).length);
	const xPng = `${stem}.xmmath.png`;
	const tPng = `${stem}.typst.png`;

	// 右侧：typst 官方渲染
	const tArgs = ["--expr", expr, "--out", tPng, "--dpi", String(dpi)];
	if (inline) tArgs.push("--inline");
	if (typstVer && typstVer !== "system") tArgs.push("--typst", typstVer);
	let trep;
	try {
		trep = await renderTypst(tArgs);
	} catch (e) {
		return { ok: false, error: `typst render 抛错: ${e?.message || e}` };
	}
	if (!trep.ok || !trep.png)
		return {
			ok: false,
			error: `typst 渲染失败（exit=${trep.exitCode ?? "?"}）`,
			typst: trep,
		};

	// 左侧：xmmath 本库渲染（vite 起在后台，收尾要 close，否则进程不退）
	let xrep;
	try {
		xrep = await renderXmmath(["--expr", expr, "--out", xPng, "--dpi", String(dpi), ...(inline ? ["--inline"] : [])]);
	} catch (e) {
		return { ok: false, error: `xmmath render 抛错: ${e?.message || e}` };
	} finally {
		await closeXmmath();
	}
	if (!xrep.ok || !xrep.png)
		return { ok: false, error: "xmmath 渲染失败", xmmath: xrep };

	// 拼图：上缘对齐、16px 白缝、中缝 1px 灰线
	const left = decodePng(readFileSync(xPng));
	const right = decodePng(readFileSync(tPng));
	const gap = 16;
	const w = left.width + gap + right.width;
	const h = Math.max(left.height, right.height);
	const canvas = whiteCanvas(w, h);
	composite(canvas, left, 0, 0);
	composite(canvas, right, left.width + gap, 0);
	vline(canvas, left.width + Math.floor(gap / 2));
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, encodePng(canvas));

	const report = {
		ok: true,
		expr,
		inline,
		caseId: opts.caseId ?? null,
		dpi,
		typst: {
			png: trep.png,
			width: trep.width,
			height: trep.height,
			version: trep.version,
			pinned: trep.pinned,
		},
		xmmath: {
			png: xrep.png,
			width: xrep.width,
			height: xrep.height,
			layout: xrep.layout ?? null,
		},
		combined: { png: out, width: w, height: h, left: "xmmath", right: "typst" },
	};
	return report;
}

function printHuman(rep) {
	if (rep.help) return console.log(rep.help);
	if (!rep.ok) {
		console.error(`ERROR: ${rep.error}`);
		// typst 侧的诊断最有用（表达式被官方拒绝的原因）
		const d = rep.typst?.stderr || rep.typst?.error || rep.xmmath?.diagnostics;
		if (d && d !== "(none)") console.error(`--- diagnostics ---\n${d}`);
		return;
	}
	console.log(
		`xmmath: ${rep.xmmath.width}x${rep.xmmath.height} @${rep.dpi}dpi${rep.xmmath.layout ? ` (layout ${rep.xmmath.layout.width}x${rep.xmmath.layout.height})` : ""}  ${rep.xmmath.png}`,
	);
	console.log(
		`typst:  ${rep.typst.width}x${rep.typst.height} @${rep.dpi}dpi  (${rep.typst.version}${rep.typst.pinned ? ` ${rep.typst.pinned}` : ""})  ${rep.typst.png}`,
	);
	console.log(`合并:   ${rep.combined.width}x${rep.combined.height}  左=xmmath 右=typst  ${rep.combined.png}`);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	const rep = await cmp();
	if (rep.json || process.argv.slice(2).includes("--json")) console.log(JSON.stringify(rep, null, 2));
	else printHuman(rep);
	if (!rep.ok && !rep.help) process.exit(2);
}
