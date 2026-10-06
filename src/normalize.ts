// 归一化阶段：分词树(ast)之后的语义处理，全部为纯数据操作，不依赖 DOM。
import type { tree, vtype } from "./ast.js";
import emoji from "./emoji.json?raw";
import symbols from "./symbols.json?raw";

type fdic = { [id: string]: tree };

/** @see https://github.com/typst/codex/blob/v0.3.0/src/modules/sym.txt (typst v0.15.1) */
const s = JSON.parse(symbols);

// symbols路径简写
function simple_dot(s: any) {
	const ss: { [id: string]: string } = {};
	for (const i in s) {
		if (typeof s[i] === "string") {
			ss[i] = s[i];
		} else {
			for (const objOrStr of s[i]) {
				// 第二层的array
				if (typeof objOrStr === "string") {
					ss[i] = objOrStr;
				} else {
					if (!ss[i]) ss[i] = objOrStr[Object.keys(objOrStr)[0]];
					for (const j in objOrStr) {
						// 第三层的obj
						ss[`${i}.${j}`] = objOrStr[j];
						// 允许部分索引，但要保证唯一
						const l = j.split(".");
						for (let n = 1; n < l.length; n++) {
							const shotKey = l.slice(0, n).join(".");
							if (!objOrStr[shotKey]) {
								ss[`${i}.${shotKey}`] = objOrStr[j];
							}
						}
					}
				}
			}
		}
	}
	return ss;
}
const ss = simple_dot(s);

/** @see https://github.com/typst/codex/blob/v0.3.0/src/modules/emoji.txt (typst v0.15.1) */
const emojix = simple_dot(JSON.parse(emoji));

const shorthand = {
	"->": "arrow.r",
	"|->": "arrow.r.bar",
	"=>": "arrow.r.double",
	"|=>": "arrow.r.double.bar",
	"==>": "arrow.r.double.long",
	"-->": "arrow.r.long",
	"~~>": "arrow.r.long.squiggly",
	"~>": "arrow.r.squiggly",
	">->": "arrow.r.tail",
	"->>": "arrow.r.twohead",
	"<-": "arrow.l",
	"<==": "arrow.l.double.long",
	"<--": "arrow.l.long",
	"<~~": "arrow.l.long.squiggly",
	"<~": "arrow.l.squiggly",
	"<-<": "arrow.l.tail",
	"<<-": "arrow.l.twohead",
	"<->": "arrow.l.r",
	"<=>": "arrow.l.r.double",
	"<==>": "arrow.l.r.double.long",
	"<-->": "arrow.l.r.long",
	"*": "convolve",
	"||": "bar.v.double",
	"[|": "bracket.l.stroked",
	"|]": "bracket.r.stroked",
	":=": "colon.eq",
	"::=": "colon.double.eq",
	"--": "dash.en",
	"---": "dash.em",
	"...": "dots.h",
	"=:": "eq.colon",
	"!=": "eq.not",
	">>": "gt.double",
	">=": "gt.eq",
	">>>": "gt.triple",
	"-?": "hyph.soft",
	"<<": "lt.double",
	"<=": "lt.eq",
	"<<<": "lt.triple",
	"-": "minus",
	"'": "prime",
	"~": "space.nobreak",
};
let max_shorthand_len = 0;
for (const i in shorthand) {
	if (i.length > max_shorthand_len) {
		max_shorthand_len = i.length;
	}
}

// 直接跟参数的符号（分词归一化用；渲染实现见 main 的 ff，需与这里的键保持一致）
const direct_arg_sy = ["√", "∛", "∜"];

const opl: { id: string; str?: string; limits?: boolean }[] = [
	{ id: "arccos" },
	{ id: "arcsin" },
	{ id: "arctan" },
	{ id: "arg" },
	{ id: "cos" },
	{ id: "cosh" },
	{ id: "cot" },
	{ id: "ctg" },
	{ id: "coth" },
	{ id: "csc" },
	{ id: "csch" },
	{ id: "deg" },
	{ id: "det", limits: true },
	{ id: "dim" },
	{ id: "exp" },
	{ id: "gcd", limits: true },
	{ id: "hom" },
	{ id: "mod" },
	{ id: "id" },
	{ id: "im" },
	{ id: "inf", limits: true },
	{ id: "ker" },
	{ id: "lg" },
	{ id: "lim", limits: true },
	{ id: "ln" },
	{ id: "log" },
	{ id: "max", limits: true },
	{ id: "min", limits: true },
	{ id: "Pr", limits: true },
	{ id: "sec" },
	{ id: "sech" },
	{ id: "sin" },
	{ id: "sinc" },
	{ id: "sinh" },
	{ id: "sup", limits: true },
	{ id: "tan" },
	{ id: "tg" },
	{ id: "tr" },
	{ id: "tanh" },
	{ id: "liminf", str: "lim inf", limits: true },
	{ id: "limsup", str: "lim sup", limits: true },
	{ id: "dif", str: "d" },
	{ id: "Dif", str: "D" },
];

