# Typst 数学语法版本行为示例（旧版 vs 新版对照）

配套文档：`docs/math-syntax-typst-diff.md`（变更清单与裁决表）。
验证工具：`test/typst/render.mjs`（`npm run render:typst`）——指定版本/二进制 + 源码 → PNG + typst 诊断。

本文每例给出：**input**（typst 源码）· **旧版行为**（xmmath 基线 v0.11.1 / 引入前）· **新版行为**（v0.15.1）· **xmmath 现状**。

> 图例：🆕新增 · 🔄行为变更 · ⚠️破坏性 · ❌现在报错 · 🟢已支持 · 🟡解析得到但渲染忽略 · 🔴未支持
> **实测** 标记：`✅0.15` = 本环境 typst 0.15.1 已用 render 工具核实；`📄` = 仅据 changelog，未实机复现；`🧪` = 示例写法/命名空间待进一步确认。

---

## A. Shorthand `~` → `tilde.op`（0.12）　📄

```typst
$a ~ b$
```
- **旧版 (≤0.11)**：`~` 走普通波浪/不换行空格一类。
- **新版 (0.12+)**：`~` 绑定 `tilde.op`（`∼`），该 tilde 为可调用 accent 形态。
- **xmmath**：🟡 `~` → `space.nobreak`（`src/normalize.ts` shorthand），与 0.12+ **不一致**。

---

## B. 矩阵分隔符 `delim:"||"` 被移除（0.12，破坏性）　✅0.15

```typst
$mat(delim: "||", 1, 2; 3, 4)$        // ❌ 实测：error: expected exactly one character
$mat(delim: bar.double, 1, 2; 3, 4)$  // 🆕 用符号
$mat(delim: "|", 1, 2; 3, 4)$          // 🆕 delim 现接受任意单 Unicode fence
```
- **旧版 (0.11)**：`delim` 支持字符串 `"||"`。
- **新版 (0.12+)**：多字符串非法（实测 0.15.1 直接报错）；改符号或单围栏字符。
- **xmmath**：⚠️ `delimPair` 仍把 `"||"`→`‖ ‖`（`src/main.ts:42-49`），保留了新版已废弃行为。

---

## C. `mat`/`vec` 的 `align` 参数（0.12 新增）　✅0.15

```typst
$mat(1, 2; 3, 4, align: #left)$   // 实测：OK
$vec(1, 2, 3, align: #center)$
```
- **新版 (0.12+)**：`align` 控制每列内容对齐。
- **xmmath**：🔴 `f_attr` 能解析出 `dic.align`，但 `mat`/`vec` 渲染未读取（`src/main.ts:206`、`378`）。

---

## D. `stretch` 函数（0.12 新增）　🧪

```typst
$stretch(h, size: 150%)$     // 实测 0.15.1：error: expected relative length, found content
$stretch("|", size: 150%)$   // changelog 原例，但本环境未能跑通（签名/命名空间待定）
```
- **新版 (0.12+)**：显式按基础尺寸百分比拉伸字形（0.15 改 `size` 解析基准）。
- **说明**：确为 0.12 新增，但最小可编译调用式在实测中报错（参数顺序/`math.` 命名空间未确定），**待进一步核实**。
- **xmmath**：🔴 无 `stretch`。

---

## E. 可调用符号：`floor`/`ceil`、分隔符塌缩成 `lr`（0.12 / 0.15）　✅0.15

```typst
$floor(x) = lr(floor.l x floor.r)$   // 0.12：floor/ceil 可调用
$chevron.l(x)$                        // 0.15：实测 OK（应渲染为配对围栏 lr，而非 符号+(x) 组）
```
- **新版**：`floor/ceil` 调用→`lr`（0.12）；`chevron.l(x)`→配对围栏 `lr`（0.15，破坏性）。
- **xmmath**：🟡 有 `floor`/`ceil`（`lr_f`）但无 `.l`/`.r` 可调用变体；🔴 未实现 0.15 的"分隔符即函数→lr"。

---

## F. 数学内单字母字符串改正体（0.13）　📄

```typst
$a "a" b$
```
- **旧版 (0.12)**：`$"a"$` 错误斜体。**新版 (0.13+)**：改正体文本处理。
- **xmmath**：🟡 `str`→`<ms>`（`src/main.ts:786`），字体用 `font()` 码点映射，不等同 typst 文本整形。

