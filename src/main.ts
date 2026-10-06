/// <reference types="vite/client" />

import { ast, init_c, type tree } from "./ast.js";
import {
	ast2,
	ast3,
	dh,
	emojix,
	eqq,
	f_attr,
	type fdic,
	in_kh,
	is_br,
	is_limit,
	is_true,
	opl,
	ss,
	transfer_kh,
	trim,
	v_f,
} from "./normalize.js";
import {
	createFragment,
	createMath,
	toDom,
	toHtml,
	type VEl,
	type VFragment,
} from "./vdom.js";

const mathvariant = "mathvariant";

const delimPair = {
	"(": ["(", ")"],
	"[": ["[", "]"],
	"{": ["{", "}"],
	"|": ["|", "|"],
	"||": ["‖", "‖"],
	"": ["", ""],
};

// attach 底座的 limits 是否生效。子树要等 render 才做 ast3 的「处理f」收编，
// 这里 dispatch 到 attach 时 `limits(a)` 还是 [f(limits), group(a)] 两个并列节点，
// 故先按 ast3 同样的规则收编（f 紧跟 kh === "()" 的组；prime 除外）再判定，
// 使 `limits(a)`/`scripts(a)`/`op(.., limits: #true)` 与 `_`/`^` 走同一口径。
function limits_active(base: tree, display: boolean) {
	const t: tree =
		base.length === 2 &&
		base[0].type === "f" &&
		base[0].value !== "prime" &&
		base[1].type === "group" &&
		base[1].kh === "()"
			? [{ ...base[0], children: base[1].children }]
			: base;
	return !!is_limit(t, display);
}

function delim(dic: fdic, _default: string) {
	const d = get_value(dic, "delim") as string;
	let x = "";
	if (d !== null)
		if (d === undefined) x = _default;
		else x = d;
	return delimPair[x] as [string, string];
}

