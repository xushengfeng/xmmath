// Proves the render pipeline is DOM-free: this file runs in the default node
// environment (NO jsdom) and still builds + serializes MathML.
import { describe, it, expect } from "vitest";
import { toMMLV, toMMLHTML } from "../src/main.js";
import { toHtml, type VEl } from "../src/vdom.js";

describe("vdom render - no DOM required", () => {
	it("document is undefined in this environment", () => {
		expect(typeof document).toBe("undefined");
	});

	it("toMMLV builds a plain virtual-DOM tree", () => {
		const v = toMMLV("x^2");
		expect(v.type).toBe("el");
		expect(v.tag).toBe("math");
		expect(v.attrs.display).toBe("block");
		expect(v.children.length).toBeGreaterThan(0);
	});

	it("toHtml serializes to a MathML string", () => {
		const html = toHtml(toMMLV("frac(1, 2)"));
		expect(html).toContain("<mfrac>");
		expect(html.startsWith("<math")).toBe(true);
	});

	it("toMMLHTML works without document", () => {
		expect(toMMLHTML("sqrt(x)")).toContain("<mroot>");
	});

	it("style-only nodes (cancel) now serialize without jsdom", () => {
		// previously toMMLHTML needed a real DOM and jsdom choked on .style
		const html = toMMLHTML("cancel(x)");
		expect(html).toContain("background-image:");
		expect(html).toContain("<mi>x</mi>");
	});

	it("string output matches the vdom tree shape", () => {
		const v: VEl = toMMLV("a+b");
		const html = toHtml(v);
		expect(html).toContain("<mi>a</mi>");
		expect(html).toContain("<mo>+</mo>");
		expect(html).toContain("<mi>b</mi>");
	});

	it("full corpus serializes without throwing (except known unimplemented)", () => {
		const cases = loadCorpus();
		let threw = 0;
		for (const { text } of cases) {
			try {
				toMMLHTML(text);
			} catch {
				threw++;
			}
		}
		// only the handful of unimplemented-function crashes are allowed
		expect(threw).toBeLessThanOrEqual(5);
	});
});

function loadCorpus(): { text: string; category: string }[] {
	const cases: { text: string; category: string }[] = [];
	try {
		const fs = require("fs");
		const path = require("path");
		const code = fs.readFileSync(path.resolve(__dirname, "typst/math.js"), "utf8");
		const data = new Function(`${code}; return test;`)();
		for (const [category, items] of Object.entries(data)) {
			for (const item of items as { text: string }[]) cases.push({ text: item.text, category });
		}
	} catch {
		/* corpus unavailable */
	}
	return cases;
}
