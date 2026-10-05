// review 页：语料对照（我方渲染 vs typst 官方图，?oldtypst=<版本> 时再渲一张旧版本图并用 canvas 比对像素）、
// 自定义用例、变更（页面里 import HEAD 版 src 与工作区版各渲染一遍语料，运行时算出差异，无入库清单）。只做对照，不记录反馈。
// 数据来自 /__review/* 中间件（test/review/plugin.mjs），渲染走 src（与单测同一条路径）。
import { toMMLV } from "../../src/main.js";
import { toHtml } from "../../src/vdom.js";
import corpus from "../fixtures/math.json";

type Case = {
	id: string;
	cat: string;
	text: string;
	block: boolean;
	knownBroken?: boolean;
};
// 一条变更 = 同一输入在 HEAD 版与工作区版输出不同（错误信息也算输出）
type DiffItem = {
	id: string;
	cat: string;
	status: "changed" | "same";
	oldHtml: string | null;
	newHtml: string | null;
	oldError: string | null;
	newError: string | null;
};
// 两张 typst PNG 的 canvas 像素比对结果
type TypstCmp = {
	hashA: string;
	hashB: string;
	diffPx: number;
	total: number;
	ratio: number;
	dims: string;
};

const state = {
	tab: "corpus",
	cat: "",
	search: "",
	onlyChanged: false,
	onlyTypstDiff: false,
	ids: null as Set<string> | null,
	cases: [] as Case[],
	// ?oldtypst=<版本>：语料页每例额外渲一张该版本的 typst 图并比对（空 = 不比）
	oldtypst: "",
	changes: null as {
		sha: string;
		dirty: string[];
		items: DiffItem[];
		generatedAt: string;
	} | null,
	changesError: null as string | null,
	changesBusy: false,
	typstDiff: new Map<string, TypstCmp>(),
	// math.json 手工增补时可能 id 撞车（同 id 多条会让按 id 过滤/比对张冠李戴），进页时检出并在顶部警告
	dupIds: [] as string[],
	config: { typst: "", dpi: 150 },
};

const params = new URLSearchParams(location.search);
state.tab = params.get("tab") || "corpus";
state.cat = params.get("cat") || "";
state.search = params.get("q") || "";
state.oldtypst = (params.get("oldtypst") || "").trim();
if (params.get("ids"))
	state.ids = new Set((params.get("ids") as string).split(",").filter(Boolean));

const main = byId("main");
const tabsEl = byId("tabs");

// ---- 工具 ----
function byId(id: string): HTMLElement {
	return document.getElementById(id) as HTMLElement;
}
function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> & { text?: string } = {},
	...kids: (Node | string)[]
) {
	const n = document.createElement(tag);
	const { text, ...rest } = props;
	Object.assign(n, rest);
	if (text != null) n.textContent = text;
	for (const k of kids) n.append(k);
	return n;
}

function syncUrl() {
	const p = new URLSearchParams();
	p.set("tab", state.tab);
	if (state.cat) p.set("cat", state.cat);
	if (state.search) p.set("q", state.search);
	if (state.oldtypst) p.set("oldtypst", state.oldtypst);
	if (state.ids) p.set("ids", [...state.ids].join(","));
	history.replaceState(null, "", `?${p}`);
}

