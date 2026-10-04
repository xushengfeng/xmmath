// 手工维护的针对性用例：调试某个语法/渲染问题时写在这里，用普通断言，不进快照。
// 整份语料在 test/corpus/math.test.ts，阶段单测在 test/{ast,normalize,vdom,render}.test.ts。
import { describe, expect, it } from "vitest";
import { toMMLHTML, toMMLV } from "../src/main.js";
import { toHtml, type VEl } from "../src/vdom.js";

// 某个标签在树里的直接子元素个数（MathML 对多数结构有固定元数要求）
function arityOf(tag: string, str: string): number[] {
	const out: number[] = [];
	const walk = (n: VEl) => {
		if (n.tag === tag) out.push(n.children.length);
		for (const c of n.children) walk(c);
	};
	walk(toMMLV(str) as VEl);
	return out;
}

describe("custom - 已确认行为", () => {
	it("mat 的 delim 接受单字符围栏", () => {
		const html = toMMLHTML('mat(delim: "|", 1, 2; 3, 4)');
		expect(html).toContain("<mtable");
		expect(html.startsWith('<math display="block"><mrow><mo>|</mo>')).toBe(
			true,
		);
		expect(html).toContain("<mo>|</mo></mrow></math>");
	});

	it('mat 的 delim "||" 仍按 0.11 语义映射为 ‖（0.12+ 已移除该写法）', () => {
		expect(toMMLHTML('mat(delim: "||", 1, 2; 3, 4)')).toContain("<mo>‖</mo>");
	});

	it("行内与块级由 display 属性区分", () => {
		// 注意 toMMLHTML 目前恒为 block（内部调用 toMMLV 时没传 inline）
		expect(toHtml(toMMLV("x", true))).not.toContain('display="block"');
		expect(toHtml(toMMLV("x", false))).toContain('display="block"');
	});
});

describe("custom - 已知缺陷（修好前用 it.fails 占位）", () => {
	it.fails("sqrt(x) 应为 msqrt，而不是带空指数的 mroot", () => {
		expect(toMMLHTML("sqrt(x)")).toContain("<msqrt>");
	});

	it.fails("munder/mover 必须有两个子元素", () => {
		expect(arityOf("munder", "underline(x)")).toEqual([2]);
	});
});
