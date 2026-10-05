// Review 页的 dev 中间件（仅 vite serve 时挂载）。只做对照，不记录反馈。
// 提供：typst 官方渲染图（按 hash + typst 版本缓存，不进 git，ver 参数可指定旧版本做版本对比）、
// /base（把 git HEAD 版的 src/ 导出到 cache/base/<sha>/，网页动态 import 后与工作区版并排渲染）。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../typst/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const CACHE = join(here, "cache");
const INDEX = join(CACHE, "index.json");
const CONFIG_FILE = join(here, "config.json");

const MAX_TEXT = 8000;
const MAX_BATCH = 40;

function readJson(file, fallback) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return fallback;
	}
}
function writeJson(file, data) {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(data, null, "\t")}\n`);
	renameSync(tmp, file);
}
function sha256(s) {
	return createHash("sha256").update(s).digest("hex");
}
function slug(s) {
	return s.replace(/[^A-Za-z0-9._+-]+/g, "_");
}

// git 子进程：失败抛错，成功返回 stdout（/base 用它导出 HEAD 版 src/）
function git(args) {
	const r = spawnSync("git", args, {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (r.status !== 0)
		throw new Error(`git ${args.join(" ")} 失败：${(r.stderr || "").trim()}`);
	return r.stdout;
}

function config() {
	const c = readJson(CONFIG_FILE, {});
	return {
		// 默认与 src 的语言基线一致（version.lan），见 src/main.ts
		typst: String(c.typst || "0.11.1"),
		dpi: Number(c.dpi) || 150,
		bin: process.env.TYPST_BIN || c.bin || "",
	};
}

// 缓存键里的 typst 标识：指定 bin 时取其自报版本，否则取固定版本号
let labelCache = null;
function typstLabel(cfg) {
	if (labelCache) return labelCache;
	if (cfg.bin) {
		const r = spawnSync(cfg.bin, ["--version"], { encoding: "utf8" });
		labelCache =
			r.status === 0
				? `bin-${slug(r.stdout.trim().split("\n")[0])}`
				: `bin-${slug(cfg.bin)}`;
	} else {
		labelCache = `v${cfg.typst.replace(/^v/, "")}`;
	}
	return labelCache;
}

// typst 源码：块级用 `$ … $`，行内用 `$…$`（与快照的 toMMLV(text, !block) 对应）
// 页面设为 auto 尺寸，PNG 才是紧贴公式的裁切图（与 render.mjs --expr 一致）
function typstSource(text, block) {
	const math = block ? `$ ${text} $` : `$${text.trim()}$`;
	return `#set page(width: auto, height: auto, margin: 6pt)\n#set text(size: 14pt)\n${math}\n`;
}

// typst 版本标识：不传用 config（当前基准），传了就是对比用的旧版本
function typstVer(ver) {
	if (!ver) return null;
	const v = String(ver).trim();
	if (!/^v?\d+(\.\d+)*(-[\w.]+)?$/.test(v))
		throw new Error(`typst 版本号格式不对：${v}`);
	return `v${v.replace(/^v/, "")}`;
}

async function renderTypst(text, block, dpi, ver) {
	const cfg = config();
	const label = typstVer(ver) || typstLabel(cfg);
	const source = typstSource(text, block);
	const hash = sha256(`${label}|${dpi}|${source}`);
	const dir = join(CACHE, "typst", slug(label));
	const file = join(dir, `${hash}.png`);
	const index = readJson(INDEX, {});
	if (existsSync(file) && index[hash])
		return { hash, file, meta: index[hash], cached: true };

	mkdirSync(dir, { recursive: true });
	const args = [
		"--code",
		source,
		"--out",
		file,
		"--dpi",
		String(dpi),
		"--json",
	];
	if (ver) args.push("--typst", label);
	else if (cfg.bin) args.push("--bin", cfg.bin);
	else args.push("--typst", cfg.typst);
	const rep = await render(args);
	const meta = {
		label,
		version: rep.version || "",
		dpi,
		source,
		ok: !!rep.ok && !!rep.png,
		stderr: rep.stderr || "",
		error: rep.error || "",
		at: new Date().toISOString(),
	};
	index[hash] = meta;
	writeJson(INDEX, index);
	return { hash, file: rep.png || file, meta, cached: false };
}

function sendJson(res, code, data) {
	const body = JSON.stringify(data);
	res.statusCode = code;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Content-Length", Buffer.byteLength(body));
	res.end(body);
}