const f: {
	[name: string]: (
		attr: tree[],
		dic: fdic | undefined,
		e: fonts | undefined,
		display: boolean,
	) => VEl | VFragment;
} = {
	accent: (attr: tree[], _dic: fdic, e, display) => {
		const base = createMath("mrow");
		base.append(render(attr[0], display, e));
		const a = createMath("mrow");
		a.append(render(attr[1], display, e));
		a.children[0].innerHTML = accent_match_str(a.children[0].innerHTML);
		const over = createMath("mover");
		over.setAttribute("accent", "true");
		over.append(base, a);
		return over;
	},
	attach: (attr: tree[], dic: fdic, e, display) => {
		// typst v0.11.1 attach.rs::layout_math 的「聪明定位」：
		//   let limits = base.limits().active(styles);
		//   let (t, tr) = if limits || tr.is_some() { (t, tr) } else { (None, t) };
		//   let (b, br) = if limits || br.is_some() { (b, br) } else { (None, b) };
		// 即底座 limits 不生效时 t/b 让位到右上/右下脚标位（与 `_`/`^` 同一套判定），
		// 只有 tr/br 已被占用时才留在正上/正下（外层套 mover/munder）；
		// limits 生效时 t/b 恒落正上/正下，角标仍各占自己的角。
		const d: fdic = { ...dic };
		if (!limits_active(attr[0], display)) {
			if (d.t && !d.tr) {
				d.tr = d.t;
				delete d.t;
			}
			if (d.b && !d.br) {
				d.br = d.b;
				delete d.b;
			}
		}
		const base = createMath("mrow");
		base.append(render(attr[0], display));
		let el: VEl;
		const tl = createMath("mrow");
		if (d.tl) tl.append(render(d.tl, display, e));
		const bl = createMath("mrow");
		if (d.bl) bl.append(render(d.bl, display, e));
		const tr = createMath("mrow");
		if (d.tr) tr.append(render(d.tr, display, e));
		const br = createMath("mrow");
		if (d.br) br.append(render(d.br, display, e));
		if (d.tl || d.bl || d.tr || d.br) {
			if (d.tl || d.bl) {
				el = createMath("mmultiscripts");
				el.append(base, br, tr, createMath("mprescripts"), bl, tl);
			} else if (d.tr && d.br) {
				el = createMath("msubsup");
				el.append(base, br, tr);
			} else if (d.tr) {
				el = createMath("msup");
				el.append(base, tr);
			} else {
				el = createMath("msub");
				el.append(base, br);
			}
		}
		if (d.t || d.b) {
			const uo = createMath("munderover");
			if (!el) {
				uo.append(base);
			} else {
				uo.append(el);
			}
			const t = createMath("mrow");
			if (d.t) t.append(render(d.t, display, e));
			const b = createMath("mrow");
			if (d.b) b.append(render(d.b, display, e));
			uo.append(b, t);
			el = uo;
		}
		return el;
	},
	scripts: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, e);
	},
	limits: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, e);
	},
	binom: (attr: tree[], _dic: fdic, e, display) => {
		const row = createMath("mrow");
		const a = createMath("mrow");
		a.append(render(attr[0], display, e));
		const b = createMath("mrow");
		const s: tree = [];
		for (const x of attr.slice(1)) s.push(...x, dh);
		b.append(render(s.slice(0, -1), display, e));
		const f = createMath("mfrac", null, { linethickness: "0" });
		f.append(a, b);
		const l = createMath("mo", "(");
		const r = createMath("mo", ")");
		row.append(l, f, r);
		return row;
	},
	cancel: (attr: tree[], dic: fdic, e, display) => {
		const r = createMath("mrow");
		const bg = (x: boolean) =>
			`linear-gradient(to ${
				x ? "left" : "right"
			} top, transparent 47.75%, currentColor 49.5%, currentColor 50.5%, transparent 52.25%)`;
		let s = "";
		if (is_true(dic.cross)) {
			s = `${bg(true)},${bg(false)}`;
		} else if (is_true(dic.inverted)) {
			s = bg(false);
		} else {
			s = bg(true);
		}
		r.style.backgroundImage = s;
		r.append(render(attr[0], display, e));
		return r;
	},
	cases: (attr: tree[], dic: fdic, e, display) => {
		const r = createMath("mrow");
		const d = delim(dic, "{");
		const t = f.x_table(attr, { cases: [] }, e, display) as VEl;
		const gap = (get_value(dic, "gap") as string) || "0.5em";
		t.setAttribute("rowspacing", gap);
		if (is_true(dic?.reverse)) {
			const l = createMath("mo", d[1]);
			r.append(t, l);
		} else {
			const l = createMath("mo", d[0]);
			r.append(l, t);
		}
		return r;
	},
	frac: (attr: tree[], _dic: fdic, e, display) => {
		const a = createMath("mrow");
		a.append(render(attr[0], display, e));
		const b = createMath("mrow");
		b.append(render(attr[1], display, e));
		const f = createMath("mfrac");
		f.append(a, b);
		return f;
	},
	lr: (attr: tree[], dic: fdic, e, display) => {
		const list = attr_join(attr.map((i) => transfer_kh(i)));
		const tList = trim(list);

		const size = get_value(dic, "size") as string;
		const c = render(tList, display, e);
		const row = createMath("mrow");
		row.append(c);
		if (size && size !== "auto") {
			const lm = row.children[0];
			const rm = row.children[row.children.length - 1];
			lm?.setAttribute("maxsize", size);
			lm?.setAttribute("minsize", size);
			rm?.setAttribute("maxsize", size);
			rm?.setAttribute("minsize", size);
		}
		return row;
	},
	mid: (attr: tree[], _dic: fdic) => {
		const o = createMath("mo", attr?.[0]?.[0]?.value, { stretchy: "true" });
		return o;
	},
	mat: (attr: tree[] | tree[][], dic: fdic, e, display) => {
		const d = delim(dic, "(");
		const row = createMath("mrow");
		const l = createMath("mo", d[0]);
		const r = createMath("mo", d[1]);
		const t = createMath("mtable");
		let array: tree[][];
		if ((attr[0][0] as tree[0])?.type) array = [attr as tree[]];
		else array = attr as tree[][];

		const augment = get_value(dic, "augment");
		if (augment) {
			let xa = NaN;
			let ya = NaN;
			if (typeof augment !== "object") {
				xa = Number(augment);
			} else {
				if ("hline" in augment && augment.hline)
					ya = Number((augment.hline as tree).map((i) => i.value).join(""));
				if ("vline" in augment && augment.vline)
					xa = Number((augment.vline as tree).map((i) => i.value).join(""));
			}
			if (xa < 0) xa = array[0].length + xa;
			if (ya < 0) ya = array.length + ya;

			if (ya) {
				const l: boolean[] = [];
				for (let i = 1; i < array.length; i++) l.push(i === ya);
				t.setAttribute(
					"rowlines",
					l.map((i) => (i ? "solid" : "none")).join(" "),
				);
			}
			if (xa) {
				const l: boolean[] = [];
				for (let i = 1; i < array[0].length; i++) l.push(i === xa);
				t.setAttribute(
					"columnlines",
					l.map((i) => (i ? "solid" : "none")).join(" "),
				);
			}
		}
		const gap = get_value(dic, "gap") as string;
		const rowgap = get_value(dic, "row-gap") as string;
		const colgap = get_value(dic, "column-gap") as string;
		t.setAttribute("columnspacing", colgap || gap || "0.5em");
		t.setAttribute("rowspacing", rowgap || gap || "0.5em");

		for (const i of array) {
			const tr = createMath("mtr");
			for (const j of i) {
				const td = createMath("mtd");
				td.append(render(j, display, e));
				tr.append(td);
			}
			t.append(tr);
		}
		row.append(l, t, r);
		return row;
	},
	root: (attr: tree[], _dic: fdic, e, display) => {
		const row = createMath("mrow");
		row.append(render(attr[0], display, e));
		const base = createMath("mrow");
		base.append(render(attr[1], display, e));
		const root = createMath("mroot");
		root.append(base, row);
		return root;
	},
	// msqrt（与 typst html 导出一致：<msqrt>…</msqrt>），被开方数直接作为子元素，
	// 不包 mrow、不走 mroot——空指数的 mroot 会被 MathML 校验/渲染当成错误结构。
	sqrt: (attr: tree[], _dic: fdic, e, display) => {
		const s = createMath("msqrt");
		s.append(render(attr[0], display, e));
		return s;
	},
	// display/inline/script/sscript 是局部样式（typst 的样式栈：内层覆盖外层，
	// `display(script(sum_1^2))` 仍走角标）。limits 的判定在 ast3 的「处理^_」
	// 里读 display 参数，故这里给子树 render 直接传目标值，无需保存/恢复全局
	// 标志；wrapper 用 mstyle 而不是 mrow —— MathML Core 里 displaystyle/
	// scriptlevel 是 mstyle 的属性，挂在 mrow 上浏览器会忽略（∑ 大小/脚标层级
	// 都随之失真）。嵌套多行的行对齐也跟着 display 走（见 custom.test.ts）。
	display: (attr: tree[], _dic: fdic, e) => {
		const m = createMath("mstyle", null, { displaystyle: "true" });
		m.append(render(attr[0], true, e));
		return m;
	},
	inline: (attr: tree[], _dic: fdic, e) => {
		const m = createMath("mstyle", null, {
			displaystyle: "false",
			scriptlevel: "0",
		});
		m.append(render(attr[0], false, e));
		return m;
	},
	script: (attr: tree[], _dic: fdic, e) => {
		const m = createMath("mstyle", null, {
			displaystyle: "false",
			scriptlevel: "1",
		});
		m.append(render(attr[0], false, e));
		return m;
	},
	sscript: (attr: tree[], _dic: fdic, e) => {
		const m = createMath("mstyle", null, {
			displaystyle: "false",
			scriptlevel: "2",
		});
		m.append(render(attr[0], false, e));
		return m;
	},
	upright: (attr: tree[], _dic: fdic, e, display) => {
		const r = createMath("mrow");
		r.append(render(attr[0], display, e));
		r.querySelectorAll("mi").forEach((el) => {
			if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "normal");
		});
		r.querySelectorAll("ms").forEach((el) => {
			if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "normal");
		});
		return r;
	},
	italic: (attr: tree[], _dic: fdic, e, display) => {
		const r = createMath("mrow");
		r.append(render(attr[0], display, e));
		r.querySelectorAll("mi").forEach((el) => {
			if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "italic");
		});
		r.querySelectorAll("ms").forEach((el) => {
			if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "italic");
		});
		return r;
	},
	bold: (attr: tree[], _dic: fdic, e, display) => {
		const r = createMath("mrow");
		r.style.fontWeight = "bold";
		r.append(render(attr[0], display, e));
		return r;
	},
	op: (attr: tree[], _dic: fdic, e, display) => {
		const f = createMath("mrow");
		const str = createMath("ms");
		str.append(render(attr[0], display, e));
		f.append(str);
		return f;
	},
	underline: (attr: tree[], _dic: fdic, e, display) => {
		return underover_line_f("under", attr[0], e, display);
	},
	overline: (attr: tree[], _dic: fdic, e, display) => {
		return underover_line_f("over", attr[0], e, display);
	},
	underbrace: (attr: tree[], _dic: fdic, e, display) => {
		return underover_f("under", attr[0], "⏟", attr?.[1], display, e);
	},
	overbrace: (attr: tree[], _dic: fdic, e, display) => {
		return underover_f("over", attr[0], "⏞", attr?.[1], display, e);
	},
	underbracket: (attr: tree[], _dic: fdic, e, display) => {
		return underover_f("under", attr[0], "⎵", attr?.[1], display, e);
	},
	overbracket: (attr: tree[], _dic: fdic, e, display) => {
		return underover_f("over", attr[0], "⎴", attr?.[1], display, e);
	},
	serif: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, "serif");
	},
	sans: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, "sans");
	},
	frak: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, "frak");
	},
	mono: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, "mono");
	},
	bb: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, "bb");
	},
	cal: (attr: tree[], _dic: fdic, e, display) => {
		return render(attr[0], display, "cal");
	},
	vec: (attr: tree[], dic: fdic, e, display) => {
		const d = delim(dic, "(");
		const row = createMath("mrow");
		const l = createMath("mo", d[0]);
		const r = createMath("mo", d[1]);
		const t = x_table(attr, display, e);
		const gap = (get_value(dic, "gap") as string) || "0.5em";
		t.setAttribute("rowspacing", gap);
		t.setAttribute("columnspacing", "0.5em");
		row.append(l, t, r);
		return row;
	},
	h: (attr: tree[], _dic: fdic) => {
		return createMath("mspace", "", { width: attr[0][0].value });
	},
	// 额外
	//
	x_table: (attr: tree[], dic: fdic, e, display) => {
		const t = x_table(attr, display);
		if (dic.cases) t.setAttribute("columnalign", "left");
		return t;
	},
};

