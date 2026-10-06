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
		expect(toHtml(toMMLV("x", true))).not.toContain('display="block"');
		expect(toHtml(toMMLV("x", false))).toContain('display="block"');
		// toMMLHTML 透传 inline：默认块级，true 走行内
		expect(toMMLHTML("x")).toContain('display="block"');
		expect(toMMLHTML("x", true)).not.toContain('display="block"');
	});

	it("inline 上下文下大算符走角标（toMMLHTML 透传）", () => {
		expect(toMMLHTML("sum_1^2")).toContain("<munderover>");
		expect(toMMLHTML("sum_1^2", true)).toContain("<msubsup>");
	});
});

describe("custom - 已知缺陷（修好前用 it.fails 占位）", () => {
	it("sqrt(x) 应为 msqrt，而不是带空指数的 mroot", () => {
		expect(toMMLHTML("sqrt(x)")).toContain("<msqrt>");
		expect(toMMLHTML("sqrt(x)")).not.toContain("<mroot>");
	});

	it.fails("munder/mover 必须有两个子元素", () => {
		expect(arityOf("munder", "underline(x)")).toEqual([2]);
	});
});

describe("custom - display/inline 上下文", () => {
	const html = (s: string, inline: boolean) => toHtml(toMMLV(s, inline));

	it("大算符只在 display 走上下，inline 走角标", () => {
		expect(html("sum_1^2", false)).toContain("<munderover>");
		expect(html("sum_1^2", true)).toContain("<msubsup>");
	});

	it("嵌套在 lr/abs/sqrt/mat 里的子树继承同一模式", () => {
		for (const s of [
			"lr(sum_1^2)",
			"abs(sum_1^2)",
			"sqrt(sum_1^2)",
			"mat(sum_1^2, 2)",
		]) {
			expect(html(s, true), s).toContain("<msubsup>");
			expect(html(s, false), s).toContain("<munderover>");
		}
	});

	it("mat/vec 单元格始终居中，与 display 无关", () => {
		for (const inline of [true, false])
			expect(html("vec(1, 222222)", inline)).toContain('columnalign="center"');
	});

	it("关系类算子的上下不受模式影响", () => {
		for (const inline of [true, false])
			expect(html('a =^"def" c', inline), String(inline)).toContain(
				"<munderover>",
			);
	});

	it("函数调用形式的同名符号不算运算符本体（tilde(x) 的脚本走角标）", () => {
		expect(html("tilde(integral)_a^b", false)).toContain("<msubsup>");
	});

	// 语料 display-1 / display-2（typst 0.11.1 逐像素核对）：
	// inline()/display() 改写的是局部 display 标志，limits 判定跟它走，
	// 与外层块级/行内无关；gcd（opl.limits）与 sum（Large 类）同判。
	it("inline()/display() 覆盖外层模式，∑ 与 gcd 同判", () => {
		expect(html("inline(sum^x_y gcd^x_y)", false)).toContain("<msubsup>");
		expect(html("inline(sum^x_y gcd^x_y)", false)).not.toContain("<munderover>");
		expect(html("display(sum^x_y gcd^x_y)", true)).toContain("<munderover>");
		expect(html("display(sum^x_y gcd^x_y)", true)).not.toContain("<msubsup>");
	});

	it("script/sscript 同样压回角标（0.11.1 实测与 inline 同效）", () => {
		expect(html("script(sum_1^2)", false)).toContain("<msubsup>");
		expect(html("sscript(gcd^x_y)", false)).toContain("<msubsup>");
	});

	it("局部样式是栈：内层覆盖外层", () => {
		expect(html("display(script(sum_1^2))", false)).toContain("<msubsup>");
		expect(html("script(display(sum_1^2))", false)).toContain("<munderover>");
	});

	it("局部模式向嵌套子树继承（lr/sqrt）", () => {
		expect(html("inline(lr(sum_1^2))", false)).toContain("<msubsup>");
		expect(html("display(sqrt(sum_1^2))", true)).toContain("<munderover>");
	});

	// 未验证、保持现状：x_table 读的是同一个 display 标志，故嵌套在
	// display()/inline() 里的多行（\\）对齐会跟着局部模式走；官方只核对过
	// 块级公式里的 inline() 仍居中（≠ 行内贴左），嵌套行内/块级的行对齐
	// 未逐例核过，语料也无覆盖 —— 不动它，等有官方图再定。

	it("inline() 里关系类算子仍走上/下（Always 不受模式影响）", () => {
		expect(html('inline(a =^"def" c)', false)).toContain("<munderover>");
	});

	// MathML Core 里 displaystyle/scriptlevel 是 mstyle 的属性，挂在 mrow 上
	// 浏览器会忽略（∑ 的大小与脚标层级随之失真）。
	it("display/inline/script/sscript 用 mstyle 承载 displaystyle/scriptlevel", () => {
		expect(html("display(sum_1^2)", true)).toContain(
			'<mstyle displaystyle="true">',
		);
		expect(html("inline(sum_1^2)", false)).toContain(
			'<mstyle displaystyle="false" scriptlevel="0">',
		);
		expect(html("script(sum_1^2)", false)).toContain(
			'<mstyle displaystyle="false" scriptlevel="1">',
		);
		expect(html("sscript(sum_1^2)", false)).toContain(
			'<mstyle displaystyle="false" scriptlevel="2">',
		);
	});
});

describe("custom - 关系/箭头类的上下判定（语料无覆盖，靠这里兜住）", () => {
	const html = (s: string) => toHtml(toMMLV(s, false));

	it("tack/harpoon/arrows/tilde 变体作基底时脚本走上下", () => {
		for (const base of [
			"tack.r",
			"tack.l",
			"harpoon.rt",
			"harpoons.rtlb",
			"arrows.rr",
			"tilde.equiv",
			"dash.colon",
		])
			expect(html(`a ${base}^b c`), base).toMatch(/<m(over|underover)/);
	});

	it("同族符号的脚本仍可被 scripts() 强制回角标", () => {
		expect(html("a scripts(tack.r)^b c")).toContain("<msup>");
	});
});
