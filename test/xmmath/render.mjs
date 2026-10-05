// Render an xmmath expression (this library) to a PNG or an HTML file.
// Companion to test/typst/render.mjs — same CLI shape, so the same expression
// can be rendered by both and compared side by side.
//
//   # block (display) math -> PNG at 150dpi (both defaults match render:typst):
//   node test/xmmath/render.mjs --expr 'sum_(i=1)^n i'
//
//   # inline math instead:
//   node test/xmmath/render.mjs --expr 'sum_(i=1)^n i' --inline
//
//   # HTML instead of PNG (MathML + the CSS the review page uses):
//   node test/xmmath/render.mjs --expr 'x^2' --format html --out /tmp/x.html
//
//   # fixed window instead of measuring (fewer browser launches, extra white
//   # margin — no cropping is ever done):
//   node test/xmmath/render.mjs --expr 'x^2' --size 400x200
//
//   # pick the browser that rasterises the MathML (png only; firefox first):
//   node test/xmmath/render.mjs --expr 'x^2' --bin /usr/bin/chromium
//
// How it works:
//   - MathML is produced in-process: vite's ssrLoadModule loads src/main.ts, so
//     the TS sources and their `./x.json?raw` imports run without a build step.
//   - The PNG is a headless-browser screenshot over a throwaway localhost
//     server (the font is served same-origin, so no file:// rules). Everything
//     is spawned asynchronously: while a browser is loading the page the server
//     must be free to answer, otherwise the measure round-trip deadlocks.
//   - Measuring pass: the page posts its laid-out box once the math font is
//     ready (headless firefox has no --dump-dom, and it waits for
//     document.fonts.load before capturing — visibility stays hidden until
//     then, so a too-early capture would be blank rather than wrong).
//   - Screenshot pass: window = that box (content + 6pt margin, typst's
//     `#set page(margin: 6pt)`), at --dpi via CSS `zoom` (firefox ignores
//     layout.css.devPixelsPerPx and has no --force-device-scale-factor).
//     It loads `/?shot` — same math, same CSS, but never hidden: the size is
//     already known, so hiding it only raced the capture and produced blank
//     PNGs. A browser-enforced minimum window size can leave extra white
//     margin; that is accepted rather than cropped.
//   - Needs a browser on PATH (or --bin / $XMMATH_BROWSER); the HTML format
//     needs no browser at all.
import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE_ROOT =
	process.env.XMMATH_RENDER_CACHE ||
	join(homedir(), ".cache", "xmmath", "render");
const FONT = join(ROOT, "docs", "latinmodern-math.otf");
const FONT_ROUTE = "/latinmodern-math.otf";
// window used by the measuring pass; only needs to be big enough to lay out
const PROBE_WINDOW = { width: 1600, height: 1000 };

// ---- args ----
function parseArgs(argv) {
	const o = { dpi: 150, json: false, keep: false, timeoutMs: 30000 };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => argv[++i];
		switch (a) {
			case "--expr":
				o.expr = next();
				break;
			case "--inline":
				o.inline = true;
				break;
			case "--format":
				o.format = next();
				break;
			case "--out":
				o.out = next();
				break;
			case "--dpi":
				o.dpi = Number(next());
				break;
			case "--size":
				o.size = next();
				break;
			case "--bin":
				o.bin = next();
				break;
			case "--timeout":
				o.timeoutMs = Number(next());
				break;
			case "--keep":
				o.keep = true;
				break;
			case "--json":
				o.json = true;
				break;
			case "-h":
			case "--help":
				o.help = true;
				break;
			default:
				o._unknown = (o._unknown || []).concat(a);
		}
	}
	return o;
}

const HELP = `xmmath render -> PNG / HTML (for AI inspection)

  --expr <str>    xmmath (typst math) source to render; required
  --inline        render as inline math; default is block (display) math,
                  which is what render:typst's default wrapper produces
  --format <f>    png (default) | html; the --out extension also picks it
  --out <path>    output path (default: <cache>/render-<n>.png|.html)
  --dpi <n>       png scale: image px = layout px * n/96 (default 150, same
                  effective text size as render:typst --dpi 150); html is
                  always 1:1
  --size <WxH>    fixed window, skips the measuring pass (extra white margin
                  around the formula is possible; nothing is ever cropped)
  --bin <path>    browser that rasterises the MathML (png only); default is
                  $XMMATH_BROWSER, else the first of firefox, firefox-esr,
                  google-chrome-stable, google-chrome, chromium, chromium-browser
  --timeout <ms>  per-invocation / measure timeout (default 30000)
  --keep          keep the intermediate .html (and browser profile) of a png run
  --json          emit a JSON report instead of a human summary
`;