const limits_f = [];

// 官方核对（typst v0.11.1；语法解析一律以 0.11.1 为准）：
// 依据 typst v0.11.1 `crates/typst/src/math/attach.rs::Limits::for_char` —— 底座字符的 Unicode
// 数学类为 Relation 时 `Limits::Always`（`_`/`^` 落正上/正下，与 display 无关）；Large 类为
// `Limits::Display`（积分特例 Never）；其余一律 scripts。类表即 v0.11.1 Cargo.lock 锁定的
// unicode-math-class 0.1.0（Unicode MathClass-15.txt，REVISION 15）。
// 注意：typst 会在 fragment.rs::Glyph::with_id 里把 ':' 特例成 Relation、把 '⋯'/'⋮'/'⋱'/'⋰' 特例成
// Normal，但那只改间距用的 class；limits 查的是 for_char 里未经特例的原始类，故 ':' 仍走 scripts。
// 实测核对（2026-10-05）：rel_names ∪ 官方全部 Relation 名共 426 个字符，用 v0.11.1 二进制
// `measure()` 量帧宽差 —— limits 取 max(底座, 附着) 宽、scripts 另加 space_after_script，
// 故 d = a - w - wref 在 limits 时 ≈ -(w+space) < -w/2、scripts 时 ≈ 0；实测 425 个 Relation 全走
// limits（ratio ≥ 2.07）、唯一非 Relation 的 ':' 全走 scripts（ratio 0.00），与类表 100% 吻合。
// 据此修正：移除误写的 `colon`，补入 22 项漏写的官方 Relation（bag*/bot/bowtie/dots*/
// harpoon(s)/mustache*/or.dot/parallel.slanted/prec.curly/succ.curly/tack/tack.t/tilde）。
// `arrow.*` 官方同为 Relation，但由下面 is_limit 的前缀规则覆盖，不在此列；
// `arrows.*` 前缀不同（split('.')[0] 是 "arrows"），必须靠本表生效。
// 版本敏感：同一探针在 typst 0.15.1 上已漂移 11 个字符 —— `:` 由 scripts 翻成 limits、
// ⟆⊥⋯⋱⋰⋮⎱⟇（8 个）由 limits 翻成 scripts、⟅⎰ 直接禁止附角标；故升级 typst 属"版本升级任务"，
// 必须用新版本二进制重跑核对；平时 symbols.json 随 0.15.1 增长，本表判定仍按 0.11.1。
// 本表按 名称 -> 字符 -> 官方类 三段判定，名称集来自 symbols.json（codex v0.15.1），
// 上游新增 Relation 名时需同步补入本表。
const rel_names = new Set([
	"angle.azimuth",
	"angzarr",
	"approx",
	"approx.eq",
	"approx.hat",
	"approx.not",
	"arrows.bb",
	"arrows.bt",
	"arrows.ll",
	"arrows.lll",
	"arrows.lr",
	"arrows.rl",
	"arrows.rr",
	"arrows.rrr",
	"arrows.tb",
	"arrows.tt",
	"asymp",
	"asymp.not",
	"bag",
	"bag.l",
	"bag.r",
	"because",
	"bot",
	"bowtie",
	"bowtie.filled",
	"bowtie.filled.l",
	"bowtie.filled.r",
	"bowtie.stroked",
	"colon.double",
	"colon.double.eq",
	"colon.eq",
	"dagger",
	"dagger.double",
	"dash.colon",
	"divides",
	"divides.not",
	"divides.not.rev",
	"divides.struck",
	"dots",
	"dots.down",
	"dots.h.c",
	"dots.up",
	"dots.v",
	"eq",
	"eq.ast",
	"eq.colon",
	"eq.def",
	"eq.delta",
	"eq.dot",
	"eq.dots",
	"eq.dots.down",
	"eq.dots.up",
	"eq.equi",
	"eq.est",
	"eq.gt",
	"eq.lt",
	"eq.m",
	"eq.not",
	"eq.prec",
	"eq.quad",
	"eq.quest",
	"eq.star",
	"eq.succ",
	"eq.triple",
	"eq.triple.not",
	"equiv",
	"equiv.not",
	"forces",
	"forces.not",
	"frown",
	"gt",
	"gt.approx",
	"gt.arc",
	"gt.arc.eq",
	"gt.closed",
	"gt.closed.eq",
	"gt.closed.eq.not",
	"gt.closed.not",
	"gt.dot",
	"gt.double",
	"gt.double.nested",
	"gt.eq",
	"gt.eq.lt",
	"gt.eq.not",
	"gt.eq.slant",
	"gt.equiv",
	"gt.lt",
	"gt.lt.not",
	"gt.napprox",
	"gt.neq",
	"gt.nequiv",
	"gt.not",
	"gt.ntilde",
	"gt.quest",
	"gt.tilde",
	"gt.tilde.not",
	"gt.tri",
	"gt.tri.eq",
	"gt.tri.eq.not",
	"gt.tri.not",
	"gt.triple",
	"gt.triple.nested",
	"harpoon",
	"harpoon.bl",
	"harpoon.bl.bar",
	"harpoon.bl.stop",
	"harpoon.br",
	"harpoon.br.bar",
	"harpoon.br.stop",
	"harpoon.lb",
	"harpoon.lb.bar",
	"harpoon.lb.rb",
	"harpoon.lb.rt",
	"harpoon.lb.stop",
	"harpoon.lt",
	"harpoon.lt.bar",
	"harpoon.lt.rb",
	"harpoon.lt.rt",
	"harpoon.lt.stop",
	"harpoon.rb",
	"harpoon.rb.bar",
	"harpoon.rb.stop",
	"harpoon.rt",
	"harpoon.rt.bar",
	"harpoon.rt.stop",
	"harpoon.tl",
	"harpoon.tl.bar",
	"harpoon.tl.bl",
	"harpoon.tl.br",
	"harpoon.tl.stop",
	"harpoon.tr",
	"harpoon.tr.bar",
	"harpoon.tr.bl",
	"harpoon.tr.br",
	"harpoon.tr.stop",
	"harpoons",
	"harpoons.blbr",
	"harpoons.bltr",
	"harpoons.lbrb",
	"harpoons.ltlb",
	"harpoons.ltrb",
	"harpoons.ltrt",
	"harpoons.rblb",
	"harpoons.rtlb",
	"harpoons.rtlt",
	"harpoons.rtrb",
	"harpoons.tlbr",
	"harpoons.tltr",
	"image",
	"in",
	"in.not",
	"in.rev",
	"in.rev.not",
	"in.rev.small",
	"in.small",
	"lat",
	"lat.eq",
	"lt",
	"lt.approx",
	"lt.arc",
	"lt.arc.eq",
	"lt.closed",
	"lt.closed.eq",
	"lt.closed.eq.not",
	"lt.closed.not",
	"lt.dot",
	"lt.double",
	"lt.double.nested",
	"lt.eq",
	"lt.eq.gt",
	"lt.eq.not",
	"lt.eq.slant",
	"lt.equiv",
	"lt.gt",
	"lt.gt.not",
	"lt.napprox",
	"lt.neq",
	"lt.nequiv",
	"lt.not",
	"lt.ntilde",
	"lt.quest",
	"lt.tilde",
	"lt.tilde.not",
	"lt.tri",
	"lt.tri.eq",
	"lt.tri.eq.not",
	"lt.tri.not",
	"lt.triple",
	"lt.triple.nested",
	"mapsfrom",
	"mapsfrom.long",
	"mapsto",
	"mapsto.long",
	"minus.tilde",
	"models",
	"multimap",
	"multimap.double",
	"mustache",
	"mustache.l",
	"mustache.r",
	"or.dot",
	"original",
	"parallel",
	"parallel.eq",
	"parallel.equiv",
	"parallel.not",
	"parallel.slanted",
	"parallel.slanted.eq",
	"parallel.slanted.eq.tilde",
	"parallel.slanted.equiv",
	"parallel.struck",
	"parallel.tilde",
	"perp",
	"plus.o.arrow",
	"prec",
	"prec.approx",
	"prec.curly",
	"prec.curly.eq",
	"prec.curly.eq.not",
	"prec.double",
	"prec.eq",
	"prec.equiv",
	"prec.napprox",
	"prec.neq",
	"prec.nequiv",
	"prec.not",
	"prec.ntilde",
	"prec.tilde",
	"prop",
	"ratio",
	"semi.rev",
	"smile",
	"smt",
	"smt.eq",
	"subset",
	"subset.approx",
	"subset.closed",
	"subset.closed.eq",
	"subset.dot",
	"subset.double",
	"subset.eq",
	"subset.eq.dot",
	"subset.eq.not",
	"subset.eq.sq",
	"subset.eq.sq.not",
	"subset.equiv",
	"subset.neq",
	"subset.nequiv",
	"subset.not",
	"subset.plus",
	"subset.sq",
	"subset.sq.neq",
	"subset.tilde",
	"subset.times",
	"succ",
	"succ.approx",
	"succ.curly",
	"succ.curly.eq",
	"succ.curly.eq.not",
	"succ.double",
	"succ.eq",
	"succ.equiv",
	"succ.napprox",
	"succ.neq",
	"succ.nequiv",
	"succ.not",
	"succ.ntilde",
	"succ.tilde",
	"supset",
	"supset.approx",
	"supset.closed",
	"supset.closed.eq",
	"supset.dot",
	"supset.double",
	"supset.eq",
	"supset.eq.dot",
	"supset.eq.not",
	"supset.eq.sq",
	"supset.eq.sq.not",
	"supset.equiv",
	"supset.neq",
	"supset.nequiv",
	"supset.not",
	"supset.plus",
	"supset.sq",
	"supset.sq.neq",
	"supset.tilde",
	"supset.times",
	"tack",
	"tack.b.double",
	"tack.b.short",
	"tack.bb",
	"tack.l",
	"tack.l.double",
	"tack.l.long",
	"tack.l.r",
	"tack.l.short",
	"tack.ll",
	"tack.r",
	"tack.r.double",
	"tack.r.double.not",
	"tack.r.long",
	"tack.r.not",
	"tack.r.short",
	"tack.rr",
	"tack.rr.not",
	"tack.rrr",
	"tack.t",
	"tack.t.double",
	"tack.t.short",
	"tack.tt",
	"therefore",
	"tilde",
	"tilde.dot",
	"tilde.eq",
	"tilde.eq.not",
	"tilde.eq.rev",
	"tilde.equiv",
	"tilde.equiv.not",
	"tilde.nequiv",
	"tilde.not",
	"tilde.op",
	"tilde.rev",
	"tilde.rev.equiv",
	"tilde.triple",
]);
// 大算符：0.11.1 实测 inline 走角标、block(display) 才走上下
const limits_sy = [
	// 大算符：0.11.1 实测 inline 走角标、block(display) 才走上下
	"∏",
	"∐",
	"∑",
	"⋀",
	"⋁",
	"⋂",
	"⋃",
	"⟕",
	"⟖",
	"⟗",
	"⧸",
	"⨀",
	"⨁",
	"⨂",
	"⨃",
	"⨄",
	"⨅",
	"⨆",
	"⨉",
	"⨝",
	"⨼",
	"⟘",
	"⨊",
];
for (const i in ss) {
	for (const j of limits_sy) {
		if (ss[i] === j) {
			limits_f.push(i);
		}
	}
}

