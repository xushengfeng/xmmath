/// <reference types="vite/client" />

function createEl<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
function createEl<K extends keyof HTMLElementDeprecatedTagNameMap>(tagName: K): HTMLElementDeprecatedTagNameMap[K];
function createEl(tagName: string): HTMLElement;
function createEl(tagname: string) {
    return document.createElement(tagname);
}

type mathtag =
    | "math"
    | "menclose"
    | "merror"
    | "mfrac"
    | "mi"
    | "mmultiscripts"
    | "mprescripts"
    | "mn"
    | "mo"
    | "mover"
    | "mpadded"
    | "mphantom"
    | "mroot"
    | "mrow"
    | "ms"
    | "mspace"
    | "msqrt"
    | "mstyle"
    | "msub"
    | "msubsup"
    | "msup"
    | "mtable"
    | "mtd"
    | "mtext"
    | "mtr"
    | "munder"
    | "munderover"
    | "semantics";

function createMath(tagname: mathtag, innerText?: string, attr?: { [name: string]: string }) {
    let el = document.createElement(tagname);
    if (innerText) el.innerText = innerText;
    if (attr) {
        for (let i in attr) {
            el.setAttribute(i, attr[i]);
        }
    }
    return el;
}

const mathvariant = "mathvariant";

type vtype = "" | "str" | "v" | "f" | "blank" | "group";
type tree = { type: vtype; value: string; children?: tree }[];