function errMsg(e) {
	return String(e?.message || e);
}

// ---- xmmath (TS sources through vite) ----
let serverPromise = null;
async function loadXmmath() {
	if (!serverPromise) {
		serverPromise = (async () => {
			const { createServer } = await import("vite");
			return createServer({
				root: ROOT,
				configFile: false,
				server: { middlewareMode: true, hmr: false },
				appType: "custom",
				// silent: vite always spins an HMR ws on :24678 in middleware
				// mode, and a parallel render would log a red EADDRINUSE at us
				logLevel: "silent",
			});
		})();
	}
	const server = await serverPromise;
	return {
		main: await server.ssrLoadModule("/src/main.ts"),
		vdom: await server.ssrLoadModule("/src/vdom.ts"),
	};
}

async function closeXmmath() {
	if (!serverPromise) return;
	const server = await serverPromise;
	serverPromise = null;
	await server.close();
}

// ---- html ----
// #box is absolutely positioned at the origin with `width: max-content`, so its
// rect is exactly content + the 6pt margin typst's wrapper uses, and a formula
// wider than the viewport is still laid out at full width.
function pageCss({ fontSrc, scale }) {
	return `@font-face {
	font-family: lmmath;
	src: url("${fontSrc}") format("opentype");
}

* {
	box-sizing: border-box;
}

html,
body {
	margin: 0;
	background: #fff;
}

#box {
	position: absolute;
	top: 0;
	left: 0;
	width: max-content;
	padding: 6pt;
${scale !== 1 ? `	zoom: ${scale};\n` : ""}}

/* 14pt 对齐 render:typst 的 #set text(size: 14pt); nowrap 与 review 页一致 */
math {
	font-family: lmmath, "Latin Modern Math", serif;
	white-space: nowrap;
	font-size: 14pt;
}
`;
}

// The page measures itself once the math font is ready and posts the size to
// the local server; until then it stays invisible, so a capture that races
// ahead of the font comes out blank instead of subtly wrong.
const MEASURE_JS = `(() => {
	const show = () => { document.documentElement.style.visibility = "visible"; };
	const report = async () => {
		try { await document.fonts.load("14pt lmmath"); } catch {}
		try {
			const r = document.getElementById("box").getBoundingClientRect();
			await fetch("/m?w=" + Math.ceil(r.width) + "&h=" + Math.ceil(r.height));
		} catch {}
		show();
	};
	report();
	setTimeout(show, 10000);
})();`;

function buildHtml(mathml, { measure, fontSrc, scale = 1 }) {
	// the measure script sits at the end of <body>, where #box already exists
	const head = measure ? `\n<style>html { visibility: hidden; }</style>` : "";
	const tail = measure ? `\n<script>${MEASURE_JS}</script>` : "";
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>xmmath render</title>
<style>
${pageCss({ fontSrc, scale })}</style>${head}
</head>
<body>
<div id="box">${mathml}</div>${tail}
</body>
</html>
`;
}

// ---- local server (page + font + measure beacon) ----
// 两份页面共用一个端口：`/` 是测量页（字体就绪前隐藏，量到尺寸就发信标），
// `/?shot` 是截图页（始终可见——测量页那份 `visibility: hidden` 会在 firefox
// 截图的瞬间还没等到信标时把画面截成空白）。
async function servePage(html, shotHtml) {
	let settle = null;
	const measured = new Promise((res) => {
		settle = res;
	});
	let done = false;

	const server = createServer((req, res) => {
		const url = req.url || "/";
		if (url.startsWith("/m?")) {
			const q = new URL(url, "http://127.0.0.1").searchParams;
			const w = Number(q.get("w"));
			const h = Number(q.get("h"));
			if (!done && w > 0 && h > 0) {
				done = true;
				settle({ width: w, height: h });
			}
			res.writeHead(204).end();
			return;
		}
		if (url === FONT_ROUTE) {
			try {
				const body = readFileSync(FONT);
				res
					.writeHead(200, {
						"Content-Type": "font/otf",
						"Content-Length": body.length,
					})
					.end(body);
			} catch {
				res.writeHead(404).end();
			}
			return;
		}
		if (url === "/" || url.startsWith("/?")) {
			res
				.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
				.end(url.startsWith("/?shot") ? shotHtml : html);
			return;
		}
		res.writeHead(404).end();
	});

	await new Promise((res, rej) => {
		server.once("error", rej);
		server.listen(0, "127.0.0.1", res);
	});
	const origin = `http://127.0.0.1:${server.address().port}`;

	return {
		origin,
		measured,
		wait: (timeoutMs) =>
			Promise.race([
				measured,
				new Promise((res) => setTimeout(() => res(null), timeoutMs)),
			]),
		close: () =>
			new Promise((res) => {
				server.close(() => res());
				server.closeAllConnections?.();
			}),
	};
}

