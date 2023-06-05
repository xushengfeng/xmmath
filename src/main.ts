function createEl<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
function createEl<K extends keyof HTMLElementDeprecatedTagNameMap>(tagName: K): HTMLElementDeprecatedTagNameMap[K];
function createEl(tagName: string): HTMLElement;
function createEl(tagname: string) {
    return document.createElement(tagname);
}
function toMML(str: string) {
    let mathEl = createEl("math");
    return mathEl;
}

function toMMLHTML(str: string) {
    return toMML(str).innerHTML;
}

export { toMML, toMMLHTML };