async function api(path: string, body?: unknown) {
	const res = await fetch(`/__review${path}`, {
		method: body ? "POST" : "GET",
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || data.ok === false)
		throw new Error(data.error || `${res.status} ${path}`);
	return data;
}

function ourMathML(c: Case) {
	return toHtml(toMMLV(c.text, !c.block));
}

// ---- 变更：动态 import HEAD 版 src，与工作区版各渲染一遍语料 ----
type OldModule = {
	toMMLHTML?: (s: string, inline?: boolean) => string;
	toMML?: (s: string, inline?: boolean) => Element;
};

function renderWith(mod: OldModule, c: Case): string {
	if (typeof mod?.toMMLHTML === "function")
		return mod.toMMLHTML(c.text, !c.block);
	if (typeof mod?.toMML === "function")
		return (mod.toMML(c.text, !c.block) as Element).outerHTML;
	throw new Error("HEAD 版导出里没有 toMMLHTML/toMML");
}

// 服务端导出 HEAD 的 src/ 到 cache/base/<sha>/，再在浏览器里 import 它
async function ensureChanges(force = false) {
	if ((state.changes && !force) || state.changesBusy) return;
	state.changesBusy = true;
	state.changesError = null;
	try {
		const b = await api("/base");
		const mod = (await import(
			/* @vite-ignore */ `${b.prefix}/src/main.ts`
		)) as OldModule;
		const items: DiffItem[] = [];
		for (const c of state.cases) {
			let oldHtml: string | null = null;
			let oldError: string | null = null;
			let newHtml: string | null = null;
			let newError: string | null = null;
			try {
				oldHtml = renderWith(mod, c);
			} catch (e) {
				oldError = String(e);
			}
			try {
				newHtml = ourMathML(c);
			} catch (e) {
				newError = String(e);
			}
			const status: DiffItem["status"] =
				oldHtml === newHtml && oldError === newError ? "same" : "changed";
			items.push({
				id: c.id,
				cat: c.cat,
				status,
				oldHtml,
				newHtml,
				oldError,
				newError,
			});
		}
		state.changes = {
			sha: b.sha,
			dirty: b.dirty || [],
			items,
			generatedAt: new Date().toISOString(),
		};
	} catch (e) {
		state.changesError = String(e);
	} finally {
		state.changesBusy = false;
	}
}

// ---- typst 双版本 canvas 比对 ----
async function fetchPng(c: Case, ver: string) {
	const u = `/__review/typst?text=${encodeURIComponent(c.text)}&block=${c.block ? 1 : 0}${
		ver ? `&ver=${encodeURIComponent(ver)}` : ""
	}`;
	const res = await fetch(u);
	if (!res.ok) {
		const d = await res.json().catch(() => ({}));
		return {
			ok: false as const,
			error: d.error || d.stderr || String(res.status),
		};
	}
	return {
		ok: true as const,
		blob: await res.blob(),
		hash: res.headers.get("X-Typst-Hash") || "",
		cache: res.headers.get("X-Typst-Cache") || "",
		stderr: decodeURIComponent(res.headers.get("X-Typst-Stderr") || ""),
	};
}

function fnv1a(d: Uint8ClampedArray): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < d.length; i++) {
		h ^= d[i];
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}

// 两张 PNG 画进 canvas，整图像素 hash 判有无差异，有差异再给差异像素占比
async function comparePng(a: Blob, b: Blob): Promise<TypstCmp> {
	const [bm1, bm2] = await Promise.all([
		createImageBitmap(a),
		createImageBitmap(b),
	]);
	const w = Math.max(bm1.width, bm2.width);
	const h = Math.max(bm1.height, bm2.height);
	const draw = (bm: ImageBitmap) => {
		const cv = document.createElement("canvas");
		cv.width = w;
		cv.height = h;
		const ctx = cv.getContext("2d", { willReadFrequently: true });
		if (!ctx) throw new Error("canvas 2d context 不可用");
		// 尺寸不同则以左上角对齐，缺的部分当透明参与比较
		ctx.clearRect(0, 0, w, h);
		ctx.drawImage(bm, 0, 0);
		return ctx.getImageData(0, 0, w, h).data;
	};
	const d1 = draw(bm1);
	const d2 = draw(bm2);
	let diffPx = 0;
	for (let i = 0; i < d1.length; i += 4) {
		if (
			d1[i] !== d2[i] ||
			d1[i + 1] !== d2[i + 1] ||
			d1[i + 2] !== d2[i + 2] ||
			d1[i + 3] !== d2[i + 3]
		)
			diffPx++;
	}
	const total = w * h;
	return {
		hashA: fnv1a(d1),
		hashB: fnv1a(d2),
		diffPx,
		total,
		ratio: total ? diffPx / total : 0,
		dims:
			bm1.width === bm2.width && bm1.height === bm2.height
				? ""
				: `${bm1.width}×${bm1.height} vs ${bm2.width}×${bm2.height}`,
	};
}

