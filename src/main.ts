function createEl<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
function createEl<K extends keyof HTMLElementDeprecatedTagNameMap>(tagName: K): HTMLElementDeprecatedTagNameMap[K];
function createEl(tagName: string): HTMLElement;
function createEl(tagname: string) {
    return document.createElement(tagname);
}

function ast(str: string) {
    let v = /[a-zA-Z]/;
    let kh = /[\(\)]/;
    let blank = /[ \t\n\r]+/;
    type vtype = "" | "str" | "v" | "f" | "blank" | "group";
    type tree = { type: vtype; value: string; children?: tree }[];
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

        // 原始值（字母变量、数字、符号
        if (
            type == "" &&
            (!str[i - 1] || !str[i - 1].match(v)) &&
            (!str[i + 1] || !str[i + 1].match(v)) &&
            !t.match(kh)
        ) {
            type = "v";
            now_tree.push({ type, value: t });
            type = "";
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

function toMML(str: string) {
    let obj = ast(str);
    console.log(obj);

    let mathEl = createEl("math");
    return mathEl;
}

function toMMLHTML(str: string) {
    return toMML(str).innerHTML;
}

export { toMML, toMMLHTML };
