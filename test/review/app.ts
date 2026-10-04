// review 页：语料对照（我方渲染 vs typst 官方图）、自定义用例、快照变更。只做对照，不记录反馈。
// 数据来自 /__review/* 中间件（test/review/plugin.mjs），渲染走 src（与快照测试同一条路径）。
import { toMMLV } from "../../src/main.js";
import { toHtml } from "../../src/vdom.js";
import corpus from "../fixtures/math.json";

type Case = { id: string; cat: string; text: string; block: boolean };
type ChangeItem = {
	id: string;
	cat: string;
	status: string;
	oldHtml: string | null;
	newHtml: string | null;
	oldError: string | null;
	newError: string | null;
	oldSnap: string | null;
	newSnap: string | null;
};

const state = {
	tab: "corpus",
	cat: "",
	search: "",
	onlyChanged: false,
	ids: null as Set<string> | null,
	cases: [] as Case[],
	changes: null as {
		summary: Record<string, unknown>;
		items: ChangeItem[];
	} | null,
	config: { typst: "", dpi: 150 },
};

const params = new URLSearchParams(location.search);
state.tab = params.get("tab") || "corpus";
state.cat = params.get("cat") || "";
state.search = params.get("q") || "";
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
		el("label", { text: "typst 官方（PNG）" }),
	);
	const load = async () => {
		if (pane.dataset.loading) return;
		pane.dataset.loading = "1";
		await slot();
		try {
			const u = `/__review/typst?text=${encodeURIComponent(c.text)}&block=${c.block ? 1 : 0}`;
			const res = await fetch(u);
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				pane.classList.replace("pending", "err");
				pane.append(
					el("div", {
						className: "diag",
						textContent: `typst 失败：${d.error || d.stderr || res.status}`,
					}),
				);
				return;
			}
			const url = trackUrl(URL.createObjectURL(await res.blob()));
			pane.classList.remove("pending");
			const img = el("img", {
				src: url,
				alt: c.id,
			} as Partial<HTMLImageElement>) as HTMLImageElement;
			// PNG 是 dpi 分辨率的位图，按 72dpi 折算成 CSS 宽度，字号就和左侧活字一致
			img.onload = () => {
				img.style.width = `${(img.naturalWidth * 72) / state.config.dpi}px`;
			};
			pane.append(img);
			const stderr = decodeURIComponent(
				res.headers.get("X-Typst-Stderr") || "",
			);
			const cache = res.headers.get("X-Typst-Cache") || "";
			const info = el("div", {
				className: "muted",
				textContent: `hash ${res.headers.get("X-Typst-Hash")?.slice(0, 8)} · ${cache}`,
			});
			pane.append(info);
			if (stderr && !/^warning: html export/.test(stderr))
				pane.append(el("div", { className: "diag", textContent: stderr }));
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
function loadAllTypstButton(scope: () => HTMLElement) {
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
		const ids = new Set(state.changes.items.map((i) => i.id));
		list = list.filter((c) => ids.has(c.id));
	}
	return list;
}