function out_kh(x: tree[0]) {
	if (x.type === "group") {
		if (x.kh === "()") return x.children;
		else return [x];
	} else {
		return [x];
	}
}

function transfer_kh(list: tree) {
	// 未闭合组（kh 只有开括号）原样保留：由 render 的 group 分支只画开括号，
	// 这里补 v_f(kh[1]) 会造出 value=undefined 的假右括号。
	if (list.length === 1 && list[0].type === "group" && list[0].kh.length > 1)
		list = [v_f(list[0].kh[0]), ...list[0].children, v_f(list[0].kh[1])];
	return list;
}

function in_kh(x: tree) {
	const k: tree = [{ type: "group", value: "", children: x, kh: "()" }];
	return k;
}

function is_sup(x: tree[0]) {
	return eqq(x, { type: "v", value: "^" });
}

function is_sub(x: tree[0]) {
	return eqq(x, { type: "v", value: "_" });
}

function is_frac(x: tree[0]) {
	return eqq(x, { type: "v", value: "/" });
}

function is_br(x: tree[0]) {
	return x && x.value === "br" && x.esc;
}

const rel_sy = new Set<string>();
{
	const taken = new Set<string>();
	for (const k in ss) {
		const v = ss[k];
		if (!rel_names.has(k)) {
			if (rel_sy.has(v)) taken.add(v); // 角标类符号抢占了关系类的字形
			continue;
		}
		rel_sy.add(v);
	}
	for (const c of taken) rel_sy.delete(c);
}

