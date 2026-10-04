// Proves the render pipeline is DOM-free: this file runs in the default node
// environment (NO jsdom) and still builds + serializes MathML.
import { describe, it, expect } from "vitest";
import { toMMLV, toMMLHTML } from "../src/main.js";
import { toHtml, type VEl } from "../src/vdom.js";
import { allCases, knownBroken } from "./corpus/_shared.js";

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
		const threw: string[] = [];
		for (const { id, text } of allCases()) {
			try {
				toMMLHTML(text);
			} catch {
				threw.push(id);
			}
		}
		expect(threw.sort()).toEqual([...knownBroken].sort());
	});
});