// display 必填（局部模式），e/inline 保持可选；display 放第 2 位避开
// required-after-optional。inline 仅在多行入口由 render 传入（=!display），
// 其余调用点（mat/vec/cases 的单元格）不传 —— 恒按块级对齐，与上游一致。
function x_table(trees: tree[], display: boolean, e?: fonts, inline?: boolean) {
	let max = 0;
	const t = createMath("mtable");
	for (const i of trees) {
		const n = i.filter((x) => eqq(x, v_f("&"))).length;
		if (n > max) max = n;
	}
	for (const i of trees) {
		const r = createMath("mtr");

		// 按&拆分
		const result: tree[] = [[]];
		for (let n = 0; n < i.length; n++) {
			if (eqq(i[n], v_f("&"))) {
				result.push([]);
			} else {
				result.at(-1).push(i[n]);
			}
		}
		for (const i of result) {
			const d = createMath("mtd");
			r.append(d);
			d.append(render(i, display, e));
		}

		// 有 & 时围绕对齐点 right/left 交替；没有 & 时 typst 块级居中、行内贴左
		// （mat/vec 的单元格不随块/行内变化，始终居中，MathML 默认列对齐也是 center）
		const al = [];
		for (let i = 0; i <= max; i++) {
			if (max > 0) al.push(i % 2 === 0 ? "right" : "left");
			else al.push(inline ? "left" : "center");
		}
		t.setAttribute("columnalign", al.join(" "));
		t.setAttribute("columnspacing", "0");
		t.append(r);
	}
	return t;
}