// typst 图并发限流（每张图会起一个 typst 进程）
let running = 0;
const waiting: (() => void)[] = [];
function slot(): Promise<void> {
	if (running < 3) {
		running++;
		return Promise.resolve();
	}
	return new Promise((ok) => {
		waiting.push(() => {
			running++;
			ok();
		});
	});
}
function release() {
	running--;
	waiting.shift()?.();
}

const blobUrls: string[] = [];
function trackUrl(u: string) {
	blobUrls.push(u);
	return u;
}

// ---- 渲染：单个用例卡片 ----
function paneOurs(c: Case) {
	const pane = el(
		"div",
		{ className: "pane" },
		el("label", { text: "xmmath（本库渲染）" }),
	);
	try {
		const html = ourMathML(c);
		pane.append(el("div", { className: "render", innerHTML: html }));
		pane.append(
			el(
				"details",
				{},
				el("summary", { text: "MathML" }),
				el("pre", { className: "ml", textContent: html }),
			),
		);
	} catch (e) {
		pane.classList.add("err");
		pane.append(
			el("div", { className: "diag", textContent: `渲染抛错：${String(e)}` }),
		);
	}
	return pane;
}

function paneTypst(c: Case) {
	const pane = el(
		"div",
		{ className: "pane pending" },
		el("label", {
			text: state.oldtypst
				? `typst 官方（${state.config.typst} vs ${state.oldtypst}）`
				: "typst 官方（PNG）",
		}),
	);
	const addImg = (url: string, alt: string) => {
		const img = el("img", {
			src: url,
			alt,
		} as Partial<HTMLImageElement>) as HTMLImageElement;
		// PNG 是 dpi 分辨率的位图，按 72dpi 折算成 CSS 宽度，字号就和左侧活字一致
		img.onload = () => {
			img.style.width = `${(img.naturalWidth * 72) / state.config.dpi}px`;
		};
		pane.append(img);
	};
	const load = async () => {
		if (pane.dataset.loading) return;
		pane.dataset.loading = "1";
		await slot();
		try {
			const r = await fetchPng(c, "");
			if (!r.ok) {
				pane.classList.replace("pending", "err");
				pane.append(
					el("div", {
						className: "diag",
						textContent: `typst 失败：${r.error}`,
					}),
				);
				return;
			}
			pane.classList.remove("pending");
			addImg(trackUrl(URL.createObjectURL(r.blob)), c.id);
			pane.append(
				el("div", {
					className: "muted",
					textContent: `hash ${r.hash.slice(0, 8)} · ${r.cache}`,
				}),
			);
			if (r.stderr && !/^warning: html export/.test(r.stderr))
				pane.append(el("div", { className: "diag", textContent: r.stderr }));

			if (!state.oldtypst) return;
			// 旧版本：同一输入再渲一张，canvas 比像素（hash 判有无差异，再给占比）
			const o = await fetchPng(c, state.oldtypst);
			if (!o.ok) {
				pane.append(
					el("div", {
						className: "diag",
						textContent: `typst ${state.oldtypst} 失败：${o.error}`,
					}),
				);
				return;
			}
			addImg(
				trackUrl(URL.createObjectURL(o.blob)),
				`${c.id} @${state.oldtypst}`,
			);
			const cmp = await comparePng(r.blob, o.blob);
			state.typstDiff.set(c.id, cmp);
			onTypstDiff?.();
			pane.append(
				el("div", {
					className: cmp.diffPx ? "badge dif" : "badge",
					textContent: cmp.diffPx
						? `有差异 ${(cmp.ratio * 100).toFixed(2)}%（${cmp.diffPx}/${cmp.total}px）` +
							(cmp.dims ? ` · 尺寸 ${cmp.dims}` : "")
						: "像素一致",
				}),
			);
			pane.append(
				el("div", {
					className: "muted",
					textContent: `hash ${cmp.hashA} / ${cmp.hashB} · ${o.cache}`,
				}),
			);
		} catch (e) {
			pane.classList.replace("pending", "err");
			pane.append(el("div", { className: "diag", textContent: String(e) }));
		} finally {
			release();
		}
	};
	(pane as HTMLElement & { load?: () => void }).load = load;
	// 谁用这个面板谁都不用记得登记：滚到附近就自己加载
	observe(pane);
	return pane;
}

