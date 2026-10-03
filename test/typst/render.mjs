// Render typst (a specified version or a chosen binary) to a PNG an AI tool can read,
// capturing typst's own warnings/errors so behavior differences are visible.
//
//   # Render a bare math expression with the system typst:
//   node test/typst/render.mjs --expr 'a ~ b' --out /tmp/tilde.png
//
//   # Render a full document from a file:
//   node test/typst/render.mjs --file snippet.typ --out out.png --dpi 200
//
//   # Pin a specific typst version (downloads + caches the release binary):
//   node test/typst/render.mjs --typst v0.12.0 --expr 'mat(delim: "||", 1, 2; 3, 4)'
//
//   # Use an explicit binary:
//   node test/typst/render.mjs --bin /usr/bin/typst --code '$√2$'
//
// Output: writes a PNG, and prints a JSON report (or a human summary) with the
// resolved binary/version, exit code, diagnostics, and image dimensions.
// Machine mode: add --json. Requires: system `tar` (for .tar.xz extraction).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, basename, extname } from "node:path";

const CACHE_ROOT = process.env.XMMATH_TYPST_CACHE || join(homedir(), ".cache", "xmmath", "typst");

// ---- args ----
function parseArgs(argv) {
	const o = { dpi: 150, json: false, keep: false, wrap: true };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => argv[++i];
		switch (a) {
			case "--expr": o.expr = next(); break;
			case "--code": o.code = next(); break;
			case "--file": o.file = next(); break;
			case "--out": o.out = next(); break;
			case "--dpi": o.dpi = Number(next()); break;
			case "--typst": o.version = next(); break;
			case "--bin": o.bin = next(); break;
			case "--base-url": o.baseUrl = next(); break;
			case "--mirror": o.mirror = next(); break;
			case "--timeout": o.timeoutMs = Number(next()); break;
			case "--no-wrap": o.wrap = false; break;
			case "--keep": o.keep = true; break;
			case "--json": o.json = true; break;
			case "-h":
			case "--help": o.help = true; break;
			default: o._unknown = (o._unknown || []).concat(a);
		}
	}
	return o;
}

const HELP = `typst render -> PNG (for AI inspection)

  --expr <str>    bare math/text expression, auto-wrapped into a standalone doc
  --code <str>    full typst source (used verbatim)
  --file <path>   read typst source from a file
  --out <path>    output PNG path (default: <cache>/render-<n>.png)
  --dpi <n>       PNG DPI (default 150)
  --typst <ver>   pin a typst version (e.g. v0.12.0); downloads + caches binary
  --bin <path>    use an explicit typst binary (skips download)
  --base-url <u>  override release download base (default github.com/typst/typst/releases/download)
  --mirror <u>    prefix a GitHub mirror/proxy for the download (retry after direct);
                  or env TYPST_MIRROR=<u> / TYPST_MIRRORS=<u1,u2,...>
  --timeout <ms>  download timeout (default 120000; slow networks raise this)
  --no-wrap       with --expr, do not wrap in \$ ... \$ / page setup
  --keep          keep the generated .typ temp file
  --json          emit a JSON report instead of a human summary
`;

// ---- platform triple ----
function targetTriple(platform = process.platform, arch = process.arch) {
	const map = {
		"linux-x64": "x86_64-unknown-linux-musl",
		"linux-arm64": "aarch64-unknown-linux-musl",
		"darwin-x64": "x86_64-apple-darwin",
		"darwin-arm64": "aarch64-apple-darwin",
	};
	return map[`${platform}-${arch}`];
}

function normalizeVersion(v) {
	return /^v\d/.test(v) ? v : `v${v}`;
}

// ---- binary resolution ----
function which(name = "typst") {
	const found = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
	return found.status === 0 ? found.stdout.trim() : null;
}

// Download with curl (resume + retry), trying the direct URL then GitHub mirrors.
// Mirrors prefix the full github URL; override the list with TYPST_MIRRORS (comma-separated).
const DEFAULT_MIRRORS = [
	"https://ghfast.top/",
	"https://gh-proxy.com/",
	"https://ghproxy.net/",
];

function download(url, dest, timeoutMs) {
	const secs = Math.max(1, Math.ceil((timeoutMs || 120000) / 1000));
	const r = spawnSync(
		"curl",
		["-sSL", "--retry", "5", "--retry-all-errors", "-C", "-", "--max-time", String(secs), url, "-o", dest],
		{ encoding: "utf8" },
	);
	if (r.status !== 0) throw new Error(`curl ${r.status} for ${url}`);
}

function candidateUrls(direct, opts) {
	const mirrors = (process.env.TYPST_MIRRORS || (opts.mirror ? String(opts.mirror) : ""))
		? (process.env.TYPST_MIRRORS || String(opts.mirror)).split(",").map((s) => s.trim()).filter(Boolean)
		: DEFAULT_MIRRORS;
	const single = process.env.TYPST_MIRROR ? [process.env.TYPST_MIRROR, ...mirrors] : mirrors;
	return [direct, ...single.map((m) => (m.endsWith("/") ? m + direct : `${m}/${direct}`))];
}