---

## G. `lcm` 算子（0.13 新增）　✅0.15

```typst
$lcm(4, 6)$   // 实测：OK
```
- **新版 (0.13+)**：加入 `op` 家族。**xmmath**：🔴 `opl` 无 `lcm`（`src/normalize.ts:101-145`）→ 未知函数被静默丢弃。

---

## H. 调用参数：`..` 展开（0.13）；连字符命名参数（0.13）　✅0.15(展开)/🧪(连字符)

```typst
#let g(..args) = args.len()
$ g(1,2,3) $                    // .. 展开：实测 OK
$mat(1,2;3,4, row-gap: 1em)$    // 连字符命名参数：本例实测报 "unknown variable: em"（写法待确认）
```
- **新版 (0.13+)**：数学调用参数表与代码模式统一（`..` 展开、带连字符的具名参数）。
- **xmmath**：🔴 `f_attr`（`src/normalize.ts:845`）不处理 `..`，key 也不含 `-`。

---

## I. ~~重复修饰符硬错误~~（0.13）——**更正**　📄

> 原说法"`arrow.r.r` 0.13+ 报错"**错误**：实测 0.15.1 `$arrow.r.r x$` 正常渲染（不报错）。
- changelog 的 0.13 条目指**符号变体（variant）重复定义**这一实现层约束，**非**用户写 `.r.r` 路径的语法错误。
- **用户侧写法**：`arrow.r.double` 等组合合法；`arrow.r.r` 只是解析不到具体变体→回落/丢弃，typst 不报错。
- **xmmath**：🔴 本就不校验重复；点号合并把 `arrow.r.r` 拼串去 `ss` 查，查不到则丢弃（行为与新版一致的"不报错"面）。

---

## J. 命名参数传给"符号即函数"报错（0.14，破坏性）　✅0.15

```typst
$arrow.r(x, y: 1)$   // 实测：error: unexpected argument: y
```
- **旧版**：忽略 `y`，照渲染 `arrow.r(x)`。**新版 (0.14+)**：报错（实测确认）。
- **xmmath**：🔴 无此报错路径（参数入 dict，倾向静默）。

---

## K. `frac.style`（0.14 新增）　✅0.15

```typst
#set math.frac(style: "skewed")   // 实测：OK（set 规则形式）
$a/b$
#set math.frac(style: "horizontal")
$(a+b)/c$
```
- **新版 (0.14+)**：`style: vertical|skewed|horizontal|auto`，各 style 对 `(a+b)/c` 括号取舍不同。
  - 注：调用式 `$math.frac(a,b,style:...)$` 在 math 模式命名空间下报错，**set 规则**形式正常。
- **xmmath**：🔴 `/`→`frac` 固定样式（`src/normalize.ts:797-841`）。

---

## L. `scr` 圆手体函数（0.14 新增）　✅0.15

```typst
$scr(R)$   // 实测：OK
```
- **新版 (0.14+)**：脚本字体族函数（与 `cal`/`frak`/`bb` 并列）。**xmmath**：🔴 无 `scr`。

---

## M. `accent` 的 `dotless` 参数（0.14 新增）　✅0.15

```typst
$accent(i, hat, dotless: #true)$   // 实测：OK（正确写法：base, accent, dotless）
```
- **旧版 (0.13)**：重音直叠，i/j 点保留。**新版 (0.14+)**：`dotless` 去点。
- **xmmath**：🟡 `accent` 解析 dict 但忽略所有选项（`src/main.ts:67`）。

---

## N. `/` 与 shorthand/多位数绑定优先级（0.14，破坏性）　📄

```typst
$x >= (y)/z$
$1/2/3$
```
- **新版 (0.14+)**：shorthand/多位数不再比 `/` 更紧，分组改变（视觉差异，需对照图确认）。
- **xmmath**：⚠️ `ast3` 的 `/` pass（`src/normalize.ts:797-841`）用自身 span 逻辑，需按新语义复核。

---

## O. `mid` 的 math class 默认改变（0.14）　📄

```typst
$lr(a mid b)$
```
- **新版 (0.14+)**：`mid` 默认 class `relation`（旧为 `large`），间距变。**xmmath**：🟡 有 `mid` 但 class 逻辑不同（`src/main.ts:202`）。

---

## P. 空标签 `<>` 非法（0.14）——**未复现**　📄