// typst 把 1–4 个连续素号折成连字，5 个及以上重复 ′
function primeRun(n: number) {
	const lig = [
		ss.prime,
		ss["prime.double"],
		ss["prime.triple"],
		ss["prime.quad"],
	];
	return n <= 4 ? lig[n - 1] : ss.prime.repeat(n);
}

function op_f() {
	for (const i of opl) {
		f[i.id] = (attr: tree[], _a, e, display) => {
			const s = f.op(
				[[{ type: "str", value: i.str || i.id }]],
				{},
				e,
				display,
			);
			if (attr) {
				const f = createFragment();
				f.append(s, kh(attr_join(attr), display));
				return f;
			} else {
				return s;
			}
		};
	}
}
op_f();

const spaceConst = {
	quad: "1em",
	med: "0.222em",
	thin: "0.17em",
	thick: "0.28em",
	wide: "2em",
};

for (const i in spaceConst) {
	f[i] = (_attr, _dic, _e, display) => {
		return f.h([[{ type: "str", value: spaceConst[i] }]], null, null, display);
	};
}

function accent_match_str(c: string) {
	switch (c) {
		case "\u{0300}":
		case "`":
			return "\u{0300}";
		case "\u{0301}":
		case "´":
			return "\u{0301}";
		case "\u{0302}":
		case "^":
		case "ˆ":
			return "\u{0302}";
		case "\u{0303}":
		case "~":
		case "∼":
		case "˜":
			return "\u{0303}";
		case "\u{0304}":
		case "¯":
			return "\u{0304}";
		case "\u{0305}":
		case "-":
		case "‾":
		case "−":
			return "\u{0305}";
		case "\u{0306}":
		case "˘":
			return "\u{0306}";
		case "\u{0307}":
		case ".":
		case "˙":
		case "⋅":
			return "\u{0307}";
		case "\u{0308}":
		case "¨":
			return "\u{0308}";
		case "\u{20db}":
			return "\u{20db}";
		case "\u{20dc}":
			return "\u{20dc}";
		case "\u{030a}":
		case "∘":
		case "○":
			return "\u{030a}";
		case "\u{030b}":
		case "˝":
			return "\u{030b}";
		case "\u{030c}":
		case "ˇ":
			return "\u{030c}";
		case "\u{20d6}":
		case "←":
			return "\u{20d6}";
		case "\u{20d7}":
		case "→":
		case "⟶":
			return "\u{20d7}";
		case "\u{20e1}":
		case "↔":
		case "⟷":
			return "\u{20e1}";
		case "\u{20d0}":
		case "↼":
			return "\u{20d0}";
		case "\u{20d1}":
		case "⇀":
			return "\u{20d1}";
		default:
			return c;
	}
}

