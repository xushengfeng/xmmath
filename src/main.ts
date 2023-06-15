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
    attach: (attr: tree[], dic: fdic) => {},
    binom: (attr: tree[], dic: fdic) => {},
    cancel: (attr: tree[], dic: fdic) => {},
    cases: (attr: tree[], dic: fdic) => {},
    frac: (attr: tree[], dic: fdic) => {},
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
    op: (attr: tree[], dic: fdic) => {},
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
};

type fdic = { [id: string]: tree };

function render(tree: tree) {
    let fragment = document.createDocumentFragment();

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
            let type: "dic" | "array" | "attr" = "array";
            let attr: tree[] = [];
            let dicl: tree[] = [];
            let array: tree[][] = [];
            let l: tree = [];
            for (let t of tree[n + 1].children) {
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

            // 将dicl的tree转为键对
            let dic: fdic = {};
            for (let i of dicl) {
                let n = "";
                let t: tree = [];
                for (let el of i) {
                    if (!n) {
                        if (el.type == "f") {
                            n = el.value;
                        }
                    } else {
                        if (el.value != ":") t.push(el);
                    }
                }
                dic[n] = t;
            }

            if (f[x.value]) {
                let el = f[x.value](attr, dic, array);
                fragment.append(el);
            }
        }

        if (x.type == "f" && (!tree[n + 1] || tree[n + 1].value == '"' || tree[n + 1].type == "blank")) {
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
    }

    return fragment;
}

function toMML(str: string) {
    let obj = ast(str);
    console.log(obj);

    let mathEl = createEl("math");
    let f = render(obj);
    mathEl.append(f);
    return mathEl;
}

function toMMLHTML(str: string) {
    return toMML(str).innerHTML;
}

export { toMML, toMMLHTML };