```typst
$x$ <>      // changelog 称 0.14+ 非法；本环境实测：未报错（渲染 OK）
$x$ <lbl>   // 合法
```
- 实测 0.15.1 下 `$x$ <>` **未**触发错误（可能 `<>` 被当作比较符序列而非空标签）。此项**据 changelog，标记为未实机确认**。
- **xmmath**：🔴 无标签文法，也不处理 `<...>`。

---

## Q. `lr`/`stretch` 的 `size` 解析基准（0.15，破坏性）　📄

```typst
$lr(size: 150%, a/b)$
```
- **新版 (0.15+)**：`size` 相对**基础字形**；`lr` 的 `size` 也作用 `mid`，只按内部内容高度解析。
- **xmmath**：🟡 `lr(size)` 仅给首尾子元素设 `maxsize/minsize`（`src/main.ts:188-198`）。

---

## R. `math.class` 不再递归（0.15，破坏性）　🧪

```typst
$a #class("bin", b)$   // 实测：error: unknown variable: class（math 模式裸 class 不在作用域）
```
- **新版 (0.15+)**：`class` 只作用直接 body（旧版递归到每个元素）。
- **说明**：调用命名空间待确认（`class` 需 `#` 代码模式或 `math.` 前缀）；行为差异**据 changelog**。
- **xmmath**：🔴 `class(...)` 无 `f`/`ss`/`ff` 命中 → 静默丢弃。

---

## S. cramped 与 MathML Core / TeX 对齐（0.15）　📄

```typst
$script(a^b, cramped: true)$
$1/2$   // cramped 上下文间距不同
```
- **新版 (0.15+)**：与 TeX / MathML Core crampedness 一致（对本 MathML 输出器直接相关）。
- **xmmath**：🟡 `cramped` 参数位存在但被忽略（`src/main.ts:278-305`）。

---

## T. 符号标识符改名（跨 0.12–0.15，数据层）　✅0.15

```typst
$angle.l$        // 实测：error: unknown symbol modifier（0.15 移除；新名 $chevron.l$）
$tack.r.double$  // 实测：warning: `tack.double` is deprecated, use ... `tack.rr`
$gt.tri$         // 实测：warning: `gt.tri` is deprecated, use `gt.closed`
$plus.circle$    // → $plus.o$ ; $paren.double$ → $paren.stroked$ ; $sect$ → $inter$ ; $diff$ → $partial$
$ohm$ $degree.c$ $kelvin$ $franc$   // 已移除
```
- **新版 (0.15.1)**：只剩右侧终态名。**xmmath**：🟢 数据层已随 codex v0.3.0 同步到 0.15.1 终态；代码层已改 shorthand `[|`/`|]` → `bracket.l/r.stroked`。

---

## U. `pi(1, 2)` 不再当函数调用（0.15 修复）　✅0.15

```typst
$pi(1, 2)$   // 实测：OK；0.15 起 pi 非函数时不渲染为调用
```
- **xmmath**：⚠️ `pi` 命中 `ss`→按符号处理；若 `f[x.value]` 先命中则可能误当调用（`src/main.ts:812`），需复核非符号+括号路径。

---

## 附 1：优先级速记

```
0.11–0.13:  shorthand / 多位数  >  /（分数）
0.14+:      shorthand / 多位数  与  /  不再更紧（结合改变）
^ _ 附着、limits/scripts：0.12–0.15 文法不变
```

## 附 2：用 render 工具复现某条实测

```bash
npm run render:typst -- --typst v0.12.0 --expr 'mat(delim: "||", 1, 2; 3, 4)' --json
npm run render:typst -- --expr 'arrow.r(x, y: 1)' --json        # 当前系统 typst
npm run render:typst -- --expr 'sum_(i=1)^n i' --inline --json   # 行内 $…$（默认是块级 $ … $）
npm run render:typst -- --code $'#set page(width:auto,height:auto)\n$accent(i, hat, dotless: #true)$' --out /tmp/m.png
```
> 注意：`--typst <旧版本>` 需能下载对应 release 二进制；本网络下载 GitHub release 会超时，旧版本核验请预先缓存或 `--bin` 指定本地二进制。`--expr` 会自动包进 `$ … $`（块级），加 `--inline` 改成 `$…$`（行内）——typst 只按 `$` 旁空白判定 inline/block，与独占一行无关；代码模式请用 `--code`/`--file`。
