/// <reference types="vite/client" />

function createEl<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
function createEl<K extends keyof HTMLElementDeprecatedTagNameMap>(tagName: K): HTMLElementDeprecatedTagNameMap[K];
function createEl(tagName: string): HTMLElement;
function createEl(tagname: string) {
    return document.createElement(tagname);
}

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
let s = JSON.parse(symbols);

let f = {
    accent: (attr: tree[], dic: fdic) => {},
    attach: (attr: tree[], dic: fdic) => {
        let base = render(attr[0]);
        let el = document.createElement("mmultiscripts");
        el.append(base);
        let tl = document.createElement("mrow");
        if (dic.tl) tl.append(render(dic.tl));
        let bl = document.createElement("mrow");
        if (dic.bl) bl.append(render(dic.bl));
        let tr = document.createElement("mrow");
        if (dic.tr) tr.append(render(dic.tr));
        let br = document.createElement("mrow");
        if (dic.br) br.append(render(dic.br));
        if (dic.tl || dic.bl || dic.tr || dic.br) {
            el.append(br, tr, document.createElement("mprescripts"), bl, tl);
        }
        if (dic.t || dic.b) {
            let uo = document.createElement("munderover");
            if (el.children.length == 1) {
                uo.append(base);
            } else {
                uo.append(el);
            }
            let t = document.createElement("mrow");
            if (dic.t) t.append(render(dic.t));
            let b = document.createElement("mrow");
            if (dic.b) b.append(render(dic.b));
            uo.append(b, t);
            el = uo;
        }
        return el;
    },
    binom: (attr: tree[], dic: fdic) => {},
    cancel: (attr: tree[], dic: fdic) => {},
    cases: (attr: tree[], dic: fdic) => {},
    frac: (attr: tree[], dic: fdic) => {
        console.log(attr);

        let a = document.createElement("mrow");
        a.append(render(attr[0]));
        let b = document.createElement("mrow");
        b.append(render(attr[1]));
        let f = document.createElement("mfrac");
        f.append(a, b);
        return f;
    },
    lr: (attr: tree[], dic: fdic) => {},
    mat: (attr: tree[], dic: fdic, array: tree[][]) => {},
    root: (attr: tree[], dic: fdic) => {},
    display: (attr: tree[], dic: fdic) => {},
    inline: (attr: tree[], dic: fdic) => {},
    script: (attr: tree[], dic: fdic) => {},
    sscript: (attr: tree[], dic: fdic) => {},
    upright: (attr: tree[], dic: fdic) => {},
    italic: (attr: tree[], dic: fdic) => {},
    bold: (attr: tree[], dic: fdic) => {},
    op: (attr: tree[], dic: fdic) => {
        let f = document.createElement("mrow");
        let str = document.createElement("ms");
        str.innerText = attr[0][0].value;
        f.append(str);
        // TODO dic.limit
        return f;
    },
    underline: (attr: tree[], dic: fdic) => {},
    overline: (attr: tree[], dic: fdic) => {},
    underbrace: (attr: tree[], dic: fdic) => {},
    overbrace: (attr: tree[], dic: fdic) => {},
    underbracket: (attr: tree[], dic: fdic) => {},
    overbracket: (attr: tree[], dic: fdic) => {},
    serif: (attr: tree[], dic: fdic) => {},
    sans: (attr: tree[], dic: fdic) => {},
    frak: (attr: tree[], dic: fdic) => {},
    mono: (attr: tree[], dic: fdic) => {},
    bb: (attr: tree[], dic: fdic) => {},
    cal: (attr: tree[], dic: fdic) => {},
    vec: (attr: tree[], dic: fdic) => {},
    // 额外
    // accent
    //
    arccos: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "arccos" }]], {});
        return op_f(s, attr);
    },
    arcsin: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "arcsin" }]], {});
        return op_f(s, attr);
    },
    arctan: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "arctan" }]], {});
        return op_f(s, attr);
    },
    arg: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "arg" }]], {});
        return op_f(s, attr);
    },
    cos: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "cos" }]], {});
        return op_f(s, attr);
    },
    cosh: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "cosh" }]], {});
        return op_f(s, attr);
    },
    cot: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "cot" }]], {});
        return op_f(s, attr);
    },
    ctg: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "ctg" }]], {});
        return op_f(s, attr);
    },
    coth: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "coth" }]], {});
        return op_f(s, attr);
    },
    csc: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "csc" }]], {});
        return op_f(s, attr);
    },
    deg: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "deg" }]], {});
        return op_f(s, attr);
    },
    det: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "det" }]], {});
        return op_f(s, attr);
    },
    dim: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "dim" }]], {});
        return op_f(s, attr);
    },
    exp: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "exp" }]], {});
        return op_f(s, attr);
    },
    gcd: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "gcd" }]], {});
        return op_f(s, attr);
    },
    hom: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "hom" }]], {});
        return op_f(s, attr);
    },
    mod: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "mod" }]], {});
        return op_f(s, attr);
    },
    inf: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "inf" }]], {});
        return op_f(s, attr);
    },
    ker: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "ker" }]], {});
        return op_f(s, attr);
    },
    lg: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "lg" }]], {});
        return op_f(s, attr);
    },
    lim: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "lim" }]], {});
        return op_f(s, attr);
    },
    ln: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "ln" }]], {});
        return op_f(s, attr);
    },
    log: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "log" }]], {});
        return op_f(s, attr);
    },
    max: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "max" }]], {});
        return op_f(s, attr);
    },
    min: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "min" }]], {});
        return op_f(s, attr);
    },
    Pr: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "Pr" }]], {});
        return op_f(s, attr);
    },
    sec: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "sec" }]], {});
        return op_f(s, attr);
    },
    sin: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "sin" }]], {});
        return op_f(s, attr);
    },
    sinc: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "sinc" }]], {});
        return op_f(s, attr);
    },
    sinh: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "sinh" }]], {});
        return op_f(s, attr);
    },
    sup: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "sup" }]], {});
        return op_f(s, attr);
    },
    tan: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "tan" }]], {});
        return op_f(s, attr);
    },
    tg: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "tg" }]], {});
        return op_f(s, attr);
    },
    tanh: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "tanh" }]], {});
        return op_f(s, attr);
    },
    liminf: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "liminf" }]], {});
        return op_f(s, attr);
    },
    limsup: (attr: tree[]) => {
        let s = f.op([[{ type: "str", value: "limsup" }]], {});
        return op_f(s, attr);
    },
};

function op_f(s: HTMLElement, attr: tree[]) {
    if (attr) {
        let f = document.createDocumentFragment();
        f.append(s, kh(attr[0]));
        return f;
    } else {
        return s;
    }
}

function kh(tree: tree) {
    let f = document.createDocumentFragment();
    let l = document.createElement("ms");
    l.innerText = "(";
    let c = render(tree);
    let r = document.createElement("ms");
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
            if (s[x.value]) {
                let el = document.createElement("mo");
                el.innerText = s[x.value];
                fragment.append(el);
            } else {
                if (f[x.value]) {
                    let el = f[x.value]();
                    fragment.append(el);
                }
            }
        }

        if (x.type == "str") {
            let el = document.createElement("ms");
            el.innerText = x.value;
            fragment.append(el);
        }

        if (x.type == "v") {
            let el: HTMLElement;
            if (x.value.match(/[0-9]+/)) {
                el = document.createElement("mn");
            } else {
                el = document.createElement("mi");
            }
            el.innerText = x.value;
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