function accent_f() {
	const l = [
		"grave",
		"acute",
		"acute.double",
		"hat",
		"tilde",
		"macron",
		"breve",
		"dot",
		"dot.double",
		"dot.triple",
		"dot.quad",
		"diaer",
		"circle",
		"arrow",
		"arrow.r",
		"arrow.l",
		"arrow.l.r",
		"caron",
		"harpoon",
		"harpoon.rt",
		"harpoon.lt",
	];
	for (const i of l) {
		f[i] = (attr: tree[], _dic, e, display) => {
			const s = f.accent([attr[0], [{ type: "f", value: i }]], {}, e, display);
			return s;
		};
	}
}
accent_f();

function lr_f() {
	const l: { name: string; l: tree[0]; r: tree[0] }[] = [
		{ name: "abs", l: v_f("|"), r: v_f("|") },
		{ name: "norm", l: v_f("‖"), r: v_f("‖") },
		{ name: "floor", l: v_f("⌊"), r: v_f("⌋") },
		{ name: "ceil", l: v_f("⌈"), r: v_f("⌉") },
		{ name: "round", l: v_f("⌊"), r: v_f("⌉") },
	];
	for (const i of l) {
		f[i.name] = (attr: tree[], dic, e, display) => {
			const s = f.lr([[i.l, ...attr[0], i.r]], dic, e, display);
			return s;
		};
	}
}
lr_f();

function underover_f(
	type: "under" | "over",
	tree: tree,
	x: string,
	str: tree,
	display: boolean,
	e: fonts,
) {
	const m =
		type === "under"
			? createMath("munder", null, { accentunder: "true" })
			: createMath("mover", null, { accent: "true" });
	const base = createMath("mrow");
	base.append(render(tree, display, e));
	if (str) {
		const s = createMath("mrow");
		s.append(render(str, display, e));
		const mm = type === "under" ? createMath("munder") : createMath("mover");
		const xx = createMath("mo", x);
		mm.append(xx, s);
		m.append(base, mm);
	} else {
		const xx = createMath("mo", x);
		m.append(base, xx);
	}
	return m;
}

function underover_line_f(
	type: "under" | "over",
	tree: tree,
	e: fonts,
	display: boolean,
) {
	const m =
		type === "under"
			? createMath("munder", null, { accentunder: "true" })
			: createMath("mover", null, { accent: "true" });
	const base = createMath("mrow");
	base.append(render(tree, display, e));
	if (type === "under") base.style.borderBottom = "1px solid black";
	if (type === "over") base.style.borderTop = "1px solid black";
	m.append(base);
	return m;
}