function readBody(req) {
	return new Promise((ok, fail) => {
		let n = 0;
		const chunks = [];
		req.on("data", (c) => {
			n += c.length;
			if (n > 1e6) {
				fail(new Error("body too large"));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
		req.on("error", fail);
	});
}

async function jsonBody(req) {
	const raw = await readBody(req);
	if (!raw.trim()) return {};
	const o = JSON.parse(raw);
	if (!o || typeof o !== "object") throw new Error("body must be an object");
	return o;
}

function checkText(text) {
	if (typeof text !== "string" || !text.trim())
		throw new Error("text 不能为空");
	if (text.length > MAX_TEXT) throw new Error(`text 过长（>${MAX_TEXT}）`);
	return text;
}

export function reviewServer() {
	return {
		name: "xmmath-review",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use("/__review", (req, res) => {
				const url = new URL(req.url, "http://localhost");
				const path = url.pathname.replace(/\/$/, "") || "/state";
				handle(req, res, path, url).catch((e) =>
					sendJson(res, 500, { ok: false, error: String(e?.message || e) }),
				);
			});
		},
	};
}

async function handle(req, res, path, url) {
	const cfg = config();

	if (path === "/state" && req.method === "GET") {
		return sendJson(res, 200, {
			ok: true,
			config: { typst: typstLabel(cfg), dpi: cfg.dpi, bin: cfg.bin || null },
		});
	}

	// 把 git HEAD 版的 src/ 导出到 cache/base/<sha>/src/，返回其 URL 前缀。
	// 网页动态 import 该前缀下的 main.ts，与工作区版并排渲染做差异对比。
	if (path === "/base" && req.method === "GET") {
		const sha = git(["rev-parse", "HEAD"]).trim();
		const dir = join(CACHE, "base", sha, "src");
		if (!existsSync(dir)) {
			const files = git(["ls-tree", "-r", "--name-only", "HEAD", "--", "src"])
				.split("\n")
				.filter(Boolean);
			if (!files.length)
				return sendJson(res, 500, { ok: false, error: "HEAD 里没有 src/" });
			for (const rel of files) {
				const content = git(["show", `HEAD:${rel}`]);
				const dest = join(CACHE, "base", sha, rel);
				mkdirSync(dirname(dest), { recursive: true });
				writeFileSync(dest, content);
			}
		}
		return sendJson(res, 200, {
			ok: true,
			sha,
			prefix: `/test/review/cache/base/${sha}`,
			dirty: git(["status", "--porcelain", "--", "src"])
				.split("\n")
				.filter(Boolean),
		});
	}

	if (path === "/typst" && req.method === "GET") {
		const text = checkText(url.searchParams.get("text") || "");
		const block = url.searchParams.get("block") === "1";
		const dpi = Number(url.searchParams.get("dpi")) || cfg.dpi;
		const ver = url.searchParams.get("ver") || "";
		const r = await renderTypst(text, block, dpi, ver);
		if (!r.meta.ok || !existsSync(r.file))
			return sendJson(res, 502, { ok: false, hash: r.hash, ...r.meta });
		res.statusCode = 200;
		res.setHeader("Content-Type", "image/png");
		res.setHeader("X-Typst-Hash", r.hash);
		res.setHeader("X-Typst-Cache", r.cached ? "hit" : "miss");
		res.setHeader("X-Typst-Stderr", encodeURIComponent(r.meta.stderr || ""));
		res.setHeader("Cache-Control", "no-store");
		res.end(readFileSync(r.file));
		return;
	}

	if (path === "/typst-batch" && req.method === "POST") {
		const b = await jsonBody(req);
		const items = Array.isArray(b.items) ? b.items.slice(0, MAX_BATCH) : [];
		const dpi = Number(b.dpi) || cfg.dpi;
		const ver = String(b.ver || "");
		const done = [];
		const failed = [];
		for (const it of items) {
			try {
				const r = await renderTypst(
					checkText(String(it.text)),
					!!it.block,
					dpi,
					ver,
				);
				if (r.meta.ok) done.push(it.id || r.hash);
				else
					failed.push({
						id: it.id,
						error: r.meta.stderr || r.meta.error || "typst 渲染失败",
					});
			} catch (e) {
				failed.push({ id: it.id, error: String(e?.message || e) });
			}
		}
		return sendJson(res, 200, { ok: true, done: done.length, failed });
	}

	return sendJson(res, 404, {
		ok: false,
		error: `未知端点 ${req.method} ${path}`,
	});
}
