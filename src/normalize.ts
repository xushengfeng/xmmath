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
const limits_sy = [
	"∏",
	"∐",
	"∑",
	"⋀",
	"⋁",
	"⋂",
	"⋃",
	"⨀",
	"⨁",
	"⨂",
	"⨃",
	"⨄",
	"⨅",
	"⨆",
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
	if (list.length === 1 && list[0].type === "group")
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

function is_limit(tree: tree) {
	if (tree.length === 1) {
		const x = tree[0];
		if (x.type === "f") {
			if (limits_f.includes(x.value)) {
				return true;
			}
			if (x.value.split(".").at(0) === "arrow") return true;
			for (const i of opl) {
				if (i.limits && x.value === i.id) {
					return true;
				}
			}
			if (x.value === "scripts") return false;
			if (x.value === "limits") return true;
			if (x.value === "op") {
				const { dic } = f_attr(x);
				return is_true(dic.limits);
			}
		}
		if (x.type === "v" && limits_sy.includes(x.value)) {
			return true;
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

function ast3(tree: tree) {
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
	// 处理后面直接跟参数的f
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const x = tree[n];
			if (x.type === "v" && direct_arg_sy.includes(x.value) && tree[n + 1]) {
				x.type = "f";
				if (!(is_type(tree[n + 1], "group") && tree[n + 1].kh === "()")) {
					t.push(x);
					t.push({
						type: "group",
						children: [tree[n + 1]],
						value: "",
						kh: "()",
					});
					n++;
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
			if (x.type === "f" && x.value !== "prime" && next && next.type === "group") {
				if (next.kh === "()") {
					x.children = tree[n + 1].children;
					t.push(x);

					// 不处理group
					n++;
					continue;
				} else {
					if (next.kh[0] === "(") {
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

	// '->^'
	{
		const t: tree = [];
		for (let n = 0; n < tree.length; n++) {
			const next = tree[n + 1];
			const x = tree[n];
			let nn = n + 1;
			if (eqq(next, { type: "f", value: "prime" })) {
				while (tree[nn] && eqq(tree[nn], { type: "f", value: "prime" })) nn++;
				const primes = nn - (n + 1);
				if (!is_sup(x) && !is_sub(x) && x.type !== "blank") {
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
					t.push(x);
					for (let i = 0; i < primes; i++)
						t.push({ type: "f", value: "prime" });
				}
				n += primes;
				continue;
			}
			t.push(x);
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
							const o = is_limit([tree[i - 4]])
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
							const o = is_limit([tree[i - 4]])
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
							const o = is_limit([tree[i - 2]])
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
							const o = is_limit([tree[i - 2]])
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

function f_attr(x: tree[0]) {
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
		dic[n] = ast3(ast2(t));
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
