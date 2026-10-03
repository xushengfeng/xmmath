# Typst 数学语法版本行为示例（旧版 vs 新版对照）

配套文档：`docs/math-syntax-typst-diff.md`（变更清单与裁决表）。

本文用**可粘贴的 typst 源码**演示每个版本敏感点：每例给出
- `input` —— typst 源码
- **旧版行为**（xmmath 基线 v0.11.1 / 引入前）
- **新版行为**（v0.15.1，标注引入版本）
- **xmmath 现状**

> 来源：各版本 changelog（`typst/typst` releases + `docs/content/changelog/*.typ` @ v0.15.1）与 codex CHANGELOG。以下"新版行为"以 changelog 为准；本环境装有 typst 0.15.1，若需逐条实机核验可另行运行（本文件未附实机渲染图）。
> 标记：🆕新增 · 🔄行为变更 · ⚠️破坏性 · ❌现在会报错 · 🟢已支持 · 🟡解析得到但渲染忽略 · 🔴未支持

---

## A. Shorthand `~`：从普通波浪/空格 → `tilde.op`（0.12）

```typst
$a ~ b$
```
- **旧版 (≤0.11)**：`~` 走普通波浪号/不换行空格一类。
- **新版 (0.12+)**：`~` 绑定 `tilde.op`（`∼`），且该 tilde 是可调用 accent 形态。
- **xmmath**：🟡 `~` → `space.nobreak`（`src/normalize.ts` shorthand），与 0.12+ **不一致**。若要贴近新版，应把 `~` 目标改为 `tilde.op`，或按空格/操作符分场景处理。

---

## B. 矩阵分隔符 `delim:"||"` 被移除（0.12，破坏性）

```typst
// 旧版可用：
$mat(delim: "||", 1, 2; 3, 4)$        // ❌ 0.12+ 不再接受多字符 "||"
// 新版写法（任选其一）：
$mat(delim: bar.double, 1, 2; 3, 4)$  // 🆕 用符号
$mat(delim: "|", 1, 2; 3, 4)$          // 🆕 delim 现接受任意单 Unicode fence
```
- **旧版 (0.11)**：`delim` 支持字符串 `"||"` 映射到双竖线。
- **新版 (0.12+)**：多字符串非法；改传符号或任意单个围栏字符。
- **xmmath**：⚠️ `delimPair` 仍把 `"||"`→`‖ ‖`（`src/main.ts:42-49`），保留了新版已废弃的行为。

---

## C. `mat`/`vec` 的 `align` 参数（0.12 新增）

```typst
$mat(1, 2; 3, 4, align: #left)$
$vec(1, 2, 3, align: #center)$
```
- **旧版**：无 `align`，按默认列对齐。
- **新版 (0.12+)**：`align` 控制每列内容对齐。
- **xmmath**：🔴 `f_attr` 能解析出 `dic.align`，但 `mat`/`vec` 渲染未读取（`src/main.ts:206`、`378`）。

---

## D. `stretch` 函数（0.12 新增）

```typst
$stretch("|", size: 150%)$
```
- **旧版**：无 `stretch`。
- **新版 (0.12+)**：显式把字形按基础尺寸的百分比拉伸（0.15 进一步改了 `size` 解析基准）。
- **xmmath**：🔴 无 `stretch`（`f` 注册表缺）。

---

## E. 可调用符号：`floor`/`ceil` 及分隔符塌缩成 `lr`（0.12 / 0.15）

```typst
// 0.12：floor/ceil 成为可调用符号
$floor(x) = lr(floor.l x floor.r)$
$ceil(x/2)$
// 0.15：更多"围栏类"符号调用即生成 lr（而非 符号 + 一个 (..) 组）
$chevron.l(x)$
```
- **旧版 (0.11)**：`floor(x)` 里的 `floor` 只是名字；`chevron.l(x)` = `chevron.l` 后接 `(x)` 组。
- **新版**：`floor/ceil` 调用→ `lr` 围栏（0.12）；`chevron.l(x)`→配对围栏 `lr`（0.15，破坏性）。
- **xmmath**：🟡 有 `floor`/`ceil`（`lr_f`，`src/main.ts:578`）但没有 `.l`/`.r` 可调用变体；🔴 未实现 0.15 的"分隔符即函数→lr"塌缩。

