export type vtype =
	| ""
	| "str"
	| "v"
	| "f"
	| "blank"
	| "group"
	| "group1"
	| "sharp";
export type tree = {
	type: vtype;
	value: string;
	children?: tree;
	esc?: boolean;
	kh?: string;
	src?: string;
}[];

const Segmenter = Intl.Segmenter;
const segmenter = new Segmenter("emoji", { granularity: "grapheme" });

export const init_c: { emoji: (str: string) => string } = {
	emoji: null,
};

export function ast(str: string): tree {
	const v = /[a-zA-Z]/;
	const kh = /[(){}[\]]/;
	const khl = /[({[]/;
	const khr = /[)}\]]/;
	const blank = /^[ \t\n\r]+$/;
	let type: vtype = "";
	let ignore: false | "line" | "block" = false;
	const o: tree = [];
	const p_tree: { tree: tree; close: boolean }[] = [];
	let now_tree = o;
	let tmp_str = "";

	str = str.replace(/(\\u\{[\dA-Fa-f]+\})/g, (v) => {
		const codePoint = parseInt(v.slice(3, -1), 16);
		return String.fromCodePoint(codePoint);
	});

	let strl = init_c.emoji
		? init_c.emoji(str)
		: Array.from(segmenter.segment(str)).map((w) => w.segment);
	const strl2 = [];
	for (const i of strl) {
		if (i.length > 1 && i.includes(",")) strl2.push(...i);
		else strl2.push(i);
	}
	strl = strl2;

	for (let i = 0; i < strl.length; i++) {
		const t = strl[i];
		const next = strl[i + 1];
		if (t === "/" && next === "/") ignore = "line";
		if (ignore === "line" && t === "\n") {
			ignore = false;
			continue;
		}
		if (t === "/" && next === "*") ignore = "block";
		if (ignore === "block" && t === "*" && next === "/") {
			i++;
			ignore = false;
			continue;
		}

		if (ignore) continue;

		if (type === "blank" && !t.match(blank)) {
			now_tree.push({ type, value: "" });
			type = "";
		}
		if (t === '"' && strl[i - 1] !== "\\") {
			if (type !== "str") {
				type = "str";
			} else {
				now_tree.push({ type, value: tmp_str });
				type = "";
				tmp_str = "";
			}
			continue;
		}
		if (type === "str") {
			tmp_str += t;
			continue;
		}

		if (t.match(blank)) {
			type = "blank";
		}

		if (t === "#") {
			now_tree.push({ type: "sharp", value: "" });
			continue;
		}

		if (
			type === "" &&
			(!strl[i - 1] || !strl[i - 1].match(v)) &&
			(!strl[i + 1] || !strl[i + 1].match(v)) &&
			!t.match(kh)
		) {
			now_tree.push({ type: "v", value: t });
			continue;
		}
		if (type === "" && !t.match(v) && !t.match(kh)) {
			now_tree.push({ type: "v", value: t });
			continue;
		}

		if (
			((strl[i - 1] && strl[i - 1].match(v)) ||
				(strl[i + 1] && strl[i + 1].match(v))) &&
			t.match(v)
		) {
			type = "f";
		}
		if (type === "f") {
			tmp_str += t;
		}
		if (type === "f" && (!strl[i + 1] || !strl[i + 1].match(v))) {
			now_tree.push({ type, value: tmp_str });
			type = "";
			tmp_str = "";
		}

		if (t.match(khl)) {
			if (strl[i - 1] === "\\") {
				now_tree.push({ type: "v", value: t, esc: true });
			} else {
				// 开括号一律起组，直到遇到闭括号；到行尾仍没遇到（typst
				// `math_delimited` 走到 eof 的分支）就留成未闭合组，由渲染
				// 阶段只画开括号。旧实现把未配对的开括号退化成普通字符，
				// 会让 `1/(2 (x)` 的分母只剩一个 `(`。
				p_tree.push({ tree: now_tree, close: false });
				now_tree.push({ type: "group", value: tmp_str, children: [], kh: t });
				now_tree = now_tree.at(-1).children;
				tmp_str = "";
				continue;
			}
		}
		if (t.match(khr)) {
			if (strl[i - 1] === "\\") {
				now_tree.push({ type: "v", value: t, esc: true });
			} else if (p_tree.at(-1)) {
				if (p_tree.at(-1).close === false) {
					p_tree.at(-1).close = true;
					now_tree = p_tree.at(-1).tree;
					now_tree.at(-1).kh += t;
					p_tree.pop();
				}
			} else {
				now_tree.push({ type: "v", value: t });
			}
		}
	}

	return o;
}