const ff: typeof f = {
	"√": f.sqrt,
	"∛": (attr, _, e, display) =>
		f.root([[v_f("3")], attr[0]], null, e, display),
	"∜": (attr, _, e, display) =>
		f.root([[v_f("4")], attr[0]], null, e, display),
};

function kh(tree: tree, display: boolean) {
	const f = createMath("mrow");
	const l = createMath("mo");
	l.textContent = "(";
	const c = render(tree, display);
	const r = createMath("mo");
	r.textContent = ")";
	f.append(l, c, r);
	return f;
}

function lan_dic(tree: tree) {
	tree = trim(tree);
	const o = new Object();
	let key = "";
	let value: tree = [];
	tree.push(dh);
	for (let i = 0; i < tree.length; i++) {
		if (!key && tree[i].type !== "blank") {
			key = tree[i].value;
		} else {
			if (value.length) {
				if (eqq(tree[i], dh)) {
					o[key] = trim(value);
					key = "";
					value = [];
				} else value.push(tree[i]);
			} else {
				if (eqq(tree[i], v_f(":"))) {
					value.push(tree[i + 1]);
				}
			}
		}
	}
	return o;
}

function get_value(dic: fdic, o: string) {
	if (!dic?.[o]?.[0]) return undefined;
	const x = dic[o][0];
	if (x.type === "sharp") {
		if (x.value === "true") return true;
		if (x.value === "false") return false;
		if (x.value === "none") return null;
		if (x.children) {
			if (!x.children.find((v) => eqq(v, v_f(":"))))
				return x.children.map((v) => v.value).join("");
			return lan_dic(x.children);
		}
	}
	return dic[o].map((i) => i.value).join("");
}

function attr_join(attr: tree[]) {
	const t: tree = [];
	for (const i of attr) {
		t.push(...i, v_f(","));
	}
	return t.slice(0, -1);
}

type fonts = "serif" | "sans" | "frak" | "mono" | "bb" | "cal";
function font(str: string, type: fonts = "serif") {
	function index_c(c: string) {
		const l = "abcdefghijklmnopqrstuvwxyz";
		return l.indexOf(c.toLowerCase());
	}
	const map: {
		[font in "sans" | "frak" | "mono" | "bb" | "cal"]: {
			num?: string;
			up: string;
			low: string;
		};
	} = {
		sans: {
			num: "𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫",
			low: "𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓",
			up: "𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹",
		},
		frak: {
			low: "𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷",
			up: "𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ",
		},
		mono: {
			num: "𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿",
			low: "𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣",
			up: "𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉",
		},
		bb: {
			num: "𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡",
			low: "𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫",
			up: "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ",
		},
		cal: {
			low: "𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏",
			up: "𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵",
		},
	};
	if (type === "serif") return str;
	else {
		str = str.replace(/[0-9]/g, (s) => [...map[type].num][s]);
		str = str.replace(/[a-z]/g, (s) => [...map[type].low][index_c(s)]);
		str = str.replace(/[A-Z]/g, (s) => [...map[type].up][index_c(s)]);
	}
	return str;
}