---

## F. 数学内单字母字符串改为正体（0.13）

```typst
$a "a" b$
```
- **旧版 (0.12)**：`$"a"$` 错误地按斜体。
- **新版 (0.13+)**：单字母串与多字母一致，按**正体**文本处理。
- **xmmath**：🟡 `str`→`<ms>`（`src/main.ts:786`），字体处理用 `font()` 码点映射，不等同 typst 文本整形。

---

## G. `lcm` 算子（0.13 新增）

```typst
$lcm(4, 6)$
```
- **旧版**：`lcm` 不作为文本算子。
- **新版 (0.13+)**：加入 `op` 家族（与 `gcd`/`max` 同类）。
- **xmmath**：🔴 `opl` 无 `lcm`（`src/normalize.ts:101-145`）→ 会被当作未知函数静默丢弃（见第 6 节缺陷 2）。

---

## H. 调用参数：连字符命名参数 + 参数展开（0.13 新增）

```typst
#let f(my-arg: none) = math.accent
$ f(my-arg: 1) $

#let g(..args) = args.fold(0, (a, b) => a + b)
$ g(..(1, 2)) $
```
- **旧版 (0.12)**：数学内调用不支持这些形式。
- **新版 (0.13+)**：数学调用参数表与代码模式统一（`my-arg:`、`..`）。
- **xmmath**：🔴 `f_attr`（`src/normalize.ts:845`）只认 `key: value` 且 key 不带 `-`，也不处理 `..` 展开。

---

## I. 重复修饰符变硬错误（0.13，破坏性）

```typst
$arrow.r.r(x)$      // ❌ 0.13+：重复 modifier
$arrow.r.double(x)$ // ✅ 合法
```
- **旧版 (0.12)**：静默回落到某个默认。
- **新版 (0.13+)**：重复符号修饰符直接报错。
- **xmmath**：🔴 无校验；点号合并 pass（`src/normalize.ts:468`）只会把 `arrow.r.r` 拼成字符串去 `ss` 查，查不到则丢弃。

---

## J. 命名参数传给"符号即函数"报错（0.14，破坏性）

```typst
$arrow.r(x, y: 1)$   // ❌ 0.14+ 硬错误（0.13 及以前静默忽略 y）
```
- **旧版**：额外命名参数被忽略，照渲染 `arrow.r(x)`。
- **新版 (0.14+)**：报错。
- **xmmath**：🔴 无此报错路径（参数进 dict 但按未实现处理，倾向静默）。

---

## K. `frac.style`（0.14 新增）

```typst
#set math.frac(style: "skewed")
$a/b$

#set math.frac(style: "horizontal")
$(a+b)/c$
```
- **旧版 (0.13)**：`/` 始终竖直堆叠分数；`(a+b)/c` 的括号处理固定。
- **新版 (0.14+)**：`style: vertical|skewed|horizontal|auto`，且各 style 对 `(a+b)/c` 括号的取舍不同。
- **xmmath**：🔴 `/`→`frac` 固定样式（`src/normalize.ts:797-841`），无 `frac.style`。

---

## L. `scr` 圆手体函数（0.14 新增）

```typst
$scr(R)$
```
- **旧版**：无 `scr`。
- **新版 (0.14+)**：新增脚本字体族函数（与 `cal`/`frak`/`bb` 并列）。
- **xmmath**：🔴 `f`/`font()` 无 `scr`。

---

## M. `accent` 的 `dotless` 参数（0.14 新增）

```typst
$accent(i, dotless: true)$   // 去掉 i/j 的上方点
$hat(i)$
```
- **旧版 (0.13)**：重音直接叠加，i/j 点保留。
- **新版 (0.14+)**：`dotless` 可去除基底点。
- **xmmath**：🟡 `accent` 解析 dict 但忽略所有选项（`src/main.ts:67`）。

---

## N. `/` 与 shorthand/多位数的绑定优先级（0.14，破坏性）