// ---- browser ----
function which(name) {
	const found = spawnSync("sh", ["-c", `command -v ${name}`], {
		encoding: "utf8",
	});
	return found.status === 0 ? found.stdout.trim() : null;
}

// firefox first: its MathML is the reference rendering here
const BROWSER_CANDIDATES = [
	"firefox",
	"firefox-esr",
	"firefox-nightly",
	"google-chrome-stable",
	"google-chrome",
	"chromium",
	"chromium-browser",
];

function cleanDiagnostics(stdout, stderr, error) {
	return `${stderr || ""}\n${stdout || ""}\n${error ? errMsg(error) : ""}`
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !/^\*{3} You are running in headless mode\.$/.test(l))
		.join("\n");
}

// Async on purpose: the local server must stay responsive while a browser is
// loading the page (a spawnSync here would deadlock the measure round-trip).
function run(bin, args, opts, hooks = {}) {
	const command = [bin, ...args].join(" ");
	const timeoutMs = opts.timeoutMs || 30000;
	return new Promise((res) => {
		let child;
		try {
			child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
		} catch (e) {
			res({ status: 1, diagnostics: errMsg(e), command });
			return;
		}
		hooks.onSpawn?.(child);
		let stdout = "";
		let stderr = "";
		let error = null;
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);
		child.stdout.on("data", (d) => {
			stdout += d;
		});
		child.stderr.on("data", (d) => {
			stderr += d;
		});
		child.on("error", (e) => {
			error = e;
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			const diagnostics = cleanDiagnostics(stdout, stderr, error);
			res({
				status: timedOut && code === null ? 1 : (code ?? 1),
				diagnostics: timedOut
					? `${diagnostics}\ntimed out after ${timeoutMs}ms`.trim()
					: diagnostics,
				command,
			});
		});
	});
}

async function resolveBrowser(opts) {
	let bin = null;
	let source = null;
	if (opts.bin) {
		bin = opts.bin;
		source = "bin";
	} else if (
		process.env.XMMATH_BROWSER &&
		existsSync(process.env.XMMATH_BROWSER)
	) {
		bin = process.env.XMMATH_BROWSER;
		source = "env";
	} else {
		for (const name of BROWSER_CANDIDATES) {
			const found = which(name);
			if (found) {
				bin = found;
				source = "system";
				break;
			}
		}
	}
	if (!bin) {
		throw new Error(
			"no firefox/chromium found; pass --bin <path> or set XMMATH_BROWSER (the png format needs a browser, --format html does not)",
		);
	}
	const probe = await run(bin, ["--version"], { timeoutMs: 10000 });
	const version = probe.diagnostics.split("\n")[0] || null;
	const engine = /firefox/i.test(version || "")
		? "firefox"
		: /chrome|chromium/i.test(version || "")
			? "chrome"
			: null;
	if (!engine)
		throw new Error(
			`--bin is not a firefox/chromium binary: ${version || bin}`,
		);
	return { bin, source, engine, version };
}

