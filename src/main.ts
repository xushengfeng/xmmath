/// <reference types="vite/client" />

function createEl<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
function createEl<K extends keyof HTMLElementDeprecatedTagNameMap>(tagName: K): HTMLElementDeprecatedTagNameMap[K];
function createEl(tagName: string): HTMLElement;
function createEl(tagname: string) {
    return document.createElement(tagname);
}

function createMath<K extends keyof MathMLElementTagNameMap>(
    tagname: K,
    innerText?: string,
    attr?: { [name: string]: string }
) {
    let el = document.createElementNS("http://www.w3.org/1998/Math/MathML", tagname);
    if (innerText) el.textContent = innerText;
    if (attr) {
        for (let i in attr) {
            el.setAttribute(i, attr[i]);
        }
    }
    return el;
}

const mathvariant = "mathvariant";

const Segmenter = Intl.Segmenter;
const segmenter = new Segmenter("emoji", { granularity: "grapheme" });

type vtype = "" | "str" | "v" | "f" | "blank" | "group" | "group1" | "sharp"; // group1组合基本类型，提高优先级
type tree = { type: vtype; value: string; children?: tree; esc?: boolean }[];

function ast(str: string) {
    let v = /[a-zA-Z]/;
    let kh = /[\(\)]/;
    let blank = /[ \t\n\r]+/;
    let type: vtype = "";
    let o: tree = [];
    let p_tree: { tree: tree; close: boolean }[] = [];
    let now_tree = o;
    let tmp_str = "";

    str = str.replace(/(\\u\{[\dA-Fa-f]+\})/g, (v) => {
        const codePoint = parseInt(v.slice(3, -1), 16);
        return String.fromCodePoint(codePoint);
    });

    let lkh_stack: number[] = [];
    let rkh_stack: number[] = [];
    for (let i = 0; i < str.length; i++) {
        const t = str[i];
        // 字符
        if (t == '"' && str[i - 1] != "\\") {
            if (type != "str") {
                type = "str";
            } else {
                type = "";
            }
            continue;
        }
        if (type == "str") {
            continue;
        }

        if (t == "(") {
            lkh_stack.push(i);
        }
        if (t == ")") {
            if (lkh_stack.length == 0) {
                rkh_stack.push(i);
            } else {
                if (str[i - 1] != "\\") lkh_stack.pop();
            }
        }
    }

    let strl = init_c.emoji ? init_c.emoji(str) : Array.from(segmenter.segment(str)).map((w) => w.segment);
    let strl2 = [];
    for (let i of strl) {
        if (i.length > 1 && i.includes(",")) strl2.push(...i);
        else strl2.push(i);
    }
    strl = strl2;

    for (let i = 0; i < strl.length; i++) {
        const t = strl[i];
        // 空白
        if (type === "blank" && !t.match(blank)) {
            now_tree.push({ type, value: "" });
            type = "";
        }
        // 字符
        if (t === '"' && strl[i - 1] != "\\") {
            if (type != "str") {
                type = "str";
            } else {
                now_tree.push({ type, value: tmp_str });
                type = "";
                tmp_str = "";
            }
            continue;
        }
        if (type == "str") {
            tmp_str += t;
            continue;
        }

        // 空白
        if (t.match(blank)) {
            type = "blank";
        }

        if (t === "#") {
            now_tree.push({ type: "sharp", value: "" });
            continue;
        }

        // 原始值（字母变量、数字、符号）
        if (
            type == "" &&
            (!strl[i - 1] || !strl[i - 1].match(v)) &&
            (!strl[i + 1] || !strl[i + 1].match(v)) &&
            !t.match(kh)
        ) {
            now_tree.push({ type: "v", value: t });
            continue;
        }
        if (type == "" && !t.match(v) && !t.match(kh)) {
            now_tree.push({ type: "v", value: t });
            continue;
        }

        // 函数名
        if (((strl[i - 1] && strl[i - 1].match(v)) || (strl[i + 1] && strl[i + 1].match(v))) && t.match(v)) {
            type = "f";
        }
        if (type == "f") {
            tmp_str += t;
        }
        if (type == "f" && (!strl[i + 1] || !strl[i + 1].match(v))) {
            now_tree.push({ type, value: tmp_str });
            type = "";
            tmp_str = "";
        }

        if (t == "(") {
            if (lkh_stack.includes(i) || strl[i - 1] == "\\") {
                now_tree.push({ type: "v", value: t });
            } else {
                p_tree.push({ tree: now_tree, close: false });
                now_tree.push({ type: "group", value: tmp_str, children: [] });
                now_tree = now_tree.at(-1).children;
                tmp_str = "";
                continue;
            }
        }
        if (t == ")") {
            if (p_tree.at(-1)) {
                if (p_tree.at(-1).close == false) {
                    p_tree.at(-1).close = true;
                    now_tree = p_tree.at(-1).tree;
                    p_tree.pop();
                    continue;
                }
            } else {
                now_tree.push({ type: "v", value: t });
            }
        }
    }

    return o;
}