function viewCorpus() {
	main.className = "";
	main.textContent = "";
	const changedIds = new Set(state.changes?.items.map((i) => i.id) || []);

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

	const onlyChanged = el("input", {
		type: "checkbox",
		checked: state.onlyChanged,
		disabled: !changedIds.size,
	} as Partial<HTMLInputElement>);
	onlyChanged.onchange = () => {
		state.onlyChanged = onlyChanged.checked;
		renderList();
	};

	const aside = el(
		"aside",
		{},
		search,
		el(
			"label",
			{},
			onlyChanged,
			` 仅快照变更${changedIds.size ? `（${changedIds.size}）` : "（无）"}`,
		),
		list,
	);

	const body = el("section");
	const toolbar = el("div", { className: "toolbar" });
	const count = el("span", { className: "muted" });
	const batchBtn = el("button", { textContent: "预生成本列表 typst 图" });
	batchBtn.onclick = async () => {
		const items = visibleCases();
		batchBtn.setAttribute("disabled", "");
		for (let i = 0; i < items.length; i += 40) {
			batchBtn.textContent = `生成中 ${Math.min(i + 40, items.length)}/${items.length}`;
			try {
				await api("/typst-batch", { items: items.slice(i, i + 40) });
			} catch (e) {
				batchBtn.textContent = `失败：${String(e)}`;
				return;
			}
		}
		batchBtn.textContent = "已生成，重新载入即可命中缓存";
		batchBtn.removeAttribute("disabled");
	};
	toolbar.append(
		count,
		batchBtn,
		loadAllTypstButton(() => byId("cards")),
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

// ---- 视图：快照变更 ----
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

function viewChanges() {
	main.className = "single";
	main.textContent = "";
	const c = state.changes;
	if (!c) {
		main.append(
			el(
				"div",
				{ className: "card" },
				el("h3", { textContent: "快照变更" }),
				el("div", {
					className: "muted",
					textContent:
						"还没有变更清单。先运行 pnpm review:changes（可加 --base <ref> / --only id1,id2），再刷新本页。",
				}),
			),
		);
		return;
	}
	// 变更可能上百条：diff 行懒加载，首屏限量渲染
	const CAP = 100;
	let filtered = c.items;
	if (state.ids) filtered = filtered.filter((i) => state.ids?.has(i.id));

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
			const diff = el("details", {}, el("summary", { text: "快照 diff" }));
			diff.addEventListener("toggle", () => {
				if (diff.dataset.built || !diff.open) return;
				diff.dataset.built = "1";
				diff.append(
					...diffLines(it.oldSnap || "", it.newSnap || "").map((r) =>
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
					el("span", { className: "badge", textContent: it.status }),
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
					paneHtml("旧快照渲染", it.oldHtml, it.oldError),
					paneHtml("新快照渲染", it.newHtml, it.newError),
					...(tp ? [tp] : []),
				),
				diff,
			);
			box.append(card);
		}
	};

	const statusSel = el("select") as HTMLSelectElement;
	for (const s of ["", "changed", "added", "removed", "unchanged"])
		statusSel.append(
			el("option", {
				value: s,
				textContent: s || "全部状态",
			} as Partial<HTMLOptionElement>),
		);
	statusSel.onchange = () => {
		filtered = statusSel.value
			? c.items.filter((i) => i.status === statusSel.value)
			: c.items;
		if (state.ids) filtered = filtered.filter((i) => state.ids?.has(i.id));
		render();
	};

	const sm = c.summary as Record<string, number | string>;
	main.append(
		el(
			"div",
			{ className: "card" },
			el("h3", { textContent: `快照变更（基线 ${sm.base} → 工作区）` }),
			Number(sm.baselineCases) > 0
				? el("div", {
						className: "muted",
						textContent:
							"旧 = git 里已提交的快照，新 = 工作区当前预期。改代码后测试变红就 pnpm snap:update 并接受提交，基线永远在 git 里。",
					})
				: el("div", {
						className: "diag",
						textContent: `基线 ${sm.base} 里没有快照文件，全部会被算成新增。先把 test/corpus/__snapshots__/math.test.ts.snap 提交进 git（或 --base <ref>）。`,
					}),
			el("div", {
				className: "muted",
				textContent: `变更 ${sm.changed} · 新增 ${sm.added} · 删除 ${sm.removed} · 未变 ${sm.unchanged} · 生成于 ${sm.generatedAt}`,
			}),
			el(
				"div",
				{ className: "toolbar" },
				statusSel,
				loadAllTypstButton(() => box),
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
	for (const [name, label] of [
		["corpus", "语料对照"],
		["custom", "自定义"],
		[
			"changes",
			`变更${state.changes ? `（${state.changes.items.length}）` : ""}`,
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
}

async function loadState() {
	const s = await api("/state");
	state.changes = s.changes || null;
	state.config = s.config || state.config;
	state.cases = corpus.cases as Case[];
	byId("typst-badge").textContent =
		`typst ${state.config.typst} · ${state.config.dpi}dpi`;
	const ua = navigator.userAgent;
	byId("ua-badge").textContent = /Firefox\//.test(ua)
		? "Firefox"
		: /Chrome\//.test(ua)
			? "Chromium（mover 组合标记有已知差异）"
			: ua.slice(0, 30);
}

await loadState();
renderApp();