// display（块级/行内）是整条公式的属性：由 toMMLV 起算（`!inline`），作为参数
// 穿过 render → ast3/f_attr/is_limit；display/inline/script/sscript 这类局部样式
// 则在渲染子树时换一个值传入 —— 嵌套子树（如 lr(sum_1^2) 里的 sum）自动继承，
// 不需要全局标志（保存/恢复易漏，也做不了单点测试）。
function is_limit(tree: tree, display: boolean) {
	if (tree.length === 1) {
		const x = tree[0];
		if (x.type === "f") {
			// 只有裸符号才算子；`tilde(x)` 这类调用里 x.value 同名但不是运算符本体
			if (!x.children || x.children.length === 0) {
				if (rel_names.has(x.value)) return true;
				if (limits_f.includes(x.value)) return display;
				if (x.value.split(".").at(0) === "arrow") return true;
				for (const i of opl) {
					if (i.limits && x.value === i.id) return display;
				}
			}
			if (x.value === "scripts") return false;
			if (x.value === "limits") return true;
			if (x.value === "op") {
				const { dic } = f_attr(x, display);
				return is_true(dic.limits) && display;
			}
		}
		if (x.type === "v") {
			if (rel_sy.has(x.value)) return true;
			if (limits_sy.includes(x.value)) return display;
		}
	} else {
		return false;
	}
}

function is_dot(x: tree[0]) {
	return eq(x, { type: "v", value: "." });
}