// Each run gets a throwaway profile: a bare `firefox --headless` grabs the
// default profile (already locked by the running browser) and gives up.
function browserArgs(engine, profile, extra) {
	if (engine === "firefox")
		return ["--headless", "--profile", profile, ...extra];
	return [
		"--headless=new",
		"--disable-gpu",
		"--hide-scrollbars",
		"--no-first-run",
		"--disable-extensions",
		`--user-data-dir=${profile}`,
		...extra,
	];
}

// Chrome refuses to start where its sandbox does not work and only says so in
// stderr; retry once without the sandbox, firefox never gets the flag.
function sandboxish(text) {
	return /sandbox|namespace|dev-shm/i.test(text || "");
}

async function screenshot(browser, args, opts) {
	const first = await run(browser.bin, args, opts);
	if (
		first.status === 0 ||
		browser.engine !== "chrome" ||
		!sandboxish(first.diagnostics)
	)
		return first;
	const second = await run(
		browser.bin,
		[...args.slice(0, 2), "--no-sandbox", ...args.slice(2)],
		opts,
	);
	return second.status === 0 ? second : first;
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

function parseSize(text) {
	const m = /^(\d+)x(\d+)$/i.exec(String(text || "").trim());
	return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

// ---- main ----
export async function render(argv = process.argv.slice(2)) {
	const opts = parseArgs(argv);
	if (opts.help) return { ok: true, help: HELP };
	if (opts.expr == null)
		return { ok: false, error: "need --expr <math source>" };

	const format = String(
		opts.format ||
			(opts.out ? extname(opts.out).replace(/^\./, "") : "") ||
			"png",
	).toLowerCase();
	if (format !== "png" && format !== "html") {
		return { ok: false, error: `unsupported format "${format}" (png | html)` };
	}
	const fixedSize = opts.size ? parseSize(opts.size) : null;
	if (opts.size && !fixedSize)
		return {
			ok: false,
			error: `bad --size "${opts.size}" (expected WxH, e.g. 400x200)`,
		};

	const dpi = Number.isFinite(opts.dpi) ? opts.dpi : 150;
	const scale = dpi / 96;
	const inline = !!opts.inline;
	const mode = inline ? "inline" : "block";

	mkdirSync(CACHE_ROOT, { recursive: true });
	const id = Date.now().toString(36);

	let lib;
	try {
		lib = await loadXmmath();
	} catch (e) {
		return {
			ok: false,
			error: `load xmmath failed: ${errMsg(e)}`,
			source: opts.expr,
		};
	}

	let mathml;
	try {
		mathml = lib.vdom.toHtml(lib.main.toMMLV(opts.expr, inline));
	} catch (e) {
		return {
			ok: false,
			error: `xmmath render failed: ${errMsg(e)}`,
			source: opts.expr,
		};
	}

	const base = {
		format,
		mode,
		inline,
		source: opts.expr,
		mathml,
		xmmath: { ...lib.main.version },
	};

	if (format === "html") {
		const out = opts.out || join(CACHE_ROOT, `render-${id}.html`);
		try {
			mkdirSync(dirname(out), { recursive: true });
			writeFileSync(
				out,
				buildHtml(mathml, {
					measure: false,
					fontSrc: pathToFileURL(FONT).href,
				}),
			);
		} catch (e) {
			return { ...base, ok: false, error: `write failed: ${errMsg(e)}` };
		}
		return { ...base, ok: true, html: out, font: pathToFileURL(FONT).href };
	}

	// ---- png ----
	let browser;
	try {
		browser = await resolveBrowser(opts);
	} catch (e) {
		return { ...base, ok: false, error: errMsg(e) };
	}

	const work = join(CACHE_ROOT, "work");
	mkdirSync(work, { recursive: true });
	const profile = join(work, `profile-${id}`);
	mkdirSync(profile, { recursive: true });
	const htmlPath = opts.keep
		? join(work, `render-${id}.html`)
		: join(tmpdir(), `xmmath-render-${id}.html`);
	const probePng = join(work, `probe-${id}.png`);
	// on disk: the file:// font so the kept page opens standalone; over http:
	// the same-origin route, since firefox will not load file fonts for a page
	// served from an origin.
	writeFileSync(
		htmlPath,
		buildHtml(mathml, {
			measure: true,
			fontSrc: pathToFileURL(FONT).href,
			scale,
		}),
	);

	const cleanup = async (page) => {
		if (page) await page.close();
		if (!opts.keep) {
			rmSync(htmlPath, { force: true });
			rmSync(probePng, { force: true });
			rmSync(profile, { recursive: true, force: true });
		}
	};

	let page = null;
	try {
		page = await servePage(
			buildHtml(mathml, { measure: true, fontSrc: FONT_ROUTE, scale }),
			buildHtml(mathml, { measure: false, fontSrc: FONT_ROUTE, scale }),
		);
	} catch (e) {
		await cleanup(null);
		return { ...base, ok: false, error: `local server failed: ${errMsg(e)}` };
	}

	let win = fixedSize;
	if (!win) {
		// pass 1: a browser loads the page, which posts its own box size back;
		// the probe is killed once we have it (its screenshot is throwaway)
		const probeArgs = browserArgs(browser.engine, profile, [
			`--screenshot=${probePng}`,
			`--window-size=${PROBE_WINDOW.width},${PROBE_WINDOW.height}`,
			`${page.origin}/`,
		]);
		let probeChild = null;
		const probe = run(browser.bin, probeArgs, opts, {
			onSpawn: (c) => {
				probeChild = c;
			},
		});
		win = await page.wait(opts.timeoutMs);
		probeChild?.kill("SIGKILL");
		await probe;
		if (!win) {
			await cleanup(page);
			return {
				...base,
				ok: false,
				error: `no measurement within ${opts.timeoutMs}ms (page never reported its size); try --size WxH`,
				browser: browser.bin,
				browserVersion: browser.version,
				engine: browser.engine,
				command: probeArgs.join(" "),
			};
		}
	}

	const outPng = opts.out || join(CACHE_ROOT, `render-${id}.png`);
	mkdirSync(dirname(outPng), { recursive: true });
	const args = browserArgs(browser.engine, profile, [
		`--screenshot=${outPng}`,
		`--window-size=${win.width},${win.height}`,
		`${page.origin}/?shot`,
	]);
	const shot = await screenshot(browser, args, opts);
	await cleanup(page);

	const rendered = existsSync(outPng);
	const report = {
		...base,
		ok: shot.status === 0 && rendered,
		browser: browser.bin,
		browserVersion: browser.version,
		engine: browser.engine,
		dpi,
		scale,
		measured: !!win && !fixedSize,
		// layout: the formula's own box at 96dpi, before the --dpi zoom
		layout: fixedSize
			? null
			: {
					width: Math.round(win.width / scale),
					height: Math.round(win.height / scale),
				},
		window: { width: win.width, height: win.height },
		command: shot.command,
		html: opts.keep ? htmlPath : null,
		png: rendered ? outPng : null,
		exitCode: shot.status,
		diagnostics: shot.diagnostics || "(none)",
	};
	if (rendered) Object.assign(report, pngDims(outPng) || {});

	return report;
}

function printHuman(rep) {
	if (rep.help) return console.log(rep.help);
	if (!rep.ok) return console.error(`ERROR: ${rep.error}`);
	console.log(
		`xmmath: syntax ${rep.xmmath?.lan} / symbols ${rep.xmmath?.symbol}  (${rep.mode} math)`,
	);
	if (rep.format === "html") {
		console.log(`html:   ${rep.html}`);
		return;
	}
	console.log(
		`browser: ${rep.browserVersion} [${rep.engine}] (via ${rep.browser})`,
	);
	console.log(`png:   ${rep.png || "NOT PRODUCED"}`);
	if (rep.png && rep.width) {
		const layout = rep.layout
			? ` (layout ${rep.layout.width}x${rep.layout.height} css px)`
			: "";
		console.log(`size:  ${rep.width}x${rep.height} @${rep.dpi}dpi${layout}`);
	}
	console.log(`exit:  ${rep.exitCode}`);
	if (rep.diagnostics && rep.diagnostics !== "(none)")
		console.log(`--- diagnostics ---\n${rep.diagnostics}`);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	const rep = await render();
	if (parseArgs(process.argv.slice(2)).json)
		console.log(JSON.stringify(rep, null, 2));
	else printHuman(rep);
	await closeXmmath();
	if (!rep.ok && !rep.help) process.exit(2);
}