function caseCard(c: Case) {
	const card = el("div", { className: "card" });
	card.dataset.id = c.id;

	const typstPane = paneTypst(c);
	card.append(
		el(
			"div",
			{ className: "chead" },
			el("span", { className: "id", textContent: c.id }),
			el("span", {
				className: "badge",
				textContent: c.block ? "block" : "inline",
			}),
			el("button", {
				textContent: "载入 typst 图",
				onclick: () => (typstPane as HTMLElement & { load: () => void }).load(),
			}),
		),
		el("pre", { className: "src", textContent: c.text }),
		el("div", { className: "panes" }, paneOurs(c), typstPane),
	);
	return card;
}

// 进入视口再请求 typst 图
const io = new IntersectionObserver(
	(entries) => {
		for (const e of entries) {
			if (!e.isIntersecting) continue;
			io.unobserve(e.target);
			(e.target as HTMLElement & { load?: () => void }).load?.();
		}
	},
	{ rootMargin: "300px" },
);
function observe(node: HTMLElement) {
	io.observe(node);
}

// IntersectionObserver 只在页面可见时触发；这个按钮给一个确定性的「全部载入」入口
function loadAllTypstButton(scope: () => HTMLElement, onDone?: () => void) {
	const btn = el("button", { textContent: "全部载入 typst 图" });
	btn.onclick = async () => {
		const panes = [
			...scope().querySelectorAll<HTMLElement & { load?: () => Promise<void> }>(
				".pane",
			),
		].filter((p) => p.load);
		btn.setAttribute("disabled", "");
		btn.textContent = `载入中 ${panes.length} …`;
		await Promise.all(panes.map((p) => p.load?.()));
		btn.removeAttribute("disabled");
		btn.textContent = `已载入 ${panes.length} 张`;
		onDone?.();
	};
	return btn;
}

// ---- 视图：语料对照 ----
function visibleCases() {
	let list = state.cases;
	if (state.cat) list = list.filter((c) => c.cat === state.cat);
	if (state.ids) list = list.filter((c) => state.ids?.has(c.id));
	if (state.search) {
		const s = state.search.toLowerCase();
		list = list.filter(
			(c) => c.text.toLowerCase().includes(s) || c.id.includes(s),
		);
	}
	if (state.onlyChanged && state.changes) {
		const ids = new Set(
			state.changes.items
				.filter((i) => i.status === "changed")
				.map((i) => i.id),
		);
		list = list.filter((c) => ids.has(c.id));
	}
	if (state.onlyTypstDiff && state.oldtypst) {
		list = list.filter((c) => (state.typstDiff.get(c.id)?.diffPx ?? 0) > 0);
	}
	return list;
}

// 每比对完一例 typst 两版本就回调（语料页用它刷新侧栏过滤计数）
let onTypstDiff: (() => void) | null = null;

function typstFilterText() {
	const n = state.typstDiff.size;
	if (!n) return "（先「全部载入 typst 图」）";
	const diff = [...state.typstDiff.values()].filter((v) => v.diffPx > 0).length;
	return `（已比对 ${n}，有差异 ${diff}）`;
}