function render(tree: tree, display: boolean, e?: fonts): VEl | VFragment {
	const fragment = createFragment();

	tree = ast2(tree);

	// 多行
	// 处理\ 换行
	{
		let xx = false;
		for (const n in tree) {
			const i = tree[n];
			if (is_br(i)) {
				xx = true;
				break;
			}
		}
		if (xx) {
			const trees: tree[] = [[]];
			for (let n = 0; n < tree.length; n++) {
				const i = tree[n];
				if (is_br(i)) {
					trees.push([]);
				} else {
					trees.at(-1).push(i);
				}
			}
			return x_table(trees, display, undefined, !display);
		}
	}

	// 单行

	tree = ast3(tree, display);

	{
		const t: tree = [];
		for (const x of tree) {
			// 移除&
			if (!(x.type === "v" && x.value === "&" && !x.esc)) {
				t.push(x);
			}
		}
		tree = t;
	}

	// 移除group1
	{
		const t: tree = [];
		for (const x of tree) {
			if (x.type === "group1") {
				t.push(...x.children);
			} else {
				t.push(x);
			}
		}
		tree = t;
	}

	for (const i in tree) {
		const n = Number(i);
		const x = tree[n];

		// 函数
		if (x.type === "f") {
			// 带有括号（参数）的函数
			if (x.children && (x.kh === "()" || !x.kh)) {
				const { attr, dic } = f_attr(x, display);

				if (f[x.value]) {
					const el = f[x.value](attr as tree[], dic, e, display);
					fragment.append(el);
				} else if (ss[x.value]) {
					const el = createMath("mi", ss[x.value]);
					fragment.append(el, render(in_kh(x.children), display, e));
				} else if (ff[x.value]) {
					const el = ff[x.value](attr as tree[], dic, e, display);
					fragment.append(el);
				}
			} else {
				if (ss[x.value]) {
					let tag: keyof MathMLElementTagNameMap;
					let space_w = null;
					const space_width = {
						" ": "0.36em",
						"\u2002": "0.5em",
						"\u2003": "1em",
						"\u2004": "0.333em",
						"\u2005": "0.25em",
						"\u2006": "0.166em",
						"\u205f": "0.222em",
						"\u2007": "1ch",
						"\u2008": "0.27em",
						"\u2009": "0.17em",
						"\u200a": "0.09em",
					};
					if (ss[x.value].match(/[a-zA-Z\u0391-\u03C9]/)) {
						tag = "mi";
					} else if (space_width[ss[x.value]]) {
						tag = "mspace";
						space_w = { width: space_width[ss[x.value]] };
					} else {
						tag = "mo";
					}
					const el = createMath(tag, ss[x.value], space_w);
					fragment.append(el);
				} else if (f[x.value]) {
					const el = f[x.value](null, null, e, display);
					fragment.append(el);
				} else if (ff[x.value]) {
					const el = ff[x.value]([x.children], null, e, display);
					fragment.append(el);
				}
			}
		}

		if (x.type === "str") {
			const el = createMath("ms", font(x.value, e));
			fragment.append(el);
		}

		if (x.type === "v" || x.type === "sharp") {
			let tag: keyof MathMLElementTagNameMap;
			let value = x.value;
			if (x.value.match(/[0-9.]+/)) {
				tag = "mn";
			} else if (x.value.match(/[a-zA-Z\u0391-\u03C9]/)) {
				tag = "mi";
			} else if (x.value.match(/^'+$/)) {
				if (!x.esc) value = primeRun(x.value.length);
				tag = "mo";
			} else {
				tag = "mo";
			}
			if (x.type === "sharp") {
				if (x.value.startsWith("emoji.")) {
					tag = "mi";
					value = emojix[x.value.replace("emoji.", "")];
				}
			}
			const el = createMath(tag, font(value, e));
			fragment.append(el);
		}

		if (x.type === "group") {
			// 未闭合组：typst 只剩开括号（math_delimited 走到行尾没等到闭括号），
			// 不再包一层 mrow（typst 同样平铺，由外层需要单个元素时才包，
			// 比如 mfrac 的分母），开括号也不参与拉伸。
			if (x.kh && x.kh.length === 1) {
				fragment.append(createMath("mo", x.kh, { stretchy: "false" }));
				fragment.append(render(x.children, display, e));
			} else {
				fragment.append(f.lr([[x]], null, e, display));
			}
		}
	}

	return fragment;
}

function init(p: { emoji: boolean }) {
	for (const i in p) {
		if (init_c[i]) init_c[i] = p[i];
	}
}

// Build the MathML virtual DOM (no `document`).
// display 是整条公式的起点：由 inline 推导（!inline），再穿过 render →
// ast3/f_attr/is_limit；display/inline/script/sscript 局部样式在子树处覆写。
function toMMLV(str: string, inline?: boolean): VEl {
	const obj = ast(str);

	const mathEl = createMath("math");
	if (!inline) mathEl.setAttribute("display", "block");
	const f = render(obj, !inline);
	mathEl.append(f);
	return mathEl;
}

// Materialize to real MathML DOM (the only path that touches `document`).
function toMML(str: string, inline?: boolean): MathMLElement {
	return toDom(toMMLV(str, inline)) as MathMLElement;
}

// String MathML (DOM-free)。inline=true 输出行内（无 display 属性），默认块级。
function toMMLHTML(str: string, inline?: boolean) {
	return toHtml(toMMLV(str, inline));
}

const version = {
	lan: "0.11.1",
	symbol: "0.15.1",
	emoji: "0.15.1",
};

export { ast2, ast3, init, toMML, toMMLHTML, toMMLV, version };
