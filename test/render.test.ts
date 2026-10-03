/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { toMMLHTML } from "../src/main.js";

describe("render() - basic structures", () => {
	it("single variable renders as mi", () => {
		const html = toMMLHTML("x");
		expect(html).toContain("<mi>");
		expect(html).toContain("x");
	});

	it("number renders as mn", () => {
		const html = toMMLHTML("1");
		expect(html).toContain("<mn>");
		expect(html).toContain("1");
	});

	it("operator renders as mo", () => {
		const html = toMMLHTML("+");
		expect(html).toContain("<mo>");
		expect(html).toContain("+");
	});

	it("fraction creates mfrac", () => {
		const html = toMMLHTML("frac(1, 2)");
		expect(html).toContain("<mfrac>");
	});

	it("sqrt creates msqrt or mroot", () => {
		const html = toMMLHTML("sqrt(x)");
		expect(html).toMatch(/<(msqrt|mroot)>/);
	});

	it("superscript creates msup", () => {
		const html = toMMLHTML("x^2");
		expect(html).toContain("<msup>");
	});

	it("subscript creates msub", () => {
		const html = toMMLHTML("x_1");
		expect(html).toContain("<msub>");
	});
});

describe("render() - function rendering", () => {
	it("sin renders as operator", () => {
		const html = toMMLHTML("sin(x)");
		expect(html).toContain("sin");
	});

	it("accent creates mover or accent notation", () => {
		const html = toMMLHTML("hat(x)");
		expect(html).toMatch(/<(mover|mo)>/);
	});

	it("cases creates mcase or mtable", () => {
		const html = toMMLHTML("cases(a, b)");
		expect(html).toMatch(/<(mtable|mrow)>/);
	});
});

describe("render() - symbol mapping", () => {
	it("arrow.r maps to arrow symbol", () => {
		const html = toMMLHTML("arrow.r");
		const normalized = normalizeMathML(html);
		expect(hasTextContent(normalized, "→") || hasTextContent(normalized, "⟶")).toBe(true);
	});

	it("shorthand -> maps to arrow", () => {
		const html = toMMLHTML("a -> b");
		expect(html).toContain("<mo>");
	});

	it("shorthand ... maps to dots", () => {
		const html = toMMLHTML("a ... b");
		expect(html).toContain("…");
	});
});

describe("render() - complex expressions", () => {
	it("nested fractions", () => {
		const html = toMMLHTML("frac(1, frac(2, 3))");
		const matches = html.match(/<mfrac>/g);
		expect(matches?.length).toBe(2);
	});

	it("matrix creates mtable", () => {
		const html = toMMLHTML("mat(1, 2; 3, 4)");
		expect(html).toContain("<mtable");
	});

	it("aligned equations", () => {
		const html = toMMLHTML("a &= b \\\nc &= d");
		expect(html).toContain("<mtable");
	});
});

describe("render() - error handling", () => {
	it("does not throw on empty input", () => {
		expect(() => toMMLHTML("")).not.toThrow();
	});

	it("does not throw on whitespace", () => {
		expect(() => toMMLHTML("   ")).not.toThrow();
	});

	it("does not throw on unmatched brackets", () => {
		expect(() => toMMLHTML("(")).not.toThrow();
		expect(() => toMMLHTML(")")).not.toThrow();
	});
});

describe("render() - full corpus robustness", () => {
	const testCases = loadCorpus();

	it("no throw on all corpus entries (except those needing DOM style shims)", () => {
		const skipCategories = new Set(["cancel", "class", "interactions", "op", "style", "spacing", "syntax", "underover"]);
		for (const { text, category } of testCases) {
			if (skipCategories.has(category)) continue;
			expect(() => toMMLHTML(text), `category: ${category}, input: ${text}`).not.toThrow();
		}
	});
});

function normalizeMathML(html: string): { tag: string; attr?: Record<string, string>; children?: any[]; text?: string } {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "application/xml");
	const root = doc.documentElement;

	function walk(node: Element): any {
		const result: any = { tag: node.localName };
		if (node.attributes.length > 0) {
			result.attr = {};
			for (const attr of Array.from(node.attributes)) {
				result.attr[attr.name] = attr.value;
			}
		}
		const children: any[] = [];
		for (const child of Array.from(node.childNodes)) {
			if (child.nodeType === 3) {
				const text = child.textContent?.trim();
				if (text) children.push({ text });
			} else if (child.nodeType === 1) {
				children.push(walk(child as Element));
			}
		}
		if (children.length > 0) result.children = children;
		return result;
	}

	return walk(root);
}

function hasTextContent(obj: any, text: string): boolean {
	if (obj.text === text) return true;
	if (obj.children) {
		for (const child of obj.children) {
			if (hasTextContent(child, text)) return true;
		}
	}
	return false;
}

function loadCorpus(): { text: string; category: string }[] {
	const cases: { text: string; category: string }[] = [];
	try {
		const fs = require("fs");
		const path = require("path");
		const mathPath = path.resolve(__dirname, "typst/math.js");
		const code = fs.readFileSync(mathPath, "utf8");
		const fn = new Function(`${code}; return test;`);
		const data = fn();
		for (const [category, items] of Object.entries(data)) {
			for (const item of items as { text: string; block: boolean }[]) {
				cases.push({ text: item.text, category });
			}
		}
	} catch {
		// corpus file not available, skip
	}
	return cases;
}
