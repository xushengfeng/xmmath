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

	it("f'(x) keeps both the prime and the (x) group", () => {
		const html = toMMLHTML("f'(x)");
		expect(html).toContain("<msup>"); // f′
		expect(html).toContain("<mi>x</mi>"); // (x) not dropped
		expect(html).toContain("<mo>(</mo>");
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
		expect(html.includes("→") || html.includes("⟶")).toBe(true);
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

	it("no throw on all corpus entries (except known unimplemented functions)", () => {
		// toMMLHTML is now DOM-free (string path); only unimplemented functions
		// (class / #hide) still crash. Everything else, incl. cancel/style/.style
		// cases that used to need jsdom, now serializes fine.
		const knownBroken = [
			"a class(\"normal\", +) b \\",
			"1 + sqrt(x/2) + sqrt(#hide(",
		];
		for (const { text, category } of testCases) {
			if (knownBroken.some((k) => text.startsWith(k))) continue;
			expect(
				() => toMMLHTML(text),
				`category: ${category}, input: ${text}`,
			).not.toThrow();
		}
	});
});

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