function viewCorpus() {
	main.className = "";
	main.textContent = "";

	// 侧栏
	const search = el("input", {
		type: "search",
		placeholder: "搜索源码或 id",
		value: state.search,
	} as Partial<HTMLInputElement>);
	search.oninput = () => {
		state.search = search.value;
		syncUrl();
		renderList();
	};
	const cats = [...new Set(state.cases.map((c) => c.cat))];
	const list = el("ul", { className: "catlist" });
	const catItem = (name: string, label: string, n: number) => {
		const b = el(
			"button",
			{ textContent: label },
			el("span", { className: "n", textContent: String(n) }),
		);
		b.setAttribute("aria-current", String(state.cat === name));
		b.onclick = () => {
			state.cat = name;
			syncUrl();
			viewCorpus();
		};
		return el("li", {}, b);
	};
	list.append(catItem("", "全部", state.cases.length));
	for (const c of cats)
		list.append(catItem(c, c, state.cases.filter((x) => x.cat === c).length));

	const changedBox = el("span", { className: "muted", textContent: "" });
	const onlyChanged = el("input", {
		type: "checkbox",
		checked: state.onlyChanged,
		disabled: state.changesBusy,
	} as Partial<HTMLInputElement>);
	const changedLabelText = () => {
		if (state.changesBusy) return " 与 HEAD 差异计算中…";
		if (!state.changes)
			return ` 与 HEAD 有差异${state.changesError ? "（计算失败）" : "（点此计算）"}`;
		return ` 与 HEAD 有差异（${changedIdsNow().size}）`;
	};
	const syncChangedLabel = () => {
		changedBox.textContent = changedLabelText();
		onlyChanged.disabled =
			state.changesBusy || (!!state.changes && !changedIdsNow().size);
	};
	syncChangedLabel();
	onlyChanged.onchange = async () => {
		if (!state.changes) {
			// 第一次勾选才算 HEAD vs 工作区的差异（412 例 × 2 次渲染，很快）
			onlyChanged.checked = false;
			syncChangedLabel();
			await ensureChanges();
			syncChangedLabel();
			if (changedIdsNow().size) {
				onlyChanged.checked = true;
				state.onlyChanged = true;
			}
		} else {
			state.onlyChanged = onlyChanged.checked;
		}
		renderList();
	};

	const kids: (Node | string)[] = [search];
	let syncTypstFilter = () => {};
	if (state.oldtypst) {
		const onlyTypstDiff = el("input", {
			type: "checkbox",
			checked: state.onlyTypstDiff,
			disabled: state.typstDiff.size === 0,
		} as Partial<HTMLInputElement>);
		const tfLabel = el("span", { textContent: typstFilterText() });
		syncTypstFilter = () => {
			onlyTypstDiff.disabled = state.typstDiff.size === 0;
			tfLabel.textContent = typstFilterText();
		};
		onlyTypstDiff.onchange = () => {
			state.onlyTypstDiff = onlyTypstDiff.checked;
			renderList();
		};
		kids.push(el("label", {}, onlyTypstDiff, " 仅 typst 版本差异", tfLabel));
	}
	kids.push(el("label", {}, onlyChanged, changedBox), list);

	const aside = el("aside", {}, ...kids);
	onTypstDiff = syncTypstFilter;

	function changedIdsNow() {
		return new Set(
			(state.changes?.items || [])
				.filter((i) => i.status === "changed")
				.map((i) => i.id),
		);
	}

	const body = el("section");
	const toolbar = el("div", { className: "toolbar" });
	const count = el("span", { className: "muted" });
	const batchBtn = el("button", { textContent: "预生成本列表 typst 图" });
	batchBtn.onclick = async () => {
		const items = visibleCases();
		batchBtn.setAttribute("disabled", "");
		// oldtypst 模式下两个版本都预生成，后面 canvas 比对才不用现场排队渲染
		const vers = state.oldtypst ? ["", state.oldtypst] : [""];
		for (const ver of vers) {
			for (let i = 0; i < items.length; i += 40) {
				batchBtn.textContent = `${ver ? `旧版 ${ver} ` : ""}生成中 ${Math.min(i + 40, items.length)}/${items.length}`;
				try {
					await api("/typst-batch", { items: items.slice(i, i + 40), ver });
				} catch (e) {
					batchBtn.textContent = `失败：${String(e)}`;
					return;
				}
			}
		}
		batchBtn.textContent = "已生成，重新载入即可命中缓存";
		batchBtn.removeAttribute("disabled");
	};
	toolbar.append(
		count,
		batchBtn,
		loadAllTypstButton(() => byId("cards"), syncTypstFilter),
	);
	body.append(toolbar, el("div", { id: "cards" }));

	main.append(aside, body);
	renderList();

	function renderList() {
		const items = visibleCases();
		count.textContent = `${items.length} 例`;
		const box = byId("cards");
		io.disconnect();
		for (const u of blobUrls.splice(0)) URL.revokeObjectURL(u);
		box.textContent = "";
		for (const c of items) box.append(caseCard(c));
	}
}