async function ensureVersionBinary(version, opts) {
	const tag = normalizeVersion(version);
	const dir = join(CACHE_ROOT, tag);
	const bin = join(dir, "typst");
	if (existsSync(bin)) return { bin, tag, source: "cache" };

	const triple = targetTriple();
	if (!triple) throw new Error(`no prebuilt typst asset for ${process.platform}-${process.arch}; use --bin`);
	const base = opts.baseUrl || "https://github.com/typst/typst/releases/download";
	const asset = `typst-${triple}.tar.xz`;
	const direct = `${base}/${tag}/${asset}`;
	const timeoutMs = opts.timeoutMs || 120000;

	mkdirSync(dir, { recursive: true });
	const tarball = join(dir, asset);

	let lastErr = null;
	let ok = false;
	for (const url of candidateUrls(direct, opts)) {
		try {
			download(url, tarball, timeoutMs);
			const probe = spawnSync("tar", ["-tf", tarball], { encoding: "utf8" });
			if (probe.status === 0) {
				ok = true;
				break;
			}
			lastErr = `not a valid archive: ${url}`;
		} catch (e) {
			lastErr = String(e.message || e);
		}
	}
	if (!ok) {
		rmSync(tarball, { force: true });
		throw new Error(
			`download failed for ${tag} (${lastErr}). Use --bin, set TYPST_MIRROR, or pre-place the binary at ${bin}`,
		);
	}
	const ex = spawnSync("tar", ["-xf", tarball, "-C", dir], { encoding: "utf8" });
	if (ex.status !== 0) throw new Error(`extract failed: ${ex.stderr}`);
	// extracted into typst-<triple>/typst ; relocate to dir/typst
	const nested = join(dir, `typst-${triple}`, "typst");
	if (existsSync(nested)) {
		writeFileSync(bin, readFileSync(nested));
		chmodSync(bin, 0o755);
		rmSync(join(dir, `typst-${triple}`), { recursive: true, force: true });
		rmSync(tarball, { force: true });
	}
	if (!existsSync(bin)) throw new Error(`downloaded archive did not contain a typst binary`);
	return { bin, tag, source: "download" };
}

async function resolveBin(opts) {
	if (opts.bin) return { bin: opts.bin, tag: null, source: "bin" };
	if (opts.version) return ensureVersionBinary(opts.version, opts);
	const env = process.env.TYPST_BIN;
	if (env && existsSync(env)) return { bin: env, tag: null, source: "env" };
	const w = which("typst");
	if (w) return { bin: w, tag: null, source: "system" };
	throw new Error("no typst binary found; pass --bin <path> or --typst <version> or set TYPST_BIN");
}

// ---- source build ----
function buildSource(opts) {
	if (opts.file) return readFileSync(opts.file, "utf8");
	if (opts.code != null) return opts.code;
	if (opts.expr != null) {
		if (!opts.wrap) return opts.expr;
		return [
			"#set page(width: auto, height: auto, margin: 6pt)",
			"#set text(size: 14pt)",
			`$ ${opts.expr} $`,
		].join("\n");
	}
	return null;
}

// ---- PNG dims from IHDR ----
function pngDims(file) {
	try {
		const b = readFileSync(file);
		if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
		return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
	} catch {
		return null;
	}
}

function binaryVersion(bin) {
	const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
	return r.status === 0 ? r.stdout.trim().split("\n")[0] : null;
}

// ---- main ----
export async function render(argv = process.argv.slice(2)) {
	const opts = parseArgs(argv);
	if (opts.help) return { ok: true, help: HELP };
	const source = buildSource(opts);
	if (source == null) return { ok: false, error: "need one of --expr / --code / --file" };

	let resolved;
	try {
		resolved = await resolveBin(opts);
	} catch (e) {
		return { ok: false, error: String(e.message || e) };
	}

	const workdir = join(CACHE_ROOT, "render");
	mkdirSync(workdir, { recursive: true });
	const id = Date.now().toString(36);
	const inTyp = opts.keep ? join(workdir, `in-${id}.typ`) : join(tmpdir(), `xmmath-typst-${id}.typ`);
	const outPng = opts.out || join(workdir, `render-${id}.png`);
	writeFileSync(inTyp, source + "\n");

	const cmd = [resolved.bin, "compile", inTyp, outPng, "--format", "png", "--ppi", String(opts.dpi)];
	const r = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8" });
	const rendered = existsSync(outPng);

	const report = {
		ok: r.status === 0 && rendered,
		binary: resolved.bin,
		version: binaryVersion(resolved.bin),
		binarySource: resolved.source,
		pinned: resolved.tag || opts.version || null,
		dpi: opts.dpi,
		command: cmd.join(" "),
		source,
		input: inTyp,
		png: rendered ? outPng : null,
		exitCode: r.status,
		stdout: (r.stdout || "").trim(),
		stderr: (r.stderr || "").trim(),
		// typst writes warnings AND the compiled-diagnostics to stderr
		diagnostics: (r.stderr || "").trim() || "(none)",
	};
	if (rendered) Object.assign(report, pngDims(outPng) || {});
	if (!opts.keep && existsSync(inTyp)) rmSync(inTyp, { force: true });
	return report;
}

function printHuman(rep) {
	if (rep.help) return console.log(rep.help);
	if (rep.error) return console.error(`ERROR: ${rep.error}`);
	console.log(`typst: ${rep.version}  (via ${rep.binarySource}${rep.pinned ? ` ${rep.pinned}` : ""})`);
	console.log(`png:   ${rep.png || "NOT PRODUCED"}`);
	if (rep.png && rep.width) console.log(`size:  ${rep.width}x${rep.height} @${rep.dpi}dpi`);
	console.log(`exit:  ${rep.exitCode}`);
	if (rep.stderr) console.log(`--- diagnostics ---\n${rep.stderr}`);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	const rep = await render();
	if (parseArgs(process.argv.slice(2)).json) console.log(JSON.stringify(rep, null, 2));
	else printHuman(rep);
	if (!rep.ok && !rep.help) process.exit(2);
}