function is_dot_f(x: tree[0]) {
	return x && (x.type === "f" || (x.type === "v" && x.value.match(/[a-z]/)));
}

function is_factorial(x: tree[0]) {
	return x && x.type === "v" && x.value === "!" && !x.esc;
}

const dh: tree[0] = { type: "v", value: "," };

function v_f(str: string): tree[0] {
	return { type: "v", value: str };
}

function eq(x0: tree[0], x1: tree[0]) {
	if (!x0 || !x1) return false;
	return x0.type === x1.type && x0.value === x1.value;
}

function eqq(x0: tree[0], x1: tree[0]) {
	if (!x0 || !x1) return false;
	return x0.type === x1.type && x0.value === x1.value && x0?.esc === x1?.esc;
}

function is_type(x: tree[0], ...type: vtype[]) {
	return type.includes(x?.type);
}

function trim(tree: tree) {
	if (!tree?.[0]) return [];
	let start = 0;
	let end = tree.length;
	if (tree[0].type === "blank") start = 1;
	if (tree.at(-1).type === "blank") end--;
	return tree.slice(start, end);
}

function dic_to_ast(dic: { [id: string]: tree }) {
	const l: tree = [];
	for (const i in dic) {
		l.push({ type: "f", value: i });
		l.push({ type: "v", value: ":" });
		for (const x of dic[i]) {
			if (eq(x, dh)) x.esc = true;
		}
		l.push(...dic[i]);
		if (Number(i) + 1 !== Object.keys(dic).length) {
			l.push(dh);
		}
	}
	return l;
}

function is_true(t: tree) {
	return eqq(trim(t)?.[0], { type: "sharp", value: "true" });
}

function ast2(tree: tree) {
	// 处理数字和小数
	{
		const t: tree = [];
		const num = /[0-9]/;
		let number = "";
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			if (
				x.value.match(num) ||
				(tree[n - 1]?.value.match(num) &&
					is_dot(x) &&
					tree[n + 1]?.value.match(num))
			) {
				number += x.value;
			} else {
				t.push(x);
			}
			if (
				x.value.match(num) &&
				(!tree[n + 1] || !tree[n + 1].value.match(num)) &&
				!(is_dot(tree[n + 1]) && tree[n + 2]?.value.match(num))
			) {
				t.push({ type: "v", value: number });
				number = "";
			}
		}
		tree = t;
	}

	// 处理\转义
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];

			if (eqq(x, v_f("\\"))) {
				if (tree?.[n + 1]) {
					const next = tree[n + 1];
					if (eq(next, v_f("\\"))) {
						t.push({ type: "v", value: "\\", esc: true });
						n++;
					} else if (next.type === "blank") {
						t.push({ type: "v", value: "br", esc: true });
						n++;
					} else if (next.type === "f") {
						const v = next.value;
						t.push({ type: "v", value: v[0] });
						t.push({ type: v.length === 2 ? "v" : "f", value: v.slice(1) });
						n++;
					} else if (next.type === "sharp") {
						t.push({ type: "v", value: "#" });
						n++;
					} else {
						const v = next;
						v.esc = true;
						t.push(v);
						n++;
					}
				}
			} else {
				t.push(x);
			}
		}
		tree = t;
	}

	return tree;
}