// ---- 视图：自定义 ----
function viewCustom() {
	main.className = "single";
	main.textContent = "";
	const text = el("textarea", {
		className: "big",
		placeholder:
			"输入 typst 数学源码（不含 $），例如： mat(1,2;3,4) 或 x^2 + frac(1,2)",
		value: params.get("text") || "",
	} as Partial<HTMLTextAreaElement>);
	const block = el("input", {
		type: "checkbox",
		checked: true,
	} as Partial<HTMLInputElement>);
	const out = el("div");

	const run = () => {
		out.textContent = "";
		const t = text.value;
		if (!t.trim()) return;
		const c: Case = {
			id: "preview",
			cat: "custom",
			text: t,
			block: block.checked,
		};
		const card = caseCard(c);
		out.append(card);
	};
	const presets = [
		"mat(1, 2; 3, 4)",
		"sqrt(x)",
		"hat(x) + tilde(x)",
		"cancel(x)",
		"underline(x)",
		"lr(|x|)",
		"frac(1, 2) / 3",
		"sum_(i=0)^n i",
		"a ~ b",
		"cases(1, 2)",
	];

	main.append(
		el(
			"div",
			{ className: "card" },
			el("h3", { textContent: "临时对照（自定义输入）" }),
			text,
			el(
				"div",
				{ className: "toolbar" },
				el("label", {}, block, " block（块级公式）"),
				el("button", { textContent: "渲染对照", onclick: run }),
			),
			el(
				"div",
				{ className: "toolbar muted" },
				"快速填入：",
				...presets.map((p) =>
					el("button", {
						textContent: p,
						onclick: () => {
							text.value = p;
							run();
						},
					}),
				),
			),
			el("div", {
				className: "muted",
				textContent:
					"这里只做临时对照；要长期钉住某个用例，写进 test/custom.test.ts 的普通 it 断言。",
			}),
		),
		out,
	);
}

// ---- 视图：变更（HEAD 版 vs 工作区版，运行时算） ----
function diffLines(a: string, b: string) {
	const A = a.split("\n");
	const B = b.split("\n");
	const dp: number[][] = Array.from({ length: A.length + 1 }, () =>
		new Array(B.length + 1).fill(0),
	);
	for (let i = A.length - 1; i >= 0; i--)
		for (let j = B.length - 1; j >= 0; j--)
			dp[i][j] =
				A[i] === B[j]
					? dp[i + 1][j + 1] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
	const rows: { t: string; s: string }[] = [];
	let i = 0;
	let j = 0;
	while (i < A.length && j < B.length) {
		if (A[i] === B[j]) {
			rows.push({ t: " ", s: A[i] });
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			rows.push({ t: "-", s: A[i++] });
		} else {
			rows.push({ t: "+", s: B[j++] });
		}
	}
	while (i < A.length) rows.push({ t: "-", s: A[i++] });
	while (j < B.length) rows.push({ t: "+", s: B[j++] });
	return rows;
}

function paneHtml(label: string, html: string | null, err: string | null) {
	const pane = el("div", { className: "pane" }, el("label", { text: label }));
	if (err) {
		pane.classList.add("err");
		pane.append(el("div", { className: "diag", textContent: `抛错：${err}` }));
	} else if (html) {
		pane.append(el("div", { className: "render", innerHTML: html }));
		pane.append(
			el(
				"details",
				{},
				el("summary", { text: "MathML" }),
				el("pre", { className: "ml", textContent: html }),
			),
		);
	} else pane.append(el("div", { className: "muted", textContent: "（无）" }));
	return pane;
}

// HTML 按标签折行，diff 才有可读的行粒度
function prettyHtml(html: string | null, err: string | null) {
	if (err) return `抛错：${err}`;
	return (html || "").replace(/></g, ">\n<");
}

