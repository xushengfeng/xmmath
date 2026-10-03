import { describe, it, expect } from "vitest";
import { ast } from "../src/ast.js";
import { ast2, ast3 } from "../src/normalize.js";

// 无 DOM 环境（node）即可运行：证明 ast2/ast3 归一化阶段不依赖 document
function normalize(str: string) {
	return ast3(ast2(ast(str)));
}

describe("ast2() - number assembly", () => {
	it("merges consecutive digits", () => {
		const result = ast2(ast("12"));
		expect(result).toEqual([{ type: "v", value: "12" }]);
	});

	it("merges decimal number", () => {
		const result = ast2(ast("3.5"));
		expect(result).toEqual([{ type: "v", value: "3.5" }]);
	});

	it("does not merge across non-digits", () => {
		const result = ast2(ast("1+x2"));
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toEqual(["1", "+", "x", "2"]);
	});
});

describe("ast2() - escape processing", () => {
	it("double backslash becomes escaped backslash", () => {
		const result = ast2(ast("\\\\"));
		expect(result).toEqual([{ type: "v", value: "\\", esc: true }]);
	});

	it("backslash + sharp becomes literal #", () => {
		const result = ast2(ast("\\#"));
		expect(result).toEqual([{ type: "v", value: "#" }]);
	});

	it("backslash before token marks it escaped", () => {
		const result = ast2(ast("\\+"));
		expect(result).toEqual([{ type: "v", value: "+", esc: true }]);
	});
});

describe("ast3() - shorthand", () => {
	it("-> becomes arrow.r with src", () => {
		const result = normalize("a->b");
		expect(result).toContainEqual({ type: "f", value: "arrow.r", src: "->" });
	});

	it("... becomes dots.h", () => {
		const result = normalize("a...b");
		expect(result).toContainEqual({ type: "f", value: "dots.h", src: "..." });
	});

	it(">= becomes gt.eq", () => {
		const result = normalize("a>=b");
		expect(result).toContainEqual({ type: "f", value: "gt.eq", src: ">=" });
	});
});

describe("ast3() - dot-notation merge", () => {
	it("merges f . v into dotted function name", () => {
		const result = normalize("arrow.r");
		expect(result).toEqual([{ type: "f", value: "arrow.r" }]);
	});

	it("merges multi-level dots", () => {
		const result = normalize("arrow.r.double");
		expect(result).toEqual([{ type: "f", value: "arrow.r.double" }]);
	});
});

describe("ast3() - attach (^_)", () => {
	it("superscript becomes attach with tr", () => {
		const result = normalize("x^2");
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("f");
		expect(result[0].value).toBe("attach");
	});

	it("subscript becomes attach with br", () => {
		const result = normalize("x_1");
		expect(result[0].value).toBe("attach");
	});

	it("combined sub+sup", () => {
		const result = normalize("x_1^2");
		expect(result[0].value).toBe("attach");
	});
});

describe("ast3() - fraction (/)", () => {
	it("slash becomes frac", () => {
		const result = normalize("1/2");
		expect(result[0].type).toBe("f");
		expect(result[0].value).toBe("frac");
	});
});

describe("ast3() - function argument binding", () => {
	it("sqrt(2) binds group as children", () => {
		const result = normalize("sqrt(2)");
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("f");
		expect(result[0].value).toBe("sqrt");
		expect(result[0].children).toBeDefined();
	});
});

describe("ast3() - direct-argument symbols (data, not DOM)", () => {
	it("√x attaches next token as argument", () => {
		const result = normalize("√x");
		expect(result[0].type).toBe("f");
		expect(result[0].value).toBe("√");
		expect(result[0].children).toBeDefined();
	});
});

describe("ast3() - prime and factorial", () => {
	it("prime becomes attach", () => {
		const result = normalize("x'");
		expect(result[0].value).toBe("attach");
	});

	it("prime followed by a group keeps the group (f'(x))", () => {
		const result = normalize("f'(x)");
		// should be [attach(f, tr:prime), group(x)] — the (x) must NOT be swallowed by prime
		expect(result).toHaveLength(2);
		expect(result[0].value).toBe("attach");
		expect(result[1].type).toBe("group");
		expect(result[1].kh).toBe("()");
		expect(result[1].children).toEqual([{ type: "v", value: "x" }]);
	});

	it("double prime followed by a group keeps the group (f''(x))", () => {
		const result = normalize("f''(x)");
		expect(result).toHaveLength(2);
		expect(result[0].value).toBe("attach");
		expect(result[1].type).toBe("group");
	});

	it("factorial groups preceding token", () => {
		const result = ast2(ast("n!"));
		const after = ast3(result);
		// ! bound tightly; result should be non-empty and not throw
		expect(after.length).toBeGreaterThan(0);
	});
});

describe("normalize pipeline - determinism and robustness", () => {
	const cases = loadCorpus();

	it("no throw and deterministic on all corpus entries", () => {
		for (const { text, category } of cases) {
			let a: string;
			try {
				a = JSON.stringify(normalize(text));
			} catch (e) {
				expect.fail(`category ${category} threw: ${e}`);
				continue;
			}
			const b = JSON.stringify(normalize(text));
			expect(a, `category: ${category}, input: ${text}`).toBe(b);
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
		// corpus not available
	}
	return cases;
}