function ast3(tree: tree, display: boolean) {
	// 处理符号简写（shorthand）
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];

			if (!x.esc) {
				if (x.type === "v") {
					let nn = n;
					let shortkey = x.value;
					const l = [];
					if (shorthand[shortkey]) l.push(shortkey);
					// 连起来的字符
					while (
						tree?.[nn + 1]?.type === "v" &&
						shortkey.length <= max_shorthand_len
					) {
						shortkey += tree[nn + 1].value;
						if (shorthand[shortkey]) l.push(shortkey);
						nn++;
					}
					if (l.length) {
						const nx: tree[0] = {
							type: "f",
							value: shorthand[l.at(-1)],
							src: l.at(-1),
						};
						t.push(nx);

						// 不处理已经后面连起来的字符
						n += l.at(-1).length - 1;
					} else {
						t.push(x);
					}
				} else {
					t.push(x);
				}
			} else {
				t.push(x);
			}
		}
		tree = t;
	}

	// 处理字符与v之间空格
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];

			if (
				x.type === "v" &&
				tree?.[n + 1]?.type === "blank" &&
				tree?.[n + 2]?.type === "str"
			) {
				t.push(x);
				t.push({ type: "f", value: "space" });
			} else if (
				x.type === "str" &&
				tree?.[n + 1]?.type === "blank" &&
				tree?.[n + 2]?.type === "v"
			) {
				t.push(x);
				t.push({ type: "f", value: "space" });
			} else {
				t.push(x);
			}
		}
		tree = t;
	}

	// 处理!
	{
		const t: tree = [];
		let tmpx: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];

			if (
				is_factorial(tree?.[n + 1]) &&
				!is_sup(x) &&
				!is_sub(x) &&
				!is_frac(x)
			) {
				tmpx.push(x);
			} else {
				if (tmpx.length) {
					tmpx.push(x);
					t.push({ type: "group1", value: "", children: tmpx });
					tmpx = [];
				} else {
					t.push(x);
				}
			}
		}

		tree = t;
	}

	// 处理带.的f
	{
		const t: tree = [];
		let f = "";
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];

			if (is_dot_f(x) && is_dot(tree[n + 1])) {
				if (f || (!f && x.type === "f")) {
					f += `${x.value}.`;
					n++;
				} else {
					t.push(x);
				}
			} else if (f && is_dot_f(x)) {
				f += x.value;
				if (!is_dot(tree[n + 1])) {
					t.push({ type: "f", value: f });
					f = "";
				}
			} else {
				t.push(x);
			}
		}
		tree = t;
	}
	// 处理后面直接跟参数的f（√ ∛ ∜）
	// typst v0.11.1 实测：根号吃掉一个「原子」，该原子自己的附着（_/^ 与素号）都算在根号里面 ——
	// √2^3=√(2³)、√2_1^2=√(2带1带2)、√f'=√(f')、√a_1^2 b^3=√(a带1带2)·b³、∛x^2=³√(x²)；
	// 后面再接别的原子（√2 3、√a b^2）或二元运算符（√2+3）则到此为止。
	// 括号组：无附着时沿用原来的去括号路径（√(2)=√2、√(x+y) 根号直接覆盖 x+y，与 typst 一致），
	// 有附着时把整组（连括号）当基底收进参数（√(2)^3=√((2)³)，typst 同样保留括号）。
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			if (x.type === "v" && direct_arg_sy.includes(x.value) && tree[n + 1]) {
				x.type = "f";
				const next = tree[n + 1];
				// 向后吞附着链：_值、^值、素号，可混排可重复，中间允许空格
				const att: tree = [];
				let end = n + 1;
				let j = n + 2;
				for (;;) {
					let k = j;
					while (tree[k]?.type === "blank") k++;
					const y = tree[k];
					if (!y) break;
					if ((is_sup(y) || is_sub(y)) && tree[k + 1] !== undefined) {
						att.push(y, tree[k + 1]);
						end = k + 1;
						j = k + 2;
					} else if (eqq(y, { type: "f", value: "prime" })) {
						att.push(y);
						end = k;
						j = k + 1;
					} else break;
				}
				const is_paren = is_type(next, "group") && next.kh === "()";
				if (!is_paren || att.length) {
					t.push(x);
					t.push({
						type: "group",
						children: [next, ...att],
						value: "",
						kh: "()",
					});
					n = end;
					continue;
				}
			}
			t.push(x);
		}
		tree = t;
	}
	// 处理f
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			const next = tree[n + 1];

			// 带有括号（参数）的函数
			// prime 是后缀算子（稍后单独转成 attach），不能吞掉后面的 (..) 组
			if (
				x.type === "f" &&
				x.value !== "prime" &&
				next &&
				next.type === "group"
			) {
				if (next.kh === "()") {
					x.children = tree[n + 1].children;
					t.push(x);

					// 不处理group
					n++;
					continue;
				} else {
					// 未闭合的开括号组（kh 只有开括号）不能当参数收编：typst
					// 那里是 unclosed delimiter 错误，本库保持原来的并列渲染，
					// 组本身留给下一轮出栈，否则内容会被吞进 f 再渲染不出来。
					if (next.kh.length > 1 && next.kh[0] === "(") {
						// 向后找
						const tt: tree = [];
						tt.push(...next.children);
						tt.push(v_f(next.kh[1]));
						for (let i = n + 2; i < tree.length; i++) {
							if (tree[i]) {
								if (eqq(tree[i], v_f(")"))) {
									n = i;
									break;
								} else {
									tt.push(tree[i]);
								}
							}
						}
						x.children = tt;
						t.push(x);
					} else {
						t.push(x);
					}
				}
				for (const i in x.children || []) {
					if (x.children[i].value === "\\" && x.children[i].type === "v") {
						if (x.children[Number(i) + 1]) {
							x.children[Number(i) + 1].esc = true;
						}
					}
				}
			} else {
				t.push(x);
			}
		}
		tree = t;
	}

	// sin[]/2=(sin[])/2 a_i()=a_(i()) 之类的
	{
		const t: tree = [];
		const un_list_str = [
			"`",
			"~",
			"!",
			"@",
			"%",
			"*",
			"/",
			"(",
			")",
			"-",
			"+",
			"=",
			"[",
			"]",
			"{",
			"}",
			"|",
			":",
			";",
			"<",
			",",
			">",
			".",
			"?",
		]; // typst 似乎是直接排除了这些字符，不排除转义，shorthand之类的
		// `/` 也必须排除（unicode-math-class=Binary，typst continuable=false）：
		// 否则 `1/(2 (x)` 里的 `/` 会和后面的未闭合组粘成一个 token，`/` 就不再是分数算子。
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			const next = tree[n + 1];
			if (
				is_type(next, "group") &&
				next.kh !== "()" &&
				is_type(x, "f", "str", "v") &&
				!x.value.match(/[0-9]/) &&
				!is_sub(x) &&
				!is_sup(x) &&
				// `#box(...)` 的名字归下面的「处理#」（它吃 tree[n+1] 的值），
				// 这里抢先粘成 group1 会让 sharp 变成空值、名字连同参数被丢掉
				tree[n - 1]?.type !== "sharp" &&
				(!(
					(is_type(x, "f") && un_list_str.includes(x.src)) ||
					(is_type(x, "v") && un_list_str.includes(x.value))
				) ||
					x.esc)
			) {
				t.push({ type: "group1", value: "", children: [x, next] });
				n++;
				continue;
			}
			t.push(x);
		}
		tree = t;
	}

	// 处理#
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			if (x.type === "sharp") {
				if (!x.value)
					if (tree[n + 1]?.type === "group") {
						x.children = tree[n + 1].children;
						for (const i in x.children) {
							if (x.children[i].value === "\\" && x.children[i].type === "v") {
								if (x.children[Number(i) + 1]) {
									x.children[Number(i) + 1].esc = true;
								}
							}
						}
						const v = x.children.map((i) => i.value).join("");
						if (v.match(/^[0-9+\-*/()]+$/)) {
							x.value = v; // todo 数学运算
						} else {
							x.value = v;
						}
					} else {
						x.value = tree[n + 1]?.value;
						if (tree[n + 2]?.type === "f") {
							x.value += tree[n + 2].value;
							n++;
						}
					}
				t.push(x);
				n++;
			} else {
				t.push(x);
			}
		}
		tree = t;
	}

	// '->^'：素号是后缀算子，等价于 `^<素号串>`，交给后面的 ^/_ 合并逻辑处理
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			const next = tree[n + 1];
			if (!eqq(next, { type: "f", value: "prime" })) {
				t.push(x);
				continue;
			}
			let nn = n + 1;
			while (tree[nn] && eqq(tree[nn], { type: "f", value: "prime" })) nn++;
			const primes = nn - (n + 1);
			if (eqq(x, { type: "f", value: "prime" })) {
				// 整段素号前面没有基底（如 `'''''''`）：平铺成一个后缀串，不做附着
				t.push({ type: "v", value: "'".repeat(primes + 1) });
			} else if (!is_sup(x) && !is_sub(x) && x.type !== "blank") {
				t.push({
					type: "f",
					value: "attach",
					children: [
						x,
						dh,
						...dic_to_ast({
							tr: [{ type: "v", value: "'".repeat(primes) }],
						}),
					],
				});
			} else {
				t.push(x, { type: "v", value: "'".repeat(primes) });
			}
			n += primes;
		}
		tree = t;
	}

	// 移除blank
	{
		const t: tree = [];
		for (const i of tree) {
			if (i.type === "blank") continue;
			t.push(i);
		}
		tree = t;
	}

	// 处理^_
	{
		// 获取^_嵌套索引
		let index: [number, number][] = [];
		let start = NaN;
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			if (!is_sup(x) && !is_sub(x)) {
				if (
					(is_sup(tree[n + 1]) || is_sub(tree[n + 1])) &&
					!(is_sup(tree[n - 1]) || is_sub(tree[n - 1]))
				) {
					if (!start) start = n;
				}
				if (
					(is_sup(tree[n - 1]) || is_sub(tree[n - 1])) &&
					!(is_sup(tree[n + 1]) || is_sub(tree[n + 1]))
				) {
					index.push([start, n]);
					start = NaN;
				}
			}
		}

		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			if (n === index?.[0]?.[0]) {
				{
					let tmp: tree[0] = tree[index[0][1]];
					for (let i = index[0][1]; i >= index[0][0]; i--) {
						if (is_sup(tree[i - 1]) && is_sub(tree[i - 3])) {
							const o = is_limit([tree[i - 4]], display)
								? { t: out_kh(tmp), b: out_kh(tree[i - 2]) }
								: { tr: out_kh(tmp), br: out_kh(tree[i - 2]) };
							tmp = {
								type: "f",
								value: "attach",
								children: [tree[i - 4], dh, ...dic_to_ast(o)],
							};
							i -= 4 - 1;
							continue;
						}
						if (is_sub(tree[i - 1]) && is_sup(tree[i - 3])) {
							const o = is_limit([tree[i - 4]], display)
								? { t: out_kh(tree[i - 2]), b: out_kh(tmp) }
								: { tr: out_kh(tree[i - 2]), br: out_kh(tmp) };
							tmp = {
								type: "f",
								value: "attach",
								children: [tree[i - 4], dh, ...dic_to_ast(o)],
							};
							i -= 4 - 1;
							continue;
						}
						if (is_sup(tree[i - 1])) {
							const o = is_limit([tree[i - 2]], display)
								? { t: out_kh(tmp) }
								: { tr: out_kh(tmp) };
							tmp = {
								type: "f",
								value: "attach",
								children: [tree[i - 2], dh, ...dic_to_ast(o)],
							};
							i -= 2 - 1;
							continue;
						}
						if (is_sub(tree[i - 1])) {
							const o = is_limit([tree[i - 2]], display)
								? { b: out_kh(tmp) }
								: { br: out_kh(tmp) };
							tmp = {
								type: "f",
								value: "attach",
								children: [tree[i - 2], dh, ...dic_to_ast(o)],
							};
							i -= 2 - 1;
						}
					}
					t.push(tmp);
				}
				n += index[0][1] - index[0][0];
				index = index.slice(1);
				continue;
			}

			t.push(tree[n]);
		}
		tree = t;
	}

	// 处理/
	{
		// 获取/嵌套索引
		const index: [number, number][] = [];
		let start = NaN;
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			if (!is_frac(x)) {
				if (is_frac(tree[n + 1]) && !is_frac(tree[n - 1])) {
					if (!start) start = n;
				}
				if (is_frac(tree[n - 1]) && !is_frac(tree[n + 1])) {
					index.push([start, n]);
					start = NaN;
				}
			}
		}

		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			if (n === index?.[0]?.[0]) {
				{
					let tmp: tree[0] = tree[index[0][0]];
					for (let i = index[0][0]; i <= index[0][1]; i++) {
						if (is_frac(tree[i + 1])) {
							tmp = {
								type: "f",
								value: "frac",
								children: [...out_kh(tmp), dh, ...out_kh(tree[i + 2])],
							};
							i += 2 - 1;
						}
					}
					t.push(tmp);
				}
				n += index[0][1] - index[0][0];
				index.splice(0, 1);
				continue;
			}

			t.push(tree[n]);
		}
		tree = t;
	}
	return tree;
}