function viewChanges() {
	main.className = "single";
	main.textContent = "";

	if (!state.changes) {
		const box = el(
			"div",
			{ className: "card" },
			el("h3", { textContent: "变更（HEAD → 工作区）" }),
			state.changesError
				? el("div", { className: "diag", textContent: state.changesError })
				: el("div", {
						className: "muted",
						textContent: state.changesBusy
							? "正在 import HEAD 版 src 并渲染 412 例 × 2 …"
							: "对比 = 页面里跑两份代码：HEAD 版（git 导出）与工作区版，同一语料各渲染一遍逐例比输出。无入库清单，每次进本页现场算。",
					}),
			el("button", {
				textContent: state.changesBusy ? "计算中…" : "开始计算",
				onclick: async () => {
					await ensureChanges(true);
					renderApp();
				},
			}),
		);
		main.append(box);
		if (!state.changesBusy && !state.changesError) {
			// 进本页就自动算一次（412 例 × 2 次渲染，通常 <1s）
			ensureChanges().then(() => renderApp());
		}
		return;
	}

	const c = state.changes;
	const changed = c.items.filter((i) => i.status === "changed");
	// 变更可能上百条：diff 行懒加载，首屏限量渲染
	const CAP = 100;
	const pick = (status: string) => {
		let l = status ? c.items.filter((i) => i.status === status) : c.items;
		if (state.ids) l = l.filter((i) => state.ids?.has(i.id));
		return l;
	};
	const defaultStatus = state.onlyChanged || changed.length ? "changed" : "";
	let filtered = pick(defaultStatus);

	const box = el("div");
	const note = el("div", { className: "muted" });
	const render = () => {
		io.disconnect();
		for (const u of blobUrls.splice(0)) URL.revokeObjectURL(u);
		const shown = filtered.slice(0, CAP);
		note.textContent =
			filtered.length > CAP
				? `显示前 ${CAP} / ${filtered.length} 条（用状态过滤或 ?ids=a,b 精确定位）`
				: `${filtered.length} 条`;
		box.textContent = "";
		for (const it of shown) {
			const src = state.cases.find((x) => x.id === it.id);
			const tp = src ? paneTypst(src) : null;
			const diff = el("details", {}, el("summary", { text: "输出 diff" }));
			diff.addEventListener("toggle", () => {
				if (diff.dataset.built || !diff.open) return;
				diff.dataset.built = "1";
				diff.append(
					...diffLines(
						prettyHtml(it.oldHtml, it.oldError),
						prettyHtml(it.newHtml, it.newError),
					).map((r) =>
						el("div", {
							className: `diffrow ${r.t === "+" ? "add" : r.t === "-" ? "del" : ""}`,
							textContent: `${r.t} ${r.s}`,
						}),
					),
				);
			});
			const card = el(
				"div",
				{ className: "card" },
				el(
					"div",
					{ className: "chead" },
					el("span", { className: "id", textContent: it.id }),
					el("span", {
						className: it.status === "changed" ? "badge dif" : "badge",
						textContent: it.status,
					}),
					el("span", { className: "badge", textContent: it.cat }),
					...(tp
						? [
								el("button", {
									textContent: "载入 typst 图",
									onclick: () =>
										(tp as HTMLElement & { load: () => void }).load(),
								}),
							]
						: []),
					src
						? el("button", {
								textContent: "在语料中查看",
								onclick: () => {
									state.tab = "corpus";
									state.ids = new Set([it.id]);
									state.cat = "";
									syncUrl();
									renderApp();
								},
							})
						: el("span", {
								className: "muted",
								textContent: "（语料中已不存在）",
							}),
				),
				src
					? el("pre", { className: "src", textContent: src.text })
					: document.createTextNode(""),
				el(
					"div",
					{ className: src ? "panes three" : "panes" },
					paneHtml(`HEAD ${c.sha.slice(0, 8)} 渲染`, it.oldHtml, it.oldError),
					paneHtml("工作区渲染", it.newHtml, it.newError),
					...(tp ? [tp] : []),
				),
				diff,
			);
			box.append(card);
		}
	};

	const statusSel = el("select") as HTMLSelectElement;
	for (const [v, label] of [
		["changed", "仅变更"],
		["same", "仅未变"],
		["", "全部"],
	] as [string, string][]) {
		statusSel.append(
			el("option", {
				value: v,
				textContent: label,
			} as Partial<HTMLOptionElement>),
		);
	}
	statusSel.value = defaultStatus;
	statusSel.onchange = () => {
		state.onlyChanged = statusSel.value === "changed";
		filtered = pick(statusSel.value);
		render();
	};

	main.append(
		el(
			"div",
			{ className: "card" },
			el("h3", { textContent: `变更（HEAD ${c.sha.slice(0, 8)} → 工作区）` }),
			el("div", {
				className: "muted",
				textContent:
					"旧 = HEAD 版 src 在本页运行的结果，新 = 工作区 src 运行的结果，同一语料各渲染一遍逐例比输出。结果现算现比，不入库。",
			}),
			c.dirty.length
				? el("div", {
						className: "diag",
						textContent: `工作区 src 未提交改动：\n${c.dirty.join("\n")}`,
					})
				: document.createTextNode(""),
			el("div", {
				className: "muted",
				textContent: `差异 ${changed.length} · 未变 ${c.items.length - changed.length} · 算于 ${c.generatedAt}`,
			}),
			el(
				"div",
				{ className: "toolbar" },
				statusSel,
				loadAllTypstButton(() => box),
				el("button", {
					textContent: "重新计算",
					onclick: async () => {
						await ensureChanges(true);
						renderApp();
					},
				}),
				el("button", {
					textContent: "清除 ids 过滤",
					onclick: () => {
						state.ids = null;
						syncUrl();
						viewChanges();
					},
				}),
			),
			note,
			state.ids
				? el("div", {
						className: "muted",
						textContent: `仅显示：${[...state.ids].join(", ")}`,
					})
				: document.createTextNode(""),
		),
		box,
	);
	render();
}

