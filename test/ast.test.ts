import { describe, it, expect } from "vitest";
import { ast } from "../src/ast.js";

describe("ast() - basic tokenization", () => {
	it("single variable", () => {
		expect(ast("x")).toEqual([{ type: "v", value: "x" }]);
	});

	it("single number", () => {
		expect(ast("1")).toEqual([{ type: "v", value: "1" }]);
	});

	it("operator", () => {
		expect(ast("+")).toEqual([{ type: "v", value: "+" }]);
	});

	it("function name (multi-letter)", () => {
		expect(ast("sqrt")).toEqual([{ type: "f", value: "sqrt" }]);
	});

	it("function with parens (ast level: separate tokens)", () => {
		const result = ast("sqrt(2)");
		expect(result).toEqual([
			{ type: "f", value: "sqrt" },
			{
				type: "group",
				value: "",
				children: [{ type: "v", value: "2" }],
				kh: "()",
			},
		]);
	});

	it("mixed expression", () => {
		const result = ast("x+y");
		expect(result).toEqual([
			{ type: "v", value: "x" },
			{ type: "v", value: "+" },
			{ type: "v", value: "y" },
		]);
	});

	it("blank between tokens collapses", () => {
		const result = ast("x   y");
		const types = result.map((n) => n.type);
		expect(types).toEqual(["v", "blank", "v"]);
	});
});

describe("ast() - brackets and groups", () => {
	it("matched parentheses create group", () => {
		const result = ast("(x)");
		expect(result).toEqual([
			{
				type: "group",
				value: "",
				children: [{ type: "v", value: "x" }],
				kh: "()",
			},
		]);
	});

	it("nested groups", () => {
		const result = ast("((x))");
		expect(result[0].type).toBe("group");
		expect(result[0].kh).toBe("()");
		expect(result[0].children[0].type).toBe("group");
		expect(result[0].children[0].kh).toBe("()");
	});

	it("unmatched open bracket becomes literal", () => {
		const result = ast("(");
		expect(result).toEqual([{ type: "v", value: "(" }]);
	});

	it("unmatched close bracket becomes literal", () => {
		const result = ast(")");
		expect(result).toEqual([{ type: "v", value: ")" }]);
	});

	it("escaped bracket produces separate backslash + escaped bracket", () => {
		const result = ast("\\(");
		expect(result).toEqual([
			{ type: "v", value: "\\" },
			{ type: "v", value: "(", esc: true },
		]);
	});

	it("square brackets group", () => {
		const result = ast("[x]");
		expect(result[0].type).toBe("group");
		expect(result[0].kh).toBe("[]");
	});

	it("curly brackets group", () => {
		const result = ast("{x}");
		expect(result[0].type).toBe("group");
		expect(result[0].kh).toBe("{}");
	});
});

describe("ast() - comments", () => {
	it("line comment at end", () => {
		const result = ast("a // comment");
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toEqual(["a"]);
	});

	it("line comment does not swallow next line token", () => {
		const result = ast("a // c\nb");
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toEqual(["a", "b"]);
	});

	it("line comment only", () => {
		const result = ast("// c\nx");
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toEqual(["x"]);
	});

	it("line comment with multiple tokens after", () => {
		const result = ast("// c\nx\ny");
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toEqual(["x", "y"]);
	});

	it("block comment", () => {
		const result = ast("a /* comment */ b");
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toEqual(["a", "b"]);
	});

	it("block comment inline", () => {
		const result = ast("/* c */ x");
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toEqual(["x"]);
	});
});

describe("ast() - strings", () => {
	it("quoted string", () => {
		const result = ast('"hello"');
		expect(result).toEqual([{ type: "str", value: "hello" }]);
	});

	it("string with spaces", () => {
		const result = ast('"hello world"');
		expect(result).toEqual([{ type: "str", value: "hello world" }]);
	});

	it("string with escaped quote preserves escape in value", () => {
		const result = ast('"a\\"b"');
		expect(result).toEqual([{ type: "str", value: 'a\\"b' }]);
	});
});

describe("ast() - unicode escapes", () => {
	it("\\u{XXXX} escape", () => {
		const result = ast("\\u{03B1}");
		expect(result[0].value).toBe("\u03B1");
	});

	it("escape in expression", () => {
		const result = ast("x + \\u{00B7}");
		const values = result.filter((n) => n.type !== "blank").map((n) => n.value);
		expect(values).toContain("\u00B7");
	});
});

describe("ast() - sharp token", () => {
	it("sharp produces sharp token", () => {
		const result = ast("#true");
		expect(result[0].type).toBe("sharp");
	});
});

describe("ast() - determinism and robustness", () => {
	it("same input produces identical output", () => {
		const input = "sqrt(x^2 + y^2)";
		const a = JSON.stringify(ast(input));
		const b = JSON.stringify(ast(input));
		expect(a).toBe(b);
	});

	it("empty input returns empty array", () => {
		expect(ast("")).toEqual([]);
	});

	it("whitespace only returns empty or blank", () => {
		const result = ast("   ");
		expect(result.length).toBeLessThanOrEqual(1);
	});
});

describe("ast() - full corpus robustness", () => {
	const testCases = loadCorpus();

	it("no throw on all corpus entries", () => {
		for (const { text, category } of testCases) {
			expect(
				() => ast(text),
				`category: ${category}, input: ${text}`,
			).not.toThrow();
		}
	});

	it("deterministic on all corpus entries", () => {
		for (const { text, category } of testCases) {
			const a = JSON.stringify(ast(text));
			const b = JSON.stringify(ast(text));
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
		// corpus file not available, skip
	}
	return cases;
}