```typst
$x >= (y)/z$
$1/2/3$
```
- **旧版 (0.13)**：shorthand、多位数比 `/` 更紧。
- **新版 (0.14+)**：shorthand 与多位数**不再**比分数更紧，`x>=(y)/z` 的分组随之改变。
- **xmmath**：⚠️ `ast3` 的 `/` pass（`src/normalize.ts:797-841`）用的是自身 span 逻辑，需按新语义复核结合边界。

---

## O. `mid` 的 math class 默认改变（0.14）

```typst
$lr(a mid b)$
```
- **旧版 (0.13)**：`mid` 强制内容 class `large`。
- **新版 (0.14+)**：默认 `relation`，间距改变。
- **xmmath**：🟡 有 `mid`（`src/main.ts:202`，`stretchy`）但 class 逻辑不同。

---

## P. 空标签 `<>` 非法（0.14，破坏性）

```typst
$x$ <>      // ❌ 0.14+ 报错
$x$ <lbl>   // ✅
```
- **旧版**：`<>` 被容忍。
- **新版 (0.14+)**：空标签硬错误。
- **xmmath**：🔴 无标签文法，也无此校验（本库目前不处理 `<...>`）。

---

## Q. `lr`/`stretch` 的 `size` 解析基准（0.15，破坏性）

```typst
$lr(size: 150%, a/b)$
$stretch("|", size: 200%)$
```
- **旧版 (0.14)**：`size` 可能对已按 display 缩放的字形再计算；`lr` 的 `size` 只作用外侧。
- **新版 (0.15+)**：`size` 一律相对**基础字形**；`lr` 的 `size` 也作用于 `mid` 分隔符，且只按**内部内容高度**解析。
- **xmmath**：🟡 `lr(size)` 仅给首尾子元素设 `maxsize/minsize`（`src/main.ts:188-198`），与 0.15 语义不同。

---

## R. `math.class` 不再递归（0.15，破坏性）

```typst
$ #class("bin", $a + b$) $
```
- **旧版 (0.14)**：`class` 递归作用到内部每个元素。
- **新版 (0.15+)**：只作用于直接 body（整个被包裹组）。
- **xmmath**：🔴 `class(...)` 无 `f`/`ss`/`ff` 命中 → 被静默丢弃。

---

## S. cramped 与 MathML Core / TeX 对齐（0.15）

```typst
$script(a^b, cramped: true)$
$1/2$   // 在 cramped 上下文里间距不同
```
- **旧版 (0.14)**：cramped 应用不一致。
- **新版 (0.15+)**：与 TeX / MathML Core crampedness 模型一致（对**本库这类 MathML 输出器**直接相关：上下标/分数/根式的 `mo` 间距、`scriptlevel`、`displaystyle`）。
- **xmmath**：🟡 `cramped` 参数位存在但被忽略（`display/inline/script/sscript` 只渲染 `attr[0]`，`src/main.ts:278-305`）。

---

## T. 符号标识符改名（跨 0.12–0.15，数据层，随符号同步已落终态）

```typst
$angle.l$        // 0.14 弃用 → 0.15 移除；新名 $chevron.l$
$plus.circle$    // → $plus.o$
$paren.double$   // → $paren.stroked$（本库 shorthand 已用 .stroked）
$sect$           // → $inter$
$diff$           // → $partial$
$gt.tri$         // 0.15 弃用 → $gt.closed$
$tack.r.double$  // 0.15 弃用 → $tack.rr$
$ohm$ $degree.c$ $kelvin$ $franc$   // 已移除
```
- **旧版**：以左侧名解析。
- **新版 (0.15.1)**：只剩右侧终态名（左侧多为弃用/移除）。
- **xmmath**：🟢 数据层已随 codex v0.3.0 同步到 0.15.1 终态；代码层唯一连带修正已做（shorthand `[|`/`|]` → `bracket.l/r.stroked`）。

---

## 附：优先级速记（跨版本对照）

```
0.11–0.13:  shorthand / 多位数  >  /（分数）
0.14+:      shorthand / 多位数  与  /  不再更紧（结合改变）
^ _ 附着、limits/scripts：0.12–0.15 文法不变
```

需要我把这些示例转成真正能编译的 `examples/*.typ`（仅收新版合法项，用于对照渲染），或据第 4 节 TODO 动手补 `lcm`/`scr`/`stretch`/`frac.style` 与修复行注释 bug 吗？