function ast(str: string) {
    let v = /[a-zA-Z.]/;
    let kh = /[\(\)]/;
    let blank = /[ \t\n\r]+/;
    let type: vtype = "";
    let o: tree = [];
    let p_tree: { tree: tree; close: boolean }[] = [];
    let now_tree = o;
    let tmp_str = "";

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
                lkh_stack.pop();
            }
        }
    }

    let continue_c = 0;

    for (let i = 0; i < str.length; i++) {
        if (continue_c > 0) {
            continue_c--;
            continue;
        }

        const t = str[i];
        // 字符
        if (t == '"' && str[i - 1] != "\\") {
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
        if (type == "blank" && !t.match(blank)) {
            now_tree.push({ type, value: "" });
            type = "";
        }

        if (t == "\\") {
            if (str[i + 1] == "\\") {
                continue_c = 1;
                now_tree.push({ type: "v", value: t });
            }
            continue;
        }

        // 原始值（字母变量、数字、符号）
        if (
            type == "" &&
            (!str[i - 1] || !str[i - 1].match(v)) &&
            (!str[i + 1] || !str[i + 1].match(v)) &&
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
        if (((str[i - 1] && str[i - 1].match(v)) || (str[i + 1] && str[i + 1].match(v))) && t.match(v)) {
            type = "f";
        }
        if (type == "f") {
            tmp_str += t;
        }
        if (type == "f" && (!str[i + 1] || !str[i + 1].match(v))) {
            now_tree.push({ type, value: tmp_str });
            type = "";
            tmp_str = "";
        }

        if (t == "(") {
            if (lkh_stack.includes(i)) {
                now_tree.push({ type: "v", value: t });
            } else {
                p_tree.push({ tree: now_tree, close: false });
                now_tree.push({ type: "group", value: tmp_str, children: [] });
                now_tree = now_tree[now_tree.length - 1].children;
                tmp_str = "";
                continue;
            }
        }
        if (t == ")") {
            if (p_tree[p_tree.length - 1]) {
                if (p_tree[p_tree.length - 1].close == false) {
                    p_tree[p_tree.length - 1].close = true;
                    now_tree = p_tree[p_tree.length - 1].tree;
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
/** @see https://github.com/typst/typst/blob/6c542ea1a4a0ee85069dad6974ff331851eff406/library/src/symbols/sym.rs */
let s = JSON.parse(symbols);

let f = {
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
        let base = render(attr[0]);
        let el = createMath("mmultiscripts");
        el.append(base);
        let tl = createMath("mrow");
        if (dic.tl) tl.append(render(dic.tl));
        let bl = createMath("mrow");
        if (dic.bl) bl.append(render(dic.bl));
        let tr = createMath("mrow");
        if (dic.tr) tr.append(render(dic.tr));
        let br = createMath("mrow");
        if (dic.br) br.append(render(dic.br));
        if (dic.tl || dic.bl || dic.tr || dic.br) {
            el.append(br, tr, createMath("mprescripts"), bl, tl);
        }
        if (dic.t || dic.b) {
            let ud = createMath("munderover");
            if (el.children.length == 1) {
                ud.append(render(attr[0]));
            } else {
                ud.append(el);
            }
            let t = createMath("mrow");
            if (dic.t) t.append(render(dic.t));
            let b = createMath("mrow");
            if (dic.b) b.append(render(dic.b));
            ud.append(b, t);
            el = ud;
        }
        return el;
    },
    binom: (attr: tree[], dic: fdic) => {
        let row = createMath("mrow");
        let a = createMath("mrow");
        a.append(render(attr[0]));
        let b = createMath("mrow");
        b.append(render(attr[1]));
        let f = createMath("mfrac", null, { linethickness: "0" });
        f.append(a, b);
        let l = createMath("mo", "(");
        let r = createMath("mo", ")");
        row.append(l, f, r);
        return row;
    },
    cancel: (attr: tree[], dic: fdic) => {},
    cases: (attr: tree[], dic: fdic) => {
        let f = createMath("mrow");
        let l = createMath("mo", dic?.delim?.[0]?.value || "{");
        let t = createMath("mtable", null, { columnalign: "left" });
        for (let i of attr) {
            let tr = createMath("mtr");
            let td = createMath("mtd");
            td.append(render(i));
            tr.append(td);
            t.append(tr);
        }
        f.append(l, t);
        return f;
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
        let start: { c: tree; n: number }, end: { c: tree; n: number };
        for (let i = 0; i < list.length; i++) {
            const el = list[i];
            if (el.type == "blank") continue;
            start = { c: [el], n: i };
            break;
        }
        for (let i = list.length - 1; i >= 0; i--) {
            const el = list[i];
            if (el.type == "blank") continue;
            end = { c: [el], n: i };
            break;
        }
        let l = document.createDocumentFragment();
        l.append(render(start.c));
        let r = document.createDocumentFragment();
        r.append(render(end.c));
        let c = document.createDocumentFragment();
        c.append(render(list.slice(start.n + 1, end.n)));
        let row = createMath("mrow");
        row.append(l, c, r);
        return row;
    },
    mat: (attr: tree[], dic: fdic, array: tree[][]) => {
        let d = dic?.delim?.[0]?.value || "(";
        let o = { "(": ["(", ")"], "[": ["[", "]"], "{": ["{", "}"], "|": ["|", "|"], "||": ["‖", "‖"] };
        let row = createMath("mrow");
        let l = createMath("mo", o[d][0]);
        let r = createMath("mo", o[d][1]);
        let t = createMath("mtable");
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
    display: (attr: tree[], dic: fdic) => {},
    inline: (attr: tree[], dic: fdic) => {},
    script: (attr: tree[], dic: fdic) => {},
    sscript: (attr: tree[], dic: fdic) => {},
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
    op: (attr: tree[], dic: fdic) => {
        let f = createMath("mrow");
        let str = createMath("ms", attr[0][0].value);
        f.append(str);
        // TODO dic.limit
        return f;
    },
    underline: (attr: tree[], dic: fdic) => {
        return underover_f("under", attr[0], "_", attr?.[1]?.[0]?.value);
    },
    overline: (attr: tree[], dic: fdic) => {
        return underover_f("over", attr[0], "‾", attr?.[1]?.[0]?.value);
    },
    underbrace: (attr: tree[], dic: fdic) => {
        return underover_f("under", attr[0], "⏟", attr?.[1]?.[0]?.value);
    },
    overbrace: (attr: tree[], dic: fdic) => {
        return underover_f("over", attr[0], "⏞", attr?.[1]?.[0]?.value);
    },
    underbracket: (attr: tree[], dic: fdic) => {
        return underover_f("under", attr[0], "⎵", attr?.[1]?.[0]?.value);
    },
    overbracket: (attr: tree[], dic: fdic) => {
        return underover_f("over", attr[0], "⎴", attr?.[1]?.[0]?.value);
    },
    serif: (attr: tree[], dic: fdic) => {},
    sans: (attr: tree[], dic: fdic) => {},
    frak: (attr: tree[], dic: fdic) => {},
    mono: (attr: tree[], dic: fdic) => {},
    bb: (attr: tree[], dic: fdic) => {},
    cal: (attr: tree[], dic: fdic) => {},
    vec: (attr: tree[], dic: fdic) => {},
    // 额外
    //
};

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
    { id: "deg" },
    { id: "det", limits: true },
    { id: "dim" },
    { id: "exp" },
    { id: "gcd", limits: true },
    { id: "hom" },
    { id: "mod" },
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
    { id: "sin" },
    { id: "sinc" },
    { id: "sinh" },
    { id: "sup", limits: true },
    { id: "tan" },
    { id: "tg" },
    { id: "tanh" },
    { id: "liminf", str: "lim inf", limits: true },
    { id: "limsup", str: "lim sup", limits: true },
];
function op_f() {
    for (let i of opl) {
        f[i.id] = (attr: tree[]) => {
            let s = f.op([[{ type: "str", value: i.str || i.id }]], {});
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
        "arrow.l",
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
        f[i.name] = (attr: tree[]) => {
            let s = f.lr([[i.l, ...attr[0], i.r]], {});
            return s;
        };
    }
}
lr_f();

function underover_f(type: "under" | "over", tree: tree, x: string, str?: string) {
    let m =
        type == "under"
            ? createMath("munder", null, { accentunder: "true" })
            : createMath("mover", null, { accent: "true" });
    let base = createMath("mrow");
    base.append(render(tree));
    let xx = createMath("mo", x);
    m.append(base, xx);
    if (str) {
        let s = createMath("ms", str);

        let mm = type == "under" ? createMath("munder") : createMath("mover");
        mm.append(m, s);
        return mm;
    }
    return m;
}

function kh(tree: tree) {
    let f = document.createDocumentFragment();
    let l = createMath("ms");
    l.innerText = "(";
    let c = render(tree);
    let r = createMath("ms");
    r.innerText = ")";
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

let dh: tree[0] = { type: "v", value: "," };

function v_f(str: string): tree[0] {
    return { type: "v", value: str };
}

type fdic = { [id: string]: tree };

function dic_to_ast(dic: { [id: string]: tree }) {
    let l: tree = [];
    for (let i in dic) {
        l.push({ type: "f", value: i });
        l.push({ type: "v", value: ":" });
        l.push(...dic[i]);
        if (Number(i) + 1 != Object.keys(dic).length) {
            l.push(dh);
        }
    }
    return l;
}

function render(tree: tree) {
    let fragment = document.createDocumentFragment();

    // 处理数字和小数
    {
        let t: tree = [];
        let num = /[0-9]/;
        let number = "";
        for (let i in tree) {
            let n = Number(i);
            let x = tree[n];
            if (
                x.value.match(num) ||
                (tree[n - 1] &&
                    tree[n - 1].value.match(num) &&
                    x.value == "." &&
                    tree[n + 1] &&
                    tree[n + 1].value.match(num))
            ) {
                number += x.value;
            } else {
                t.push(x);
            }
            if (
                x.value.match(num) &&
                (!tree[n + 1] || !tree[n + 1].value.match(/[0-9]/)) &&
                !(tree[n + 1]?.value == "." && tree[n + 2]?.value.match(num))
            ) {
                t.push({ type: "v", value: number });
                number = "";
            }
        }
        tree = t;
    }

    // 处理f
    {
        let t: tree = [];
        let continue_c = 0;
        for (let i in tree) {
            if (continue_c > 0) {
                continue_c--;
                continue;
            }
            let n = Number(i);
            let x = tree[n];

            // 带有括号（参数）的函数
            if (x.type == "f" && tree[n + 1] && tree[n + 1].type == "group") {
                x.children = tree[n + 1].children;
                t.push(x);

                // 不处理group
                continue_c = 1;
                continue;
            } else {
                t.push(x);
            }
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
            if (x.value != "^" && x.value != "_") {
                if (
                    (tree[n + 1]?.value == "^" || tree[n + 1]?.value == "_") &&
                    !(tree[n - 1]?.value == "^" || tree[n - 1]?.value == "_")
                ) {
                    if (!start) start = n;
                }
                if (
                    (tree[n - 1]?.value == "^" || tree[n - 1]?.value == "_") &&
                    !(tree[n + 1]?.value == "^" || tree[n + 1]?.value == "_")
                ) {
                    index.push([start, n]);
                    start = NaN;
                }
            }
        }

        let t: tree = [];
        let continue_c = 0;
        for (let i in tree) {
            if (continue_c > 0) {
                continue_c--;
                continue;
            }
            let n = Number(i);

            if (n == index?.[0]?.[0]) {
                {
                    let continue_c = 0;
                    let tmp: tree[0] = tree[index[0][1]];
                    for (let i = index[0][1]; i >= index[0][0]; i--) {
                        if (continue_c > 0) {
                            continue_c--;
                            continue;
                        }

                        if (tree[i - 1]?.value == "^" && tree[i - 3]?.value == "_") {
                            tmp = {
                                type: "f",
                                value: "attach",
                                children: [
                                    ...out_kh(tree[i - 4]),
                                    dh,
                                    ...dic_to_ast({ tr: out_kh(tmp), br: out_kh(tree[i - 2]) }),
                                ],
                            };
                            continue_c = 4 - 1;
                            continue;
                        }
                        if (tree[i - 1]?.value == "_" && tree[i - 3]?.value == "^") {
                            tmp = {
                                type: "f",
                                value: "attach",
                                children: [
                                    ...out_kh(tree[i - 4]),
                                    dh,
                                    ...dic_to_ast({ tr: out_kh(tree[i - 2]), br: out_kh(tmp) }),
                                ],
                            };
                            continue_c = 4 - 1;
                            continue;
                        }
                        if (tree[i - 1]?.value == "^") {
                            tmp = {
                                type: "f",
                                value: "attach",
                                children: [...out_kh(tree[i - 2]), dh, ...dic_to_ast({ tr: out_kh(tmp) })],
                            };
                            continue_c = 2 - 1;
                            continue;
                        }
                        if (tree[i - 1]?.value == "_") {
                            tmp = {
                                type: "f",
                                value: "attach",
                                children: [...out_kh(tree[i - 2]), dh, ...dic_to_ast({ br: out_kh(tmp) })],
                            };
                            continue_c = 2 - 1;
                            continue;
                        }
                    }
                    t.push(tmp);
                }
                continue_c = index[0][1] - index[0][0];
                continue;
            }

            t.push(tree[i]);
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
            if (x.value != "/") {
                if (tree[n + 1]?.value == "/" && !(tree[n - 1]?.value == "/")) {
                    if (!start) start = n;
                }
                if (tree[n - 1]?.value == "/" && !(tree[n + 1]?.value == "/")) {
                    index.push([start, n]);
                    start = NaN;
                }
            }
        }

        let t: tree = [];
        let continue_c = 0;
        for (let i in tree) {
            if (continue_c > 0) {
                continue_c--;
                continue;
            }
            let n = Number(i);

            if (n == index?.[0]?.[0]) {
                {
                    let continue_c = 0;
                    let tmp: tree[0] = tree[index[0][0]];
                    for (let i = index[0][0]; i <= index[0][1]; i++) {
                        if (continue_c > 0) {
                            continue_c--;
                            continue;
                        }

                        if (tree[i + 1]?.value == "/") {
                            tmp = {
                                type: "f",
                                value: "frac",
                                children: [...out_kh(tmp), dh, ...out_kh(tree[i + 2])],
                            };
                            continue_c = 2 - 1;
                            continue;
                        }
                    }
                    console.log(1, tmp);

                    t.push(tmp);
                }
                continue_c = index[0][1] - index[0][0];
                index.splice(0, 1);
                continue;
            }

            t.push(tree[i]);
        }
        tree = t;
    }

    let continue_c = 0;
    for (let i in tree) {
        if (continue_c > 0) {
            continue_c--;
            continue;
        }
        let n = Number(i);
        let x = tree[n];

        // 带有括号（参数）的函数
        if (x.type == "f" && x.children) {
            let type: "dic" | "array" | "attr" = "array";
            let attr: tree[] = [];
            let dicl: tree[] = [];
            let array: tree[][] = [];
            let l: tree = [];
            for (let i in x.children) {
                const t = x.children[i];
                if (Number(i) + 1 == x.children.length) {
                    if (t.type == "blank" && x.children[Number(i) - 1].value.match(/[,;]/)) break;
                    if (t.value != "," && t.value != ";") l.push(t);
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
                    if (t.value == ",") {
                        if (type == "dic") {
                            dicl.push(l);
                            l = [];
                        } else {
                            attr.push(l);
                        }
                        l = [];
                    } else if (t.value == ";") {
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
                        if (t.value == ":") {
                            type = "dic";
                        }
                    }
                }
            }

            // 将dicl的tree转为键对
            let dic: fdic = {};
            for (let i of dicl) {
                let n = "";
                let t: tree = [];
                for (let el of i) {
                    if (!n) {
                        n = el.value;
                    } else {
                        if (el.value != ":") t.push(el);
                    }
                }
                dic[n] = t;
            }

            if (f[x.value]) {
                console.log(attr, dic, array);
                let el = f[x.value](attr, dic, array);
                fragment.append(el);
            }
        }

        if (x.type == "f" && !x.children) {
            let l = x.value.split(".");
            if (s[l[0]]) {
                let v = "";
                if (l.length == 1) {
                    if (typeof s[l[0]] == "string") {
                        v = s[l[0]];
                    } else {
                        // 获取第一个元素值
                        let o = s[l[0]][0];
                        if (typeof o == "string") {
                            v = o;
                        } else {
                            v = Object.values(o)[0] as string;
                        }
                    }
                } else {
                    let p = l.slice(1).join(".");
                    for (let i of s[l[0]]) {
                        if (typeof i == "object") {
                            l: for (let k of Object.keys(i)) {
                                if (k == p) {
                                    v = i[k];
                                } else {
                                    let ll = k.split(".");
                                    for (let n = 1; n < ll.length; n++) {
                                        if (p == ll.slice(0, n).join(".")) {
                                            v = i[k];
                                            break l;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                let el = createMath("mo", v);
                fragment.append(el);
            } else {
                if (f[x.value]) {
                    let el = f[x.value]();
                    fragment.append(el);
                }
            }
        }

        if (x.type == "str") {
            let el = createMath("ms", x.value);
            fragment.append(el);
        }

        if (x.type == "v") {
            let tag: mathtag;
            if (x.value.match(/[0-9]+/)) {
                tag = "mn";
            }
            if (x.value.match(/[a-zA-Z]/)) {
                tag = "mi";
            } else {
                tag = "mo";
            }
            let el = createMath(tag, x.value);
            fragment.append(el);
        }

        if (x.type == "group") {
            fragment.append(kh(x.children));
        }
    }

    return fragment;
}

function toMML(str: string) {
    let obj = ast(str);
    console.log(obj);

    let mathEl = createEl("math");
    mathEl.setAttribute("display", "block");
    let f = render(obj);
    mathEl.append(f);
    return mathEl;
}

function toMMLHTML(str: string) {
    return toMML(str).outerHTML;
}

export { toMML, toMMLHTML };