function f_attr(x: tree[0], display: boolean) {
	const list: (tree | "," | ";")[] = [[]];
	for (const i of x.children) {
		if (
			eqq(i, { type: "v", value: "," }) ||
			eqq(i, { type: "v", value: ";" })
		) {
			list.push(i.value as "," | ";");
			list.push([]);
		} else {
			(list.at(-1) as tree).push(i);
		}
	}
	const dicl: tree[] = [];
	const xattr: typeof list = [];
	for (const x of list) {
		if (typeof x === "string") {
			xattr.push(x);
		} else {
			if (
				x.find(
					(v, i) =>
						is_type(x[i - 1], "f", "v") && eqq(v, { type: "v", value: ":" }),
				)
			) {
				dicl.push(x);
			} else {
				xattr.push(x);
			}
		}
	}

	let nl: typeof xattr = [];
	for (let i = 0; i < xattr.length; i++) {
		const n = xattr[i],
			next = xattr[i + 1];
		if ((n === "," && next === ";") || (n === ";" && next === ",")) {
			nl.push(";");
			i++;
		} else {
			nl.push(xattr[i]);
		}
	}

	let attr: tree[] | tree[][];
	if (typeof nl.at(-1) === "string") nl = nl.slice(0, -1);
	const has_fenhao = nl.includes(";");
	if (has_fenhao) {
		let x = array_split(nl, (x) => x === ";");
		if (x.at(-1)[0].length === 0) x = x.slice(0, -1);
		attr = x.map((x) => x.filter((i) => typeof i !== "string")) as tree[][];
	} else {
		attr = (nl.filter((i) => typeof i !== "string") as tree[]).map((i) =>
			trim(i),
		);
	}

	// 将dicl的tree转为键对
	const dic: fdic = {};
	for (const i of dicl) {
		let x = false;
		let n = "";
		const t: tree = [];
		for (const el of i) {
			if (eqq(el, { type: "v", value: ":" })) {
				x = true;
				continue;
			}
			if (!x) {
				n += el.value;
			} else {
				t.push(el);
			}
		}
		dic[n] = ast3(ast2(t), display);
	}
	return { attr, dic };
}

function array_split<i>(list: i[], f: (i: i) => boolean) {
	const l: i[][] = [[]];
	for (const x of list) {
		if (f(x)) {
			l.push([]);
		} else {
			l.at(-1).push(x);
		}
	}
	return l;
}

export {
	ast2,
	ast3,
	dh,
	emojix,
	eq,
	eqq,
	f_attr,
	type fdic,
	in_kh,
	is_br,
	is_limit,
	is_true,
	is_type,
	opl,
	out_kh,
	ss,
	transfer_kh,
	trim,
	v_f,
};