// ---- 外壳 ----
function renderTabs() {
	tabsEl.textContent = "";
	const nCh = state.changes?.items.filter((i) => i.status === "changed").length;
	for (const [name, label] of [
		["corpus", "语料对照"],
		["custom", "自定义"],
		[
			"changes",
			`变更${state.changes ? `（${nCh}）` : state.changesBusy ? "（…）" : ""}`,
		],
	] as [string, string][]) {
		const b = el("button", { textContent: label });
		b.setAttribute("aria-selected", String(state.tab === name));
		b.onclick = () => {
			state.tab = name;
			syncUrl();
			renderApp();
		};
		tabsEl.append(b);
	}
}

function renderApp() {
	renderTabs();
	if (state.tab === "custom") viewCustom();
	else if (state.tab === "changes") viewChanges();
	else viewCorpus();
	if (state.dupIds.length) {
		main.insertAdjacentElement(
			"afterbegin",
			el("div", {
				className: "diag",
				textContent: `math.json 里 id 重合（同 id 多条，?ids= 过滤与按 id 查找会张冠李戴）：${state.dupIds.join("、")}`,
			}),
		);
	}
}

async function loadState() {
	const s = await api("/state");
	state.config = s.config || state.config;
	state.cases = corpus.cases as Case[];
	// id 重合检查：math.json 是手工维护的，撞 id 会让 ?ids= 过滤和按 id 查找张冠李戴
	const seen = new Map<string, number>();
	for (const c of state.cases) seen.set(c.id, (seen.get(c.id) || 0) + 1);
	state.dupIds = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
	byId("typst-badge").textContent =
		`typst ${state.config.typst}${state.oldtypst ? ` vs ${state.oldtypst}` : ""} · ${state.config.dpi}dpi`;
	const ua = navigator.userAgent;
	byId("ua-badge").textContent = /Firefox\//.test(ua)
		? "Firefox"
		: /Chrome\//.test(ua)
			? "Chromium（mover 组合标记有已知差异）"
			: ua.slice(0, 30);
}

await loadState();
renderApp();
