# xmmath

## 简介（introduction）

苦 $\LaTeX$ 久矣！

Bitter $\LaTeX$ for a long time!

使用 $\LaTeX$ 输入数学公式，需要键入太多的`\`、`{}`和`\frac{}{}`。符号命名各种各样。

Using $\LaTeX$ to enter mathematical formulas, you need to type too many `\`, `{}` and `\frac{}{}`. There are all kinds of symbol names.

大家说，要有光，于是[typst](https://github.com/typst/typst)出现了！尽管他还很新，并且还没那么好，但他的数学输入还是很舒服的。

people said, "Let there be light," so [typst](https://github.com/typst/typst) appeared! Although he is still new and not that good, his math input is still very comfortable.

千呼万唤使出来，Chrome(>=109) 终于勉强支持部分在 Firefox 中早已支持的[MathMl](https://developer.mozilla.org/en-US/docs/Web/MathML)

After thousands of calls, Chrome (> = 109) finally reluctantly supported some of the [MathMl](https://developer.mozilla.org/en-US/docs/Web/MathML) already supported in Firefox.

为了在我的笔记软件[xlinkote](https://github.com/xushengfeng/xlinkote)上更好地书写数学公式，我构建了这个 typst 数学语法转 MathMl 的库，并允许引用。

In order to better write mathematical formulas on my note-taking software [xlinkote](https://github.com/xushengfeng/xlinkote), I built this library of typst mathematical syntax to MathMl and allowed references.

## 安装（installation）

```js
import xmmath from xmmath
```

```html
<script src="./dist/xmmath.umd.js"></script>
<script>
    let div = document.createElement("div");
    div.innerHTML = xmmath.toMMLHTML("e^(i pi)=-1");
    document.body.append(div);
</script>
```

## 语法简介（introduction to Syntax）

详细语法请前往[typst docs](https://typst.app/docs)查看。很遗憾由于个人能力有限，只能实现部分语法，并且存在某些表现与 typst 不同。

For more details, please go to [typst docs](https://typst.app/docs) for more information. Unfortunately, due to the limited personal ability, only part of the grammar can be implemented, and some performance is different from that of typst.

-   数学变量为单个英文字母
-   函数为多个字母串，可包含`.`，后可接括号传递参数：`sum` `gt.eq`(显示`≥`[符号](https://typst.app/docs/reference/symbols/sym/)) `sqrt(2)` `root(2,4)`
-   字符串使用`"`包裹，可用`\"`转义
-   `^_`为上下标，数字可连在一起：`2^10`。`/`为除法，可用函数`frac(1,2)`。他们可用`()`消除歧义。

-   Mathematical variables are a single English letter.
-   the function is a string of letters and can contain `.`, followed by parentheses to pass the parameter: `sum` `gt.eq` (display `≥` [symbol](https://typst.app/docs/reference/symbols/sym/) `sqrt(2)` `root(2，4)`).
-   string is wrapped with `"`, and can be escaped with `\"`.
-   `^_`is the superscript, and the numbers can be linked together: `2^10`. `/` is division, and the function `frac(1，2)`is available. They can use `()`to disambiguate.
