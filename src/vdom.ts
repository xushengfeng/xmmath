// Virtual DOM for MathML. `createMath`/`createFragment` return plain objects
// that mimic the small subset of the DOM the render code uses (.append,
// .setAttribute/.getAttribute, .style, .children, .textContent, .innerHTML,
// .querySelectorAll), so the renderer builds a VNode tree with no `document`.
// The tree is then materialized by exactly one of:
//   - toHtml(node): MathML string   (DOM-free)
//   - toDom(node) : real MathML DOM (the only place `document` is touched)

export class VText {
	readonly type = "text" as const;
	constructor(public text: string) {}
}

export class VFragment {
	readonly type = "frag" as const;
	readonly childNodes: VNode[] = [];
	append(...kids: (VNode | VNode[] | null | undefined)[]) {
		pushNodes(this.childNodes, kids);
	}
}

export class VEl {
	readonly type = "el" as const;
	readonly attrs: { [k: string]: string } = {};
	readonly style: { [k: string]: string } = {};
	readonly childNodes: VNode[] = [];
	constructor(
		readonly tag: string,
		innerText?: string | null,
		attr?: { [k: string]: string } | null,
	) {
		if (innerText) this.childNodes.push(new VText(innerText));
		if (attr) for (const k in attr) this.attrs[k] = attr[k];
	}

	append(...kids: (VNode | VNode[] | null | undefined)[]) {
		pushNodes(this.childNodes, kids);
	}
	setAttribute(k: string, v: string) {
		this.attrs[k] = v;
	}
	getAttribute(k: string): string | null {
		return this.attrs[k] ?? null;
	}
	get children(): VEl[] {
		return this.childNodes.filter((n): n is VEl => n.type === "el");
	}
	get textContent(): string {
		return this.childNodes
			.filter((n): n is VText => n.type === "text")
			.map((n) => n.text)
			.join("");
	}
	set textContent(v: string) {
		this.childNodes.length = 0;
		if (v) this.childNodes.push(new VText(v));
	}
	get innerHTML(): string {
		return this.childNodes.map(serialize).join("");
	}
	set innerHTML(v: string) {
		this.childNodes.length = 0;
		this.childNodes.push(new VText(v));
	}
	querySelectorAll(sel: string): VEl[] {
		const out: VEl[] = [];
		collect(this, sel, out);
		return out;
	}
}

export type VNode = VEl | VText | VFragment;

function pushNodes(
	target: VNode[],
	kids: (VNode | VNode[] | null | undefined)[],
) {
	for (const k of kids) {
		if (!k) continue;
		if (Array.isArray(k)) {
			pushNodes(target, k);
			continue;
		}
		// fragments are inlined, matching DOM append(fragment)
		if (k.type === "frag") target.push(...k.childNodes);
		else target.push(k);
	}
}

function collect(node: VEl | VFragment, sel: string, out: VEl[]) {
	for (const c of node.childNodes) {
		if (c.type === "el") {
			if (c.tag === sel) out.push(c);
			collect(c, sel, out);
		} else if (c.type === "frag") {
			collect(c, sel, out);
		}
	}
}

// ---- builders (DOM-shaped) ----
export function createMath(
	tag: string,
	innerText?: string | null,
	attr?: { [k: string]: string } | null,
): VEl {
	return new VEl(tag, innerText, attr);
}

export function createFragment(): VFragment {
	return new VFragment();
}

// ---- serialization ----
function camelToKebab(k: string) {
	return k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}
function escText(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\u00A0/g, "&nbsp;");
}
function escAttr(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/\u00A0/g, "&nbsp;");
}

function serialize(node: VNode): string {
	if (node.type === "text") return escText(node.text);
	if (node.type === "frag") return node.childNodes.map(serialize).join("");
	let s = `<${node.tag}`;
	for (const k in node.attrs) s += ` ${k}="${escAttr(node.attrs[k])}"`;
	const st = Object.keys(node.style);
	if (st.length) {
		const css = st.map((k) => `${camelToKebab(k)}: ${node.style[k]}`).join("; ");
		s += ` style="${escAttr(css)}"`;
	}
	s += ">";
	s += node.childNodes.map(serialize).join("");
	s += `</${node.tag}>`;
	return s;
}

export function toHtml(node: VNode): string {
	return serialize(node);
}

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

// Materialize into real MathML DOM. The ONLY place `document` is touched.
export function toDom(
	node: VNode,
	doc: Document = globalThis.document,
): MathMLElement | DocumentFragment | Text {
	if (node.type === "text") return doc.createTextNode(node.text);
	if (node.type === "frag") {
		const f = doc.createDocumentFragment();
		for (const c of node.childNodes) f.append(toDom(c, doc) as Node);
		return f;
	}
	const e = doc.createElementNS(MATHML_NS, node.tag) as MathMLElement;
	for (const k in node.attrs) e.setAttribute(k, node.attrs[k]);
	for (const k in node.style)
		(e.style as unknown as Record<string, string>)[k] = node.style[k];
	for (const c of node.childNodes) e.append(toDom(c, doc) as Node);
	return e;
}