import symbols from "./symbols.json?raw";
/** @see https://github.com/typst/typst/blob/v0.11.1/crates/typst/src/symbols/sym.rs */
let s = JSON.parse(symbols);

// symbols路径简写

function simple_dot(s: any) {
    const ss: { [id: string]: string } = {};
    for (let i in s) {
        if (typeof s[i] == "string") {
            ss[i] = s[i];
        } else {
            for (let objOrStr of s[i]) {
                // 第二层的array
                if (typeof objOrStr == "string") {
                    ss[i] = objOrStr;
                } else {
                    if (!ss[i]) ss[i] = objOrStr[Object.keys(objOrStr)[0]];
                    for (let j in objOrStr) {
                        // 第三层的obj
                        ss[`${i}.${j}`] = objOrStr[j];
                        // 允许部分索引，但要保证唯一
                        let l = j.split(".");
                        for (let n = 1; n < l.length; n++) {
                            let shotKey = l.slice(0, n).join(".");
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
let ss = simple_dot(s);

import emoji from "./emoji.json?raw";
/** @see https://github.com/typst/typst/blob/v0.11.1/crates/typst/src/symbols/emoji.rs */
let emojix = simple_dot(JSON.parse(emoji));

let shorthand = {
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
    "[|": "bracket.l.double",
    "|]": "bracket.r.double",
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
for (let i in shorthand) {
    if (i.length > max_shorthand_len) {
        max_shorthand_len = i.length;
    }
}

const delimPair = { "(": ["(", ")"], "[": ["[", "]"], "{": ["{", "}"], "|": ["|", "|"], "||": ["‖", "‖"] };

let f: {
    [name: string]: (attr?: tree[], dic?: fdic, array?: tree[][], e?: fonts) => MathMLElement | DocumentFragment;
} = {
    accent: (attr: tree[], dic: fdic) => {
        let base = createMath("mrow");
        base.append(render(attr[0]));
        let a = createMath("mrow");
        a.append(render(attr[1]));
        let over = createMath("mover");
        over.setAttribute("accent", "true");
        over.append(base, a);
        return over;
    },
    attach: (attr: tree[], dic: fdic) => {
        let base = createMath("mrow");
        base.append(render(attr[0]));
        let el: MathMLElement;
        let tl = createMath("mrow");
        if (dic.tl) tl.append(render(dic.tl));
        let bl = createMath("mrow");
        if (dic.bl) bl.append(render(dic.bl));
        let tr = createMath("mrow");
        if (dic.tr) tr.append(render(dic.tr));
        let br = createMath("mrow");
        if (dic.br) br.append(render(dic.br));
        if (dic.tl || dic.bl || dic.tr || dic.br) {
            if (dic.tl || dic.bl) {
                el = createMath("mmultiscripts");
                el.append(base, br, tr, createMath("mprescripts"), bl, tl);
            } else if (dic.tr && dic.br) {
                el = createMath("msubsup");
                el.append(base, br, tr);
            } else if (dic.tr) {
                el = createMath("msup");
                el.append(base, tr);
            } else {
                el = createMath("msub");
                el.append(base, br);
            }
        }
        if (dic.t || dic.b) {
            let uo = createMath("munderover");
            if (!el) {
                uo.append(base);
            } else {
                uo.append(el);
            }
            let t = createMath("mrow");
            if (dic.t) t.append(render(dic.t));
            let b = createMath("mrow");
            if (dic.b) b.append(render(dic.b));
            uo.append(b, t);
            el = uo;
        }
        return el;
    },
    scripts: (attr: tree[], dic: fdic) => {
        return render(attr[0]);
    },
    limits: (attr: tree[], dic: fdic) => {
        return render(attr[0]);
    },
    binom: (attr: tree[], dic: fdic) => {
        let row = createMath("mrow");
        let a = createMath("mrow");
        a.append(render(attr[0]));
        let b = createMath("mrow");
        const s: tree = [];
        for (let x of attr.slice(1)) s.push(...x, dh);
        b.append(render(s.slice(0, -1)));
        let f = createMath("mfrac", null, { linethickness: "0" });
        f.append(a, b);
        let l = createMath("mo", "(");
        let r = createMath("mo", ")");
        row.append(l, f, r);
        return row;
    },
    cancel: (attr: tree[], dic: fdic) => {
        let r = createMath("mrow");
        const bg = (x: boolean) =>
            `linear-gradient(to ${
                x ? "left" : "right"
            } top, transparent 47.75%, currentColor 49.5%, currentColor 50.5%, transparent 52.25%)`;
        let s = "";
        if (is_true(dic.cross)) {
            s = bg(true) + "," + bg(false);
        } else if (is_true(dic.inverted)) {
            s = bg(false);
        } else {
            s = bg(true);
        }
        r.style.backgroundImage = s;
        r.append(render(attr[0]));
        return r;
    },
    cases: (attr: tree[], dic: fdic) => {
        let r = createMath("mrow");
        const d = (get_value(dic, "delim") as string) || "{";
        let t = f.x_table(attr, { cases: [] }) as MathMLElement;
        const gap = (get_value(dic, "gap") as string) || "0.5em";
        t.setAttribute("rowspacing", gap);
        if (is_true(dic?.reverse)) {
            const l = createMath("mo", delimPair[d][1]);
            r.append(t, l);
        } else {
            const l = createMath("mo", d);
            r.append(l, t);
        }
        return r;
    },
    frac: (attr: tree[], dic: fdic) => {
        console.log(attr);

        let a = createMath("mrow");
        a.append(render(attr[0]));
        let b = createMath("mrow");
        b.append(render(attr[1]));
        let f = createMath("mfrac");
        f.append(a, b);
        return f;
    },
    lr: (attr: tree[], dic: fdic) => {
        let list = attr[0];
        let start: tree, end: tree;
        const tList = trim(ast3(ast2(list)));
        start = [tList[0]];
        end = [tList.at(-1)];

        const size = get_value(dic, "size") as string;
        const l = render(start);
        const r = render(end);
        if (size && size != "auto") {
            const lm = l.querySelector("mo");
            const rm = r.querySelector("mo");
            lm.setAttribute("maxsize", size);
            lm.setAttribute("minsize", size);
            rm.setAttribute("maxsize", size);
            rm.setAttribute("minsize", size);
        }
        const c = render(tList.slice(1, -1));
        const row = createMath("mrow");
        row.append(l, c, r);
        return row;
    },
    mid: (attr: tree[], dic: fdic) => {
        const o = createMath("mo", attr?.[0]?.[0]?.value, { stretchy: "true" });
        return o;
    },
    mat: (attr: tree[], dic: fdic, array: tree[][]) => {
        let d = (get_value(dic, "delim") as string) || "(";
        let o = { "(": ["(", ")"], "[": ["[", "]"], "{": ["{", "}"], "|": ["|", "|"], "||": ["‖", "‖"] };
        let row = createMath("mrow");
        let l = createMath("mo", o[d][0]);
        let r = createMath("mo", o[d][1]);
        let t = createMath("mtable");
        if (!array.at(-1).length) array = array.slice(0, -1);
        let augment = get_value(dic, "augment");
        if (augment) {
            let xa = NaN;
            let ya = NaN;
            if (typeof augment != "object") {
                xa = Number(augment);
            } else {
                if (augment["hline"]) ya = Number((augment["hline"] as tree).map((i) => i.value).join(""));
                if (augment["vline"]) xa = Number((augment["vline"] as tree).map((i) => i.value).join(""));
            }
            if (xa < 0) xa = array[0].length + xa;
            if (ya < 0) ya = array.length + ya;

            if (ya) {
                let l: boolean[] = [];
                for (let i = 1; i < array.length; i++) l.push(i === ya);
                t.setAttribute("rowlines", l.map((i) => (i ? "solid" : "none")).join(" "));
            }
            if (xa) {
                let l: boolean[] = [];
                for (let i = 1; i < array[0].length; i++) l.push(i === xa);
                t.setAttribute("columnlines", l.map((i) => (i ? "solid" : "none")).join(" "));
            }
        }
        const gap = get_value(dic, "gap") as string;
        const rowgap = get_value(dic, "row-gap") as string;
        const colgap = get_value(dic, "column-gap") as string;
        t.setAttribute("columnspacing", colgap || gap || "0.5em");
        t.setAttribute("rowspacing", rowgap || gap || "0.5em");

        for (let i of array) {
            let tr = createMath("mtr");
            for (let j of i) {
                let td = createMath("mtd");
                td.append(render(j));
                tr.append(td);
            }
            t.append(tr);
        }
        row.append(l, t, r);
        return row;
    },
    root: (attr: tree[], dic: fdic) => {
        let row = createMath("mrow");
        row.append(render(attr[0]));
        let base = createMath("mrow");
        base.append(render(attr[1]));
        let root = createMath("mroot");
        root.append(base, row);
        return root;
    },
    sqrt: (attr: tree[], dic: fdic) => {
        return f.root([[], attr[0]], null);
    },
    display: (attr: tree[], dic: fdic) => {
        let m = createMath("mrow", null, { displaystyle: "true" });
        m.append(render(attr[0]));
        return m;
    },
    inline: (attr: tree[], dic: fdic) => {
        let m = createMath("mrow", null, { displaystyle: "false", scriptlevel: "0" });
        m.append(render(attr[0]));
        return m;
    },
    script: (attr: tree[], dic: fdic) => {
        let m = createMath("mrow", null, { displaystyle: "false", scriptlevel: "1" });
        m.append(render(attr[0]));
        return m;
    },
    sscript: (attr: tree[], dic: fdic) => {
        let m = createMath("mrow", null, { displaystyle: "false", scriptlevel: "2" });
        m.append(render(attr[0]));
        return m;
    },
    upright: (attr: tree[], dic: fdic) => {
        let r = createMath("mrow");
        r.append(render(attr[0]));
        r.querySelectorAll("mi").forEach((el) => {
            if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "normal");
        });
        r.querySelectorAll("ms").forEach((el) => {
            if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "normal");
        });
        return r;
    },
    italic: (attr: tree[], dic: fdic) => {
        let r = createMath("mrow");
        r.querySelectorAll("mi").forEach((el) => {
            if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "italic");
        });
        r.querySelectorAll("ms").forEach((el) => {
            if (!el.getAttribute(mathvariant)) el.setAttribute(mathvariant, "italic");
        });
        r.append(render(attr[0]));
        return r;
    },
    bold: (attr: tree[], dic: fdic) => {
        let r = createMath("mrow");
        r.style.fontWeight = "bold";
        r.append(render(attr[0]));
        return r;
    },
    op: (attr: tree[], dic: fdic, a, e) => {
        let f = createMath("mrow");
        let str = createMath("ms");
        str.append(render(attr[0], e));
        f.append(str);
        return f;
    },
    underline: (attr: tree[], dic: fdic) => {
        return underover_f("under", attr[0], "_", attr?.[1]);
    },
    overline: (attr: tree[], dic: fdic) => {
        return underover_f("over", attr[0], "‾", attr?.[1]);
    },
    underbrace: (attr: tree[], dic: fdic) => {
        return underover_f("under", attr[0], "⏟", attr?.[1]);
    },
    overbrace: (attr: tree[], dic: fdic) => {
        return underover_f("over", attr[0], "⏞", attr?.[1]);
    },
    underbracket: (attr: tree[], dic: fdic) => {
        return underover_f("under", attr[0], "⎵", attr?.[1]);
    },
    overbracket: (attr: tree[], dic: fdic) => {
        return underover_f("over", attr[0], "⎴", attr?.[1]);
    },
    serif: (attr: tree[], dic: fdic) => {
        return render(attr[0], "serif");
    },
    sans: (attr: tree[], dic: fdic) => {
        return render(attr[0], "sans");
    },
    frak: (attr: tree[], dic: fdic) => {
        return render(attr[0], "frak");
    },
    mono: (attr: tree[], dic: fdic) => {
        return render(attr[0], "mono");
    },
    bb: (attr: tree[], dic: fdic) => {
        return render(attr[0], "bb");
    },
    cal: (attr: tree[], dic: fdic) => {
        return render(attr[0], "cal");
    },
    vec: (attr: tree[], dic: fdic) => {
        let d = (get_value(dic, "value") as string) || "(";
        let o = delimPair;
        let row = createMath("mrow");
        let l = createMath("mo", o[d][0]);
        let r = createMath("mo", o[d][1]);
        let t = createMath("mtable");
        const gap = (get_value(dic, "gap") as string) || "0.5em";
        t.setAttribute("rowspacing", gap);
        for (let i of attr) {
            let tr = createMath("mtr");
            tr.append(render(i));
            t.append(tr);
        }
        row.append(l, t, r);
        return row;
    },
    h: (attr: tree[], dic: fdic) => {
        return createMath("mspace", "", { width: attr[0][0].value });
    },
    // 额外
    //
    x_table: (attr: tree[], dic: fdic) => {
        let t = x_table(attr);
        if (dic.cases) t.setAttribute("columnalign", "left");
        return t;
    },
};

function x_table(trees: tree[]) {
    let max = 0;
    let t = createMath("mtable");
    for (let i of trees) {
        const n = i.filter((x) => eqq(x, v_f("&"))).length;
        if (n > max) max = n;
    }
    for (let i of trees) {
        let r = createMath("mtr");

        // 按&拆分
        let result: tree[] = [[]];
        for (let n = 0; n < i.length; n++) {
            if (eqq(i[n], v_f("&"))) {
                result.push([]);
            } else {
                result.at(-1).push(i[n]);
            }
        }
        for (let i of result) {
            let d = createMath("mtd");
            r.append(d);
            d.append(render(i));
        }

        // 交替对齐
        const al = [];
        for (let i = 0; i <= max; i++) {
            if (i % 2 === 0) {
                al.push("right");
            } else {
                al.push("left");
            }
        }
        t.setAttribute("columnalign", al.join(" "));
        t.setAttribute("columnspacing", "0");
        t.append(r);
    }
    return t;
}

let opl: { id: string; str?: string; limits?: boolean }[] = [
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
    { id: "liminf", str: "lim inf", limits: true },
    { id: "limsup", str: "lim sup", limits: true },
];
function op_f() {
    for (let i of opl) {
        f[i.id] = (attr: tree[], a, b, e) => {
            let s = f.op([[{ type: "str", value: i.str || i.id }]], {}, null, e);
            if (attr) {
                let f = document.createDocumentFragment();
                f.append(s, kh(attr[0]));
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

for (let i in spaceConst) {
    f[i] = () => {
        return f.h([[{ type: "str", value: spaceConst[i] }]]);
    };
}

let limits_f = [];
let limits_sy = ["∏", "∐", "∑", "⋀", "⋁", "⋂", "⋃", "⨀", "⨁", "⨂", "⨃", "⨄", "⨅", "⨆"];
for (let i in ss) {
    for (let j of limits_sy) {
        if (ss[i] == j) {
            limits_f.push(i);
        }
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
    for (let i of l) {
        f[i] = (attr: tree[]) => {
            let s = f.accent([attr[0], [{ type: "f", value: i }]], {});
            return s;
        };
    }
}
accent_f();

function lr_f() {
    let l: { name: string; l: tree[0]; r: tree[0] }[] = [
        { name: "abs", l: v_f("|"), r: v_f("|") },
        { name: "norm", l: v_f("‖"), r: v_f("‖") },
        { name: "floor", l: v_f("⌊"), r: v_f("⌋") },
        { name: "ceil", l: v_f("⌈"), r: v_f("⌉") },
        { name: "round", l: v_f("⌊"), r: v_f("⌉") },
    ];
    for (let i of l) {
        f[i.name] = (attr: tree[], dic) => {
            let s = f.lr([[i.l, ...attr[0], i.r]], dic);
            return s;
        };
    }
}
lr_f();

function underover_f(type: "under" | "over", tree: tree, x: string, str?: tree) {
    let m =
        type == "under"
            ? createMath("munder", null, { accentunder: "true" })
            : createMath("mover", null, { accent: "true" });
    let base = createMath("mrow");
    base.append(render(tree));
    if (str) {
        let s = createMath("mrow");
        s.append(render(str));
        let mm = type == "under" ? createMath("munder") : createMath("mover");
        let xx = createMath("mo", x);
        mm.append(xx, s);
        m.append(base, mm);
    } else {
        let xx = createMath("mo", x);
        m.append(base, xx);
    }
    return m;
}

const ff: typeof f = {
    "√": f["sqrt"],
    "∛": (attr) => f.root([[v_f("3")], attr[0]]),
    "∜": (attr) => f.root([[v_f("4")], attr[0]]),
};

function kh(tree: tree) {
    let f = createMath("mrow");
    let l = createMath("mo");
    l.textContent = "(";
    let c = render(tree);
    let r = createMath("mo");
    r.textContent = ")";
    f.append(l, c, r);
    return f;
}

function out_kh(x: tree[0]) {
    if (x.type == "group") {
        return x.children;
    } else {
        return [x];
    }
}

function in_kh(x: tree) {
    let k: tree = [{ type: "group", value: "", children: x }];
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
    return x && x.value == "br" && x.esc;
}

function is_limit(tree: tree) {
    if (tree.length == 1) {
        let x = tree[0];
        if (x.type == "f") {
            if (limits_f.includes(x.value)) {
                return true;
            }
            if (x.value.split(".").at(0) === "arrow") return true;
            for (let i of opl) {
                if (i.limits && x.value == i.id) {
                    return true;
                }
            }
            if (x.value === "scripts") return false;
            if (x.value === "limits") return true;
            if (x.value === "op") {
                let { dic } = f_attr(x);
                return is_true(dic.limits);
            }
        }
        if (x.type == "v" && limits_sy.includes(x.value)) {
            return true;
        }
    } else {
        return false;
    }
}

function is_f_mark(x: tree[0], str: string) {
    return x.value == str && x.type == "v" && !x.esc;
}

function is_dot(x: tree[0]) {
    return eq(x, { type: "v", value: "." });
}

function is_dot_f(x: tree[0]) {
    return x && (x.type == "f" || (x.type == "v" && x.value.match(/[a-z]/)));
}

function is_factorial(x: tree[0]) {
    return x && x.type == "v" && x.value == "!" && !x.esc;
}

let dh: tree[0] = { type: "v", value: "," };

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

function trim(tree: tree) {
    if (!tree) return [];
    let start = 0;
    let end = tree.length;
    if (tree[0].type === "blank") start = 1;
    if (tree.at(-1).type === "blank") end--;
    return tree.slice(start, end);
}

type fdic = { [id: string]: tree };

function dic_to_ast(dic: { [id: string]: tree }) {
    let l: tree = [];
    for (let i in dic) {
        l.push({ type: "f", value: i });
        l.push({ type: "v", value: ":" });
        for (let x of dic[i]) {
            if (eq(x, dh)) x.esc = true;
        }
        l.push(...dic[i]);
        if (Number(i) + 1 != Object.keys(dic).length) {
            l.push(dh);
        }
    }
    return l;
}

function lan_dic(tree: tree) {
    tree = trim(tree);
    const o = new Object();
    let key = "";
    let value: tree = [];
    tree.push(dh);
    for (let i = 0; i < tree.length; i++) {
        if (!key && tree[i].type != "blank") {
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
            if (!x.children.find((v) => eqq(v, v_f(":")))) return x.children.map((v) => v.value).join("");
            return lan_dic(x.children);
        }
    }
    return x.value;
}

function is_true(t: tree) {
    return eqq(trim(t)?.[0], { type: "sharp", value: "true" });
}

function ast2(tree: tree) {
    // 处理数字和小数
    {
        let t: tree = [];
        let num = /[0-9]/;
        let number = "";
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];
            if (x.value.match(num) || (tree[n - 1]?.value.match(num) && is_dot(x) && tree[n + 1]?.value.match(num))) {
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
        let t: tree = [];
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];

            if (eqq(x, v_f("\\"))) {
                if (tree?.[n + 1]) {
                    let next = tree[n + 1];
                    if (eq(next, v_f("&"))) {
                        t.push({ type: "v", value: "\\", esc: true });
                        n++;
                    } else if (next.type === "blank") {
                        t.push({ type: "v", value: "br", esc: true });
                        n++;
                    } else if (next.type === "f") {
                        let v = next.value;
                        t.push({ type: "v", value: v[0] });
                        t.push({ type: v.length == 2 ? "v" : "f", value: v.slice(1) });
                        n++;
                    } else if (next.type === "sharp") {
                        t.push({ type: "v", value: "#" });
                        n++;
                    } else {
                        let v = next;
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
        let t: tree = [];
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];

            if (!x.esc) {
                if (x.type == "v") {
                    let nn = n;
                    let shortkey = x.value;
                    let l = [];
                    if (shorthand[shortkey]) l.push(shortkey);
                    // 连起来的字符
                    while (tree?.[nn + 1]?.type == "v" && shortkey.length <= max_shorthand_len) {
                        shortkey += tree[nn + 1].value;
                        if (shorthand[shortkey]) l.push(shortkey);
                        nn++;
                    }
                    if (l.length) {
                        let nx: tree[0] = { type: "f", value: shorthand[l.at(-1)] };
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
        let t: tree = [];
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];

            if (x.type == "v" && tree?.[n + 1]?.type == "blank" && tree?.[n + 2]?.type == "str") {
                t.push(x);
                t.push({ type: "f", value: "space" });
            } else if (x.type == "str" && tree?.[n + 1]?.type == "blank" && tree?.[n + 2]?.type == "v") {
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
        let t: tree = [];
        let tmpx: tree = [];
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];

            if (is_factorial(tree?.[n + 1]) && !is_sup(x) && !is_sub(x) && !is_frac(x)) {
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
        let t: tree = [];
        let f = "";
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];

            if (is_dot_f(x) && is_dot(tree[n + 1])) {
                if (f || (!f && x.type == "f")) {
                    f += x.value + ".";
                    n++;
                    continue;
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
            if (x.type === "v" && ff[x.value] && tree[n + 1]) {
                x.type = "f";
                if (tree[n + 1].type != "group") {
                    t.push(x);
                    t.push({ type: "group", children: [tree[n + 1]], value: "" });
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
        let t: tree = [];
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];

            // 带有括号（参数）的函数
            if (x.type == "f" && tree[n + 1] && tree[n + 1].type == "group") {
                x.children = tree[n + 1].children;
                for (let i in x.children) {
                    if (x.children[i].value == "\\" && x.children[i].type == "v") {
                        if (x.children[Number(i) + 1]) {
                            x.children[Number(i) + 1]["esc"] = true;
                        }
                    }
                }
                t.push(x);

                // 不处理group
                n++;
                continue;
            } else {
                t.push(x);
            }
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
                        for (let i in x.children) {
                            if (x.children[i].value === "\\" && x.children[i].type === "v") {
                                if (x.children[Number(i) + 1]) {
                                    x.children[Number(i) + 1]["esc"] = true;
                                }
                            }
                        }
                        const v = x.children.map((i) => i.value).join("");
                        if (v.match(/^[0-9\+\-\*\/()]+$/)) {
                            x.value = v; // todo 数学运算
                        } else {
                            x.value = v;
                        }
                    } else {
                        console.log("+1", tree[n + 1]);

                        x.value = tree[n + 1]?.value;
                        if (tree[n + 2]?.type === "f") {
                            x.value += tree[n + 2].value;
                            n++;
                        }
                    }
                t.push(x);
                n++;
                continue;
            } else {
                t.push(x);
            }
        }
        tree = t;
    }

    // '->^'
    {
        let t: tree = [];
        for (let n = 0; n < tree.length; n++) {
            let x = tree[n];
            let nn = n;
            if (eqq(x, { type: "f", value: "prime" })) {
                while (tree[nn] && eqq(tree[nn], { type: "f", value: "prime" })) {
                    nn++;
                }
                const primes = nn - n;
                if (
                    tree[n - 1] &&
                    !is_sup(tree[n - 1]) &&
                    !is_sub(tree[n - 1]) &&
                    !eq(tree[n - 1], { type: "f", value: "prime" }) &&
                    tree[n - 1].type != "blank"
                ) {
                    t.push({ type: "v", value: "^" });
                }
                t.push({ type: "v", value: "'".repeat(primes), children: [{ type: "v", value: String(primes) }] });
                n += primes - 1;
                continue;
            }
            t.push(x);
        }
        tree = t;
    }

    // 移除blank
    {
        let t: tree = [];
        for (let i of tree) {
            if (i.type == "blank") continue;
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
                if ((is_sup(tree[n + 1]) || is_sub(tree[n + 1])) && !(is_sup(tree[n - 1]) || is_sub(tree[n - 1]))) {
                    if (!start) start = n;
                }
                if ((is_sup(tree[n - 1]) || is_sub(tree[n - 1])) && !(is_sup(tree[n + 1]) || is_sub(tree[n + 1]))) {
                    index.push([start, n]);
                    start = NaN;
                }
            }
        }

        let t: tree = [];
        for (let n = 0; n < tree.length; n++) {
            if (n == index?.[0]?.[0]) {
                {
                    let tmp: tree[0] = tree[index[0][1]];
                    for (let i = index[0][1]; i >= index[0][0]; i--) {
                        if (is_sup(tree[i - 1]) && is_sub(tree[i - 3])) {
                            let o = is_limit([tree[i - 4]])
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
                            let o = is_limit([tree[i - 4]])
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
                            let o = is_limit([tree[i - 2]]) ? { t: out_kh(tmp) } : { tr: out_kh(tmp) };
                            tmp = {
                                type: "f",
                                value: "attach",
                                children: [tree[i - 2], dh, ...dic_to_ast(o)],
                            };
                            i -= 2 - 1;
                            continue;
                        }
                        if (is_sub(tree[i - 1])) {
                            let o = is_limit([tree[i - 2]]) ? { b: out_kh(tmp) } : { br: out_kh(tmp) };
                            tmp = {
                                type: "f",
                                value: "attach",
                                children: [tree[i - 2], dh, ...dic_to_ast(o)],
                            };
                            i -= 2 - 1;
                            continue;
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
        let index: [number, number][] = [];
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

        let t: tree = [];
        for (let n = 0; n < tree.length; n++) {
            if (n == index?.[0]?.[0]) {
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
                            continue;
                        }
                    }
                    console.log(1, tmp);

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
    let type: "dic" | "array" | "attr" = "array";
    let attr: tree[] = [];
    let dicl: tree[] = [];
    let array: tree[][] = [];
    let l: tree = [];
    for (let i in x.children) {
        const t = x.children[i];
        if (Number(i) + 1 == x.children.length) {
            if (t.type == "blank" && x.children[Number(i) - 1].value.match(/[,;]/)) break;
            if (!is_f_mark(t, ",") && !is_f_mark(t, ";")) l.push(t);
            if (type == "dic") {
                dicl.push(l);
                l = [];
            } else {
                attr.push(l);
            }
            if (array.length) {
                array.push(attr);
                attr = [];
            }
            l = [];
        } else {
            if (is_f_mark(t, ",")) {
                if (type == "dic") {
                    dicl.push(l);
                    type = "array";
                } else {
                    attr.push(l);
                }
                l = [];
            } else if (is_f_mark(t, ";")) {
                // 存在; 则存好的attr为array的一个子元素
                type == "array";
                attr.push(l);
                l = [];
                array.push(attr);
                attr = [];
            } else {
                // 按,拆分成段
                l.push(t);
                // 段中有: 为dic
                if (is_f_mark(t, ":")) {
                    type = "dic";
                }
            }
        }
    }

    // 将dicl的tree转为键对
    let dic: fdic = {};
    for (let i of dicl) {
        let x = false;
        let n = "";
        let t: tree = [];
        for (let el of i) {
            if (el.value === ":") {
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
    return { attr: attr.map((t) => trim(t)), dic, array };
}

type fonts = "serif" | "sans" | "frak" | "mono" | "bb" | "cal";
function font(str: string, type: fonts = "serif") {
    function index_c(c: string) {
        const l = "abcdefghijklmnopqrstuvwxyz";
        return l.indexOf(c.toLowerCase());
    }
    switch (type) {
        case "serif":
            return str;
        case "sans":
            const s0 = [..."𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫"];
            const s1 = [..."𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓"];
            const s2 = [..."𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹"];
            str = str.replace(/[0-9]+/g, (s) => s0[s]);
            str = str.replace(/[a-z]/g, (s) => s1[index_c(s)]);
            str = str.replace(/[A-Z]/g, (s) => s2[index_c(s)]);
            return str;
        case "frak":
            const frak1 = [..."𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷"];
            const frak2 = [..."𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ"];
            str = str.replace(/[a-z]/g, (s) => frak1[index_c(s)]);
            str = str.replace(/[A-Z]/g, (s) => frak2[index_c(s)]);
            return str;
        case "mono":
            const m0 = [..."0𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿"];
            const m1 = [..."𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣"];
            const m2 = [..."𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉"];
            str = str.replace(/[0-9]+/g, (s) => m0[s]);
            str = str.replace(/[a-z]/g, (s) => m1[index_c(s)]);
            str = str.replace(/[A-Z]/g, (s) => m2[index_c(s)]);
            return str;
        case "bb":
            const bb0 = [..."𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡"];
            const bb1 = [..."𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫"];
            const bb2 = [..."𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ"];
            str = str.replace(/[0-9]+/g, (s) => bb0[s]);
            str = str.replace(/[a-z]/g, (s) => bb1[index_c(s)]);
            str = str.replace(/[A-Z]/g, (s) => bb2[index_c(s)]);
            return str;
        case "cal":
            const c1 = [..."𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏"];
            const c2 = [..."𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵"];
            str = str.replace(/[a-z]/g, (s) => c1[index_c(s)]);
            str = str.replace(/[A-Z]/g, (s) => c2[index_c(s)]);
            return str;
    }
}

function render(tree: tree, e?: fonts) {
    let fragment = document.createDocumentFragment();

    tree = ast2(tree);

    // 多行
    // 处理\ 换行
    {
        let xx = false;
        for (let n in tree) {
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
            return x_table(trees);
        }
    }

    // 单行

    tree = ast3(tree);

    {
        let t: tree = [];
        for (let x of tree) {
            // 移除&
            if (!(x.type == "v" && x.value == "&" && !x.esc)) {
                t.push(x);
            }
        }
        tree = t;
    }

    // 移除group1
    {
        let t: tree = [];
        for (let x of tree) {
            if (x.type == "group1") {
                t.push(...x.children);
            } else {
                t.push(x);
            }
        }
        tree = t;
    }

    console.log("ast3", structuredClone(tree));
    for (let i in tree) {
        let n = Number(i);
        let x = tree[n];

        // 带有括号（参数）的函数
        if (x.type == "f" && x.children) {
            let { attr, dic, array }: { attr: tree[]; dic: fdic; array: tree[][] } = f_attr(x);

            if (f[x.value]) {
                console.log(attr, dic, array);
                let el = f[x.value](attr, dic, array, e);
                fragment.append(el);
            } else if (ss[x.value]) {
                let el = createMath("mi", ss[x.value]);
                fragment.append(el, render(in_kh(x.children)));
            } else if (ff[x.value]) {
                let el = ff[x.value](attr, dic, array, e);
                fragment.append(el);
            }
        }

        if (x.type == "f" && !x.children) {
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
                let el = createMath(tag, ss[x.value], space_w);
                fragment.append(el);
            } else {
                if (f[x.value]) {
                    let el = f[x.value](null, null, null, e);
                    fragment.append(el);
                }
            }
        }

        if (x.type == "str") {
            let el = createMath("ms", font(x.value, e));
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
                if (x.value.length > 1) x.value = x.value.replaceAll("'", ss["prime"]);
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
            let el = createMath(tag, font(value, e));
            fragment.append(el);
        }

        if (x.type == "group") {
            fragment.append(kh(x.children));
        }
    }

    return fragment;
}

var init_c: { emoji: (str: string) => string } = {
    emoji: null,
};

function init(p: { emoji: boolean }) {
    for (let i in p) {
        if (init_c[i]) init_c[i] = p[i];
    }
}

function toMML(str: string, inline?: boolean) {
    let obj = ast(str);
    console.log("ast1", obj);

    let mathEl = createMath("math");
    if (!inline) mathEl.setAttribute("display", "block");
    let f = render(obj);
    mathEl.append(f);
    return mathEl;
}

function toMMLHTML(str: string) {
    return toMML(str).outerHTML;
}

const version = {
    lan: "0.11.1",
    symbol: "0.11.1",
};

export { init, toMML, toMMLHTML, version };
