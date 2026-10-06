# Typst 数学语法变化：0.11.1 → 0.15.1（按版本对照，实测）

> 只讲 **Typst 官方数学语法/行为变化**，每个条目给可复现的对比例子，并标注两端（或全部 7 版）实测结论。
> 不含本库支持状态 / src 代码坐标——但按既定约定，文末原样保留两节附录：**第 8 节**（版本升级操作，AGENTS.md 引用「diff.md 第 8 节」仍指向它）与**第 9 节**（原第 6 节"本库自身已知缺口"，内容一字未改、仅编号顺延）。
> 原 `docs/typst-version-examples.md`（A–U 例子集）已并入本文对应条目后删除。
> 覆盖 0.12.0 / 0.13.0 / 0.14.0（含 0.14.1、0.14.2）/ 0.15.0 / 0.15.1 各版 changelog 的 Math 及影响 math-mode 的 Syntax 条目。

---

## 0. 怎么复现、怎么读标记

### 0.1 工具与二进制

```bash
# 单例对照（PNG + 诊断；--expr 默认包成块级 $ … $，加 --inline 才是 $…$）
pnpm render:typst --typst v0.11.1 --expr 'mat(delim: "||", 1, 2; 3, 4)'
pnpm render:typst --typst v0.15.1 --expr 'sum_(i=1)^n i' --inline
# 代码模式的例子（#math.vec(...)、#set math.frac(...) 等）用 --code / --file
pnpm render:typst --typst v0.12.0 --code $'#set page(width:auto,height:auto)\n#math.vec([1], [2], align: center)'
```

本环境缓存了 7 个版本的官方二进制：`~/.cache/xmmath/typst/{v0.11.1, v0.12.0, v0.13.1, v0.14.0, v0.14.2, v0.15.0, v0.15.1}/typst`（没有 0.14.1，故 0.14.1 的条目以 0.14.2 实测为准）。

### 0.2 实测方法

同一份源码在 7 个版本上跑 `typst compile`，比较三样东西：

1. **退出码与诊断文本**（error / warning / hint 文案）；
2. **输出尺寸与哈希**（PNG 帧尺寸 `WxH`、同版本内 PNG/SVG 哈希）；
3. **montage 肉眼对照**（7 版并排拼图）。

**判读注意（噪声警告）**：

- 跨版本的 PNG/SVG 哈希**不可直接比**——字体与整体布局逐版漂移，同一式样几乎必然换哈希。可靠的是：**同版本内**两个式样的哈希是否相同、或**帧尺寸**是否相同。
- 错误/hint **文案演进 ≠ 语法变化**（例：unknown variable 的 hint、`#sym` 的 hint 都在变；语法本身没变）。
- 数学内的 code 值必须 `#` 前缀：`size: #150%`、`align: #left`、`dotless: #true`。写 `size: 150%` 不带 `#` 在**所有版本**都报 `expected relative length, found content`——那不是版本差异。
- **单字母用户函数名在数学里不会被调用**（`$ f(7) $` 各版都按字面渲成 `f(7)`）；测用户函数要用多字母名（下文用 `gg`）。多字母名才会走调用，且位置参数在数学里按 **content** 传入（`$ gg(7) $` 收到 content，`$ gg(#7) $` 收到 int，各版一致）。

### 0.3 标记

- ✅ = 已实测（写明哪些版本、什么结论）
- 📄 = 仅据 changelog，本环境未做有效复现（附已试例子）
- ⚠️ = 破坏性/易踩坑
- montage 肉眼、帧尺寸、同版哈希——结论后注明来源

---

## 1. 总览表

一句话结论：**文法主干没变**（`$…$`、`^`/`_` 附着、`/`、`f(...)`、素数 `'`、阶乘 `!`、点号、shorthand 集合），变化集中在——0.12 的符号可调用/分隔符/`~`，0.13 的调用参数扩展与校验，0.14 的 `/` 结合优先级与新参数，0.15 的 `mat` 具名参数位置、分隔符即函数、`class` 非递归与 `lr` 尺寸语义。

| 版本 | 条目 | 例子 | 实测 | 节 |
|---|---|---|---|---|
| 0.12 | `~` 重绑 `tilde.op` ⚠️ | `$a ~ b$` | ✅ 0.11 紧贴 `a~b`，0.12+ `a ∼ b` | 2.1 |
| 0.12 | 符号可当函数调用（#4299） | `$floor(x)$`、`#sym.hat([e])` | ✅ 0.11 报错/字段缺失，0.12+ OK | 2.2 |
| 0.12 | `delim:"||"`（双字符）移除 ⚠️ | `$mat(delim: "||", 1, 2; 3, 4)$` | ✅ 0.11 OK → 0.12+ 报错 | 2.3 |
| 0.12 | `mat/vec align` 参数 | `$vec(1, 2, align: #center)$` | ✅ 0.11 `unexpected argument` → 0.12+ OK | 2.4 |
| 0.12 | `stretch()` | `$stretch(\[, size: #150%) z$` | ✅ 0.11 `unknown variable` → 0.12+ OK | 2.5 |
| 0.12 | `underparen/overparen/undershell/overshell` | `$underparen(a+b)$` | ✅ 同上边界 | 2.6 |
| 0.12 | 块级公式可跨页 `breakable` | `#show math.equation: set block(breakable: true)` | 📄 编译各版 OK，未做多页对照 | 2.7 |
| 0.13 | 连字符命名参数进数学调用 | `$gg(my-arg: #2)$` | ✅ 0.11/0.12 `unknown variable: my` → 0.13+ OK | 3.1 |
| 0.13 | 数学内 `..` 展开行为变化 ⚠️ | `$gg(..(1, 2, 3))$` | ✅ 0.11/0.12 当 1 个 content，0.13+ `cannot spread content` | 3.2 |
| 0.13 | `lcm` 算子 | `$lcm(4, 6)$` | ✅ 0.13 起 OK | 3.4 |
| 0.13 | 顶层不配对 `]` 硬错误 | `]` | ✅ 0.13 起 `unexpected closing bracket` | 3.5 |
| 0.13 | `#symbol` 重复变体校验 | `#symbol(("x.y","a"),("y.x","b"))` | ✅ 0.13 起 `duplicate variant` | 3.6 |
| 0.13 | 单字母串改正体 ⚠️ | `$a "a" b$` | ✅ 实测 **0.14.2 起**才正体（changelog 记 0.13） | 3.7 |
| 0.14 | shorthand 与 `/` 结合优先级 ⚠️ | `$x>=(y)/z$`、`$1/10(x)$` | ✅ **0.14.0 起**分组改变 | 4.1 |
| 0.14 | `frac.style` | `#set math.frac(style: "skewed")` | ✅ 0.14.0 起 OK | 4.2 |
| 0.14 | `scr` 字体函数 | `$scr(R)$` | ✅ 0.14.0 起 OK | 4.3 |
| 0.14 | `accent(dotless:)` | `$accent(i, hat, dotless: #true)$` | ✅ 0.14 起接受；渲染与不带参数同哈希 | 4.4 |
| 0.14 | `mat(augment:)` 首尾线 | `$mat(1, 2; 3, 4; augment: #0)$` | ✅ 0.14.0 起 OK | 4.5 |
| 0.14 | 符号收 named arg 报错（#6192）⚠️ | `$lt(x, y: #1)$` | ✅ 0.11–0.13 静默，0.14 起报错 | 4.7 |
| 0.14 | `⟅_1^2` 附着被禁止 | `$⟅_1^2$` | ✅ 0.13.1 及以前 OK，0.14.2+ `unexpected underscore` | 4.9 |
| 0.14 | 空标签 `<>` 非法（changelog） | `$x$ <>` | 📄 实测各版**均不报错** | 4.11 |
| 0.15 | `mat/vec` 具名参数写在单元格后 ⚠️ | `$mat(1, 2; 3, 4, align: #left)$` | ✅ 0.15.0 起才 OK | 5.1 |
| 0.15 | 分隔符即函数 → 配对 `lr` ⚠️ | `$bracket.l(x)$` | ✅ 0.15.0 起 ≡ `[x]`（旧版 `[(x)`） | 5.2 |
| 0.15 | `lr`/`stretch` 的 `size` 尺寸语义 ⚠️ | `$lr(]a], size: #150%)$` | ✅ 帧尺寸 64x65 → 54x52 | 5.3 |
| 0.15 | `math.class` 不再递归 ⚠️ | 见 5.4 | ✅ montage：0.14.2 及以前递归、0.15 起只作用直接 body | 5.4 |
| 0.15 | 符号大规模删除/改名 ⚠️ | `$angle.l$`、`$sect$` | ✅ 见第 6 节实测表 | 5.6 / 6 |
| 0.15 | `pi(1,2)`、`f'_0` 修复 | `$pi(1, 2)$` | ✅ 同版内与对照同哈希——**无可见差异** | 5.7 |
| 0.15.1 | 仅修复，无语法变更 | — | ✅ 0.15.0/0.15.1 诊断逐一相同，抽样 16 例同哈希 | 5.11 |

---

## 2. v0.12.0

### 2.1 `~` 重绑为 `tilde.op`（⚠️ breaking）

- **类型**：shorthand 目标变化
- **例子**
  ```typst
  $a ~ b$
  ```
- **实测** ✅（montage 肉眼）：0.11.1 渲染紧贴的 `a~b`；0.12.0–0.15.1 渲染带关系符间距的 `a ∼ b`。对照组 `$a b$` 排除字体因素。

### 2.2 符号可当函数调用（PR #4299）

- **类型**：行为新增（`sym(...)` 塌缩）
- **例子**
  ```typst
  $floor(x) = lr(floor.l x floor.r)$
  #sym.hat([e])          // 代码模式
  #sym.hat([e], [!])
  $ lt(x) $
  ```
- **实测** ✅：
  - `$floor(x) = lr(floor.l x floor.r)$`：0.11.1 `error: function 'floor' does not contain field 'l'`（0.11 的 `floor` 是函数，不是符号），0.12.0–0.15.1 OK。
  - `#sym.hat([e])`：0.11.1 `error: expected function, found symbol`，0.12+ OK；`#sym.hat([e], [!])` 0.11.1 同错、0.12+ `unexpected argument`。
  - `$lt(x)$` 位置参数各版 OK。
- **注意**：0.15 又改了"哪些符号调用会塌缩成配对 `lr`"——见 5.2；符号收 **named** 参数的报错变化——见 4.7。

### 2.3 `mat/vec` 分隔符：双字符 `delim` 移除、接受符号与任意单围栏（⚠️ breaking）

- **类型**：参数值语义
- **例子**
  ```typst
  $mat(delim: "||", 1, 2; 3, 4)$         // 旧双字符写法
  $mat(delim: bar.double, 1, 2; 3, 4)$   // 符号写法
  $mat(delim: "|", 1; 2) + x$            // 单字符围栏
  ```
- **实测** ✅（7 版诊断）：
  - `"||"`：0.11.1 OK，0.12.0–0.15.1 `error: expected exactly one character`。
  - `bar.double`：0.11.1 `error: expected "(", "[", "{", "|", "||", or none, found symbol`，0.12+ OK。
  - `"|"`：各版 OK（montage 肉眼一致）。

### 2.4 `mat/vec` 的 `align` 参数

- **类型**：新增参数（⚠️ 写法位置有版本差异，0.15 才补齐——见 5.1）
- **例子**
  ```typst
  $vec(1, 20, 3, align: #right)$          // 数学模式
  #math.vec([1], [2], align: center)      // 代码模式（mat/vec 不在顶层作用域，必须 math. 前缀）
  #math.mat((1, 2), (3, 4), align: left)
  ```
- **实测** ✅：
  - `$vec(1, 2, align: #center)$`：0.11.1 `unexpected argument: align`，0.12.0–0.15.1 OK（montage：6 版渲染一致）。
  - `#math.vec([1], [2], align: center)`：0.11.1 `unexpected argument: align`，0.12+ OK；`#math.mat((1, 2), (3, 4), align: left)` 同边界。
  - 代码模式 `mat`/`vec` 裸名各版都 `unknown variable: mat`（须 `math.mat`）——这不是版本差异。
- **数组形式不支持**（各版）：`align: (left, right)`（code）→ 0.12+ `expected alignment, found array`；math 内 `align: #((left, right))` → 0.12+ 同错；`align: (#left, #right)`（math 括号组）→ 0.12+ `expected alignment, found content`。

### 2.5 `stretch()`

- **类型**：新增函数
- **例子**
  ```typst
  $stretch(\[, size: #150%) z$
  $stretch(->>, size: #150%)$
  stretch("|", size: 150%)   // changelog 原例（不带 #）
  stretch("|", size: #150%)  // 同例带 #
  ```
- **实测** ✅（7 版）：前两例 0.11.1 `unknown variable: stretch`，0.12.0–0.15.1 OK（montage：6 版均渲染更大的括号/箭头）；`stretch("|", size: #150%)` 同边界（0.11 ERR、0.12+ OK）。
- ⚠️ changelog 原例 `stretch("|", size: 150%)` 不带 `#` 在数学模式里**各版都错**（0.12 `expected relative length or auto, found content`，0.13+ `expected relative length, found content`）——math 内 code 值要写 `#150%`。

### 2.6 `underparen / overparen / undershell / overshell`

- **类型**：新增函数
- **例子**：`$underparen(a+b) overshell(a+b)$`
- **实测** ✅：0.11.1 `unknown variable: underparen`，0.12.0–0.15.1 OK（montage 6 版一致）。

### 2.7 块级公式可跨页（`breakable`）

- **类型**：布局能力
- **例子**
  ```typst
  #set page(width: 14cm, height: 3cm, margin: 4pt)
  #show math.equation: set block(breakable: true)
  $ sum_(i=1)^n i + sum_(i=1)^n i^2 + sum_(i=1)^n i^3 + sum_(i=1)^n i^4 $
  ```
- **实测** 📄：带与不带 `breakable` 的示例在 7 版均编译 OK，且单页输出哈希相同（未触发分页）。**跨页拆分效果未做多页像素对照**。

### 2.8 其它 0.12 符号名变化

`lt.curly` 移除（`prec` 等新名）、`shell.l` 加入等——全部见**第 6 节实测表**。

---

## 3. v0.13.0

### 3.1 连字符命名参数进入数学调用

- **类型**：语法扩展（参数表与 code 模式统一）
- **例子**
  ```typst
  #let gg(my-arg: 0) = str(my-arg)
  $ gg(my-arg: #2) $      // 正确写法（值用 #）
  $ gg(my-arg: 2) $       // 值不带 #：按 content 传
  $ mat(1, 2; 3, 4, row-gap: #1em) $
  ```
- **实测** ✅：
  - `gg(my-arg: #2)`：0.11.1/0.12.0 `error: unknown variable: my`（连字符名不被识别，`my` 被当变量），**0.13.1–0.15.1 OK**。
  - `gg(my-arg: 2)`：0.11/0.12 `unknown variable: my`；0.13+ `expected integer, ... found content`（名字已识别，值按 content 传）。
  - `row-gap`（内置函数的连字符参数）：`$mat(1, 2; 3, 4, row-gap: #1em)$` 0.11/0.12 `unknown variable: row`、0.13–0.14.2 `expected array, found content`（名字已识别、位置未支持）、**0.15 OK**（位置问题见 5.1）；`$mat(row-gap: #1em, 1, 2; 3, 4)$`（写最前）0.13.1 起 OK。
  - 非连字符名 `gg(myarg: 2)` 各版都进参数解析（0.11.1 就是类型错，不是 unknown variable）——即具名参数本身 0.11 就支持，**0.13 新增的是连字符**。
- **code 模式对照**：`#let f(my-arg: 0)` + `#f(my-arg: 2)` 各版都 OK（code 模式一直支持）。

### 3.2 数学内 `..` 展开：从"当一个 content"变为硬错误（⚠️）

- **类型**：行为变更
- **例子**
  ```typst
  #let gg(..args) = panic("N=" + str(args.pos().len()))
  $ gg(..(1, 2, 3)) $
  #gg(..(1, 2, 3))       // code 模式对照
  ```
- **实测** ✅：
  - 数学内：0.11.1/0.12.0 `panicked with: "N=1"`（整个元组被当 1 个 content 传入），**0.13.1–0.15.1 `error: cannot spread content`**。
  - code 模式：7 版全部 `panicked with: "N=3"`（spread 一直正常）。
- 数学内单字母名不会被调用（见 0.2），所以数学那行必须用多字母名 `gg`；code 模式无此限制。

### 3.3 `mat(..)` 在 0.13 的解析回归（0.14 修，#7105）

- **例子**：`$mat(..)$`
- **实测** ✅：0.11.1/0.12.0 OK、**0.13.1 `error: unclosed delimiter`**、0.14.0–0.15.1 OK（上游 0.14 changelog 收录 #7105"修复 `..` 解析"）。

### 3.4 `lcm` 算子

- **例子**：`$lcm(4, 6)$`（对照 `$gcd(4, 6)$`）
- **实测** ✅：`lcm` 0.11.1/0.12.0 `unknown variable: lcm`，0.13.1–0.15.1 OK；`gcd` 各版 OK。

### 3.5 顶层不配对 `]` 变硬错误（附带非 math，0.13）

- **例子**：文件内容只有一个 `]`
- **实测** ✅：0.11.1/0.12.0 渲染 OK；0.13.1–0.15.1 `error: unexpected closing bracket` + `hint: try using a backslash escape: \]`。

### 3.6 `#symbol` 重复变体校验（changelog"重复修饰符"的真身）

- **类型**：校验（构造层，非用户写法层）
- **例子**
  ```typst
  #symbol(("x.y", "a"), ("y.x", "b"))
  #symbol("a", "a")
  $arrow.r.r x$          // 用户写重复修饰符
  ```
- **实测** ✅：
  - `#symbol(...)` 变体顺序重复：0.11.1/0.12.0 OK，0.13.1–0.15.1 `duplicate variant: "y.x"` + `hint: variants with the same modifiers are identical, regardless of their order`。
  - `#symbol("a", "a")`：0.13 起报错文案变 `duplicate default variant`。
  - ⚠️ **更正旧说法**：`$arrow.r.r x$` 用户写法**各版都不报错**（7 版渲染正常）——changelog 说的"重复修饰符变硬错误"指的是 `symbol()` 构造时的重复变体校验。

### 3.7 数学里单字母字符串改正体 ⚠️（实测边界与 changelog 不一致）

- **例子**
  ```typst
  $ a "a" b $
  $ "a" b $
  $ "ab" b $        // 对照：多字母串
  ```
- **实测** ✅（montage 肉眼）：
  - `$a "a" b$`：**0.11.1–0.14.0 斜体连写 `aab`**；**0.14.2–0.15.1 正体、随周围空格分开 `a a b`**。
  - `$"a" b$` 同边界：0.11–0.14.0 `ab` 连写，0.14.2+ `a b` 分开正体。
  - `$"ab" b$`：7 版都是 `ab b`（多字母串一直是正体且带空格）。
- ⚠️ changelog 把"单字母串改正体"记在 **0.13.0**、把"随空格反应"记在 0.14.1；本环境实测 **0.13.1 仍是斜体连写**，可见行为到 **0.14.2**（本环境无 0.14.1 二进制）才生效。以实测为准。

### 3.8 诊断文案演进（≠语法变化，避免误判）

- **实测** ✅：
  - `repr(type(#7))`：0.11.1/0.12.0 panic 出 `"integer"`，0.13.1 起 `"int"`（类型改名，值不受影响）；0.15 起 panic 文案不再带引号。
  - `#math.accent([e], [hat])` 报错演进：0.11/0.12 `expected exactly one character` → 0.13 `expected a symbol` → 0.14+ `expected a single-codepoint symbol`。
  - `$sym.floor(x)$` 的 hint 演进：0.11.1 无 hint → 0.12–0.14.2 `try adding a hash: #sym` → 0.15 `std.sym` 三条 hint。
  - unknown variable 的"spaces between each letter" hint 从 0.12 起出现。

### 3.9 0.13 移除的符号

`ohm`、`kelvin`、`degree.c` 等——见**第 6 节实测表**（0.11/0.12 OK，0.13+ unknown）。

---

## 4. v0.14.0（含 0.14.1 / 0.14.2）

### 4.1 shorthand 与多位数不再比 `/` 绑定更紧（⚠️ breaking，#5925 / #5996）

- **类型**：结合优先级
- **例子**
  ```typst
  $x>=(y)/z$          // shorthand 与 ( 紧邻
  $x >= (y)/z$        // 同式带空格
  $x >= y/z$          // 对照
  $1/10(x)$           // 多位数（issue #4828 的原例）
  $1/2(x)$            // 单位数对照
  ```
- **实测** ✅（同版哈希 + montage 肉眼）：
  - **`$x>=(y)/z$`**：0.11.1/0.12.0/0.13.1 渲染成**一个大分数**——分子是 `x ≥ (y)`（整体与 `/z` 结合；montage 大图肉眼可见 `x ≥ (y)` 在横线之上）；**0.14.0/0.14.2/0.15.0/0.15.1 与 `$x >= y/z$` 同哈希**（`≥ y/z` 形式，分数只包 `y`）。
  - **触发条件是 shorthand 与 `(` 紧邻**（0.11.1 同版哈希实测）：`x >=(y)/z` ≡ 特殊式、`x>= (y)/z` ≡ 普通式、`x>=y/z` ≡ 普通式、`x>(y)/z` ≡ 普通式（`>` 单字符非 shorthand）。带空格的 `x >= (y)/z` **各版都等于普通式**。
  - **`$1/10(x)$`**（#5996）：0.11.1/0.12.0/0.13.1 把 `(x)` 并进**分母**（渲成 `1` over `10(x)`）；0.14.0–0.15.1 是 `1/10` 分数后跟 `(x)`（montage 7 格肉眼可见 3+4 分界）；同版哈希 `1/10(x)` 在 0.13.1≠0.14.0。
  - `$1/2(x)$`：7 版一致（`1/2` 后跟 `(x)`）——单位数本来就没问题。

### 4.2 `frac.style`

- **例子**
  ```typst
  #set math.frac(style: "skewed")     // 或 "horizontal" / "vertical" / "auto"
  $(a+b)/c$
  ```
- **实测** ✅：0.11.1–0.13.1 `error: unexpected argument: style`，0.14.0–0.15.1 OK（montage：0.14.0 起出现斜线式分数）；对照 `$(a+b)/c$` 默认竖式各版 OK。set 规则形式；调用式 `$math.frac(...)$` 不是这套写法。

### 4.3 `scr` 字体函数

- **例子**：`$scr(R) R$`
- **实测** ✅：0.11.1–0.13.1 `error: unknown variable: scr`（hint 引导加引号/空格），0.14.0–0.15.1 OK（montage 4 格出圆手体 `ℛ`）。

### 4.4 `accent` 的 `dotless` 参数

- **例子**：`$accent(i, hat, dotless: #true)$`（对照 `$accent(i, hat)$`、`j` 同）
- **实测** ✅：
  - 参数存在性：0.11.1–0.13.1 `error: unexpected argument: dotless`，0.14.0–0.15.1 OK。
  - 渲染效果：同版本内 `accent(i, hat)` 与 `accent(i, hat, dotless: #true)` **PNG 完全同哈希**（0.14.0、0.14.2、0.15.1 皆是），`j` 同——即默认渲染已经是去点的 hat，`dotless` 在该例无可测差异。

### 4.5 `mat(augment:)` 允许首尾线

- **例子**
  ```typst
  $mat(1, 2; 3, 4; augment: #0)$     // 第 0 列后画线（最左）
  $mat(1, 2; 3, 4; augment: #2)$     // 最右
  $mat(1, 2; 3, 4; augment: #(-1))$  // 对照：负偏移各版 OK
  ```
- **实测** ✅：`#0`/`#2` 0.11.1–0.13.1 `error: cannot draw a vertical line after column 0/2 of a matrix with 2 columns`，**0.14.0–0.15.1 OK**（montage：0.14 起出现最左竖线）；`#(-1)` 各版 OK。augment 值写在**行首**（`; augment:`）各版都能解析；写在行尾 `, augment:` 的位置问题见 5.1。

### 4.6 `math.equation(alt:)`

- **例子**：`#set math.equation(alt: "alternative")`
- **实测** ✅：0.11.1–0.13.1 `error: unexpected argument: alt`，0.14.2/0.15.1 OK（0.14.0 未单测；0.14 changelog 收录）。

### 4.7 命名参数传给"作为函数的符号"变硬错误（⚠️ breaking，#6192）

- **类型**：静默忽略 → 报错
- **例子**
  ```typst
  $lt(x, y: #1)$
  $plus(x, y: #1)$
  $dots(x, y: #1)$
  $arrow.r(x, y: #1)$      // 对照：另一套机制
  $floor(x, y: #1)$        // 对照：真函数
  ```
- **实测** ✅（7 版诊断）：
  - `lt` / `plus` / `dots`：0.11.1–0.13.1 **OK（named arg 被静默忽略）**；0.14.0/0.14.2 `error: unexpected argument: y`；0.15.0/0.15.1 文案变为 `error: named-argument syntax can only be used with functions` + `hint: to render the colon as text, escape it: y\: #1`（见 5.5）。
  - `arrow.r(x, y: #1)`：**各版都** `unexpected argument: y`（它走的是另一套参数校验，不是本条的复现）。
  - `floor(x, y: #1)`：各版都 `unexpected argument: y`（参数集固定的函数一直校验）。
  - `hat(x, y: #1)`、`lr(x, y: #1)`、`accent(x, hat, y: #1)`：各版都 `unexpected argument: y`。

### 4.8 `mid` 默认 math class 改 relation（changelog）——实测未见差异

- **例子**：`$a mid b$`、`$x mid y$`、`$lr(a mid b)$`、对照 `$a|b$`
- **实测** ✅（帧尺寸）：`a mid b` 各版 **110x44**、`x mid y` 各版 **114x47**、`a|b` 各版 **59x52**——0.11.1→0.15.1 完全一致；montage 肉眼也无差异。changelog 所述 class 变化在这些例子里测不出间距差。

### 4.9 默认 class 修正（⅋⎰⟅⎱⟆⟇ 等）与 `⟅_1^2` 附着被禁

- **例子**
  ```typst
  $x ⟇ y$        // 裸用
  $⟅_1^2$         // 附着
  ```
- **实测** ✅：
  - `$x ⟇ y$`：7 版渲染一致（montage）——裸用无差异。
  - `$⟅_1^2$`：0.11.1/0.12.0/0.13.1 OK，**0.14.2–0.15.1 `error: unexpected underscore`**（`⟅` 被归为 Opening，底座不可附着；0.14.0 未测，上游 0.14 收录 #5949/#6537）。此字符的 limits/scripts 漂移清单见第 8 节 8.4。

### 4.10 0.14.0 短暂回归：`accent(e, arrow.l.r)`（0.14.1 修复）

- **实测** ✅：`$accent(e, arrow.l.r)$` 0.11.1–0.13.1 OK、**0.14.0 `error: expected exactly one character`**、0.14.2–0.15.1 OK（montage 6 格均渲染双箭头 accent）。

### 4.11 空标签 `<>` 非法（changelog）——**未复现**

- **例子**：`$x$ <>`、`$x$ <lbl>`、`$x$ < >`
- **实测** 📄：0.11.1–0.15.1 **全部编译 OK，无报错**。changelog 所述"空标签非法"在这些写法上没有出现（可能针对别的文法位置）。

### 4.12 `mat` 单元格内 `\` 换行被忽略并给 warning

- **例子**：`$mat(a & b \ c & d)$`（对照 `$lr(a & b \ c & d)$`）
- **实测** ✅：`mat(...)`：0.11.1–0.13.1 无警告，**0.14.0–0.15.1 `warning: linebreaks are ignored in cells` + `hint: use commas instead`**；`lr(...)` 同写法各版无此警告。

### 4.13 0.14 的符号弃用窗口

`angle.l`、`plus.circle`、`diff`、`bracket.l.double` 等 0.14 起 warning、0.15 删除；新名 `chevron.l`、`plus.o`、`bracket.l.stroked` 0.14.0 起可用——全部见**第 6 节实测表**。

### 4.14 布局/渲染层（changelog 记载，未做像素断言）

数学文本处理重写（真整形、一公式多字体、生成可 show 的 `text` 元素、缩减尺寸优先用 script 字形）——属于渲染内部；单字母串的可见变化见 3.7（实测 0.14.2 起）。

---

## 5. v0.15.0（含 0.15.1）

### 5.1 `mat/vec` 具名参数写在单元格之后（⚠️ breaking，0.15 才支持）

- **类型**：参数解析位置
- **例子**
  ```typst
  $mat(1, 2; 3, 4, align: #left)$        // 末行末尾（, 后）
  $mat(1, 2; 3, 4, foo: #left)$          // 未知参数同位置
  $mat(delim: "|", 1, 2; 3, 4)$          // 写最前
  $mat(1, 2; delim: "|", 3, 4)$          // 写行首（; 后第一位）
  $mat(1, 2, align: #left; 3, 4)$        // 行中，后面还有行
  $vec(1, 2, align: #center)$            // 单行（无 ;）
  ```
- **实测** ✅（7 版诊断，位置敏感）：

  | 写法 | 0.11.1 | 0.12.0–0.14.2 | 0.15.0–0.15.1 |
  |---|---|---|---|
  | `mat(delim: "\|", 1, 2; 3, 4)`（最前） | OK | OK | OK |
  | `mat(1, 2; delim: "\|", 3, 4)`（`; ` 行首） | OK | OK | OK |
  | `mat(1, 2; 3, 4; align: #left)`（行首） | ✗ `unexpected argument: align` | OK | OK |
  | `mat(align: #left, 1, 2; 3, 4)`（最前） | ✗ `unexpected argument: align` | OK | OK |
  | `vec(1, 2, align: #center)`（单行末尾） | ✗ `unexpected argument: align` | OK | OK |
  | `mat(1, 2, align: #left)`（单行末尾） | ✗ `unexpected argument: align` | OK | OK |
  | `mat(1, 2, row-gap: #1em)`（单行末尾，连字符） | ✗ `unknown variable: row` | ✗ `unknown variable: row`（0.12）→ OK（0.13+） | OK |
  | `mat(1, 2; 3, 4, align: #left)`（末行末尾） | ✗ `expected array, found content` | ✗ `expected array, found content` | **OK** |
  | `mat(1, 2; 3, 4, delim: "\|")` / `augment:`（末行末尾） | ✗ `expected array, found content` | ✗ 同左 | **OK** |
  | `mat(1, 2; 3, 4, row-gap: #1em)`（末行末尾，连字符） | ✗ `unknown variable: row` | ✗ `unknown variable: row`（0.11/0.12）→ `expected array, found content`（0.13–0.14.2） | **OK** |
  | `mat(1, 2; 3, 4, foo: #left)`（未知参数，末行末尾） | ✗ `expected array, found content` | ✗ 同左 | **OK 后报 `unexpected argument: foo`** |
  | `mat(1, 2, align: #left; 3, 4)`（行中，后有行） | ✗ `unexpected argument: align` | ✗ `expected alignment, found content` | ✗ `expected alignment, found content`（仍未支持） |

- 规律总结（实测）：**写最前、写 `; ` 行首**从 0.12 起行（`delim:` 这类 0.11 就有的参数写最前/行首**各版**都行；`align:` 在 0.11 因参数尚不存在报 `unexpected argument`）；**单行（无 `;`）末尾** 0.12 起行（连字符名 0.13 起）；**多行 mat 的末行末尾** 0.15 起才行（旧版报 `expected array, found content`，因为后面的内容被并进上一格的行数组）；**行中且后面还有行**任何版本都不行。
- 代码模式同样从 0.12 起才有 `align`（见 2.4）；`#math.mat((1, 2), (3, 4), align: left)` 0.11.1 `unexpected argument: align`、0.12+ OK。

### 5.2 更多 Opening/Closing 分隔符可调用 → 塌缩成配对 `lr`（⚠️ breaking）

- **类型**：`sym(...)` 语义
- **例子**
  ```typst
  $paren.l(x)$        // 对照 $paren.l x paren.r$
  $bracket.l(x)$
  $brace.l(x)$
  $chevron.l(x)$      // 需 0.14.0+ 才有 chevron 这个名
  ```
- **实测** ✅（montage + 同版哈希）：
  - `paren.l(x)`：0.11.1–0.14.2 渲染 `((x)`（符号本身 + 括号组）；**0.15.0/0.15.1 渲染 `(x)`**（配对 lr）。
  - `bracket.l(x)`：0.11–0.14.2 `[(x)`；**0.15.0+ 与 `$bracket.l x bracket.r$` 同哈希**（即完全等于手动配对的 `[x]`）。
  - `brace.l(x)`：0.11–0.14.2 `{(x)`；0.15.0+ `{x}`。
  - `chevron.l(x)`：0.14.0/0.14.2 `⟨(x)`；0.15.0+ `⟨x⟩`。
- 相关：0.12 让符号可调用（2.2），0.15 决定**哪些**调用配对成 lr。

### 5.3 `lr` / `stretch` 的 `size` 解析语义（⚠️ breaking，迁移指南项）

- **例子与实测** ✅（帧尺寸，14pt，margin 6pt）：

  | 式样 | 0.14.2 | 0.15.1 |
  |---|---|---|
  | `$lr(]a])$` | 54x52 | 54x52 |
  | `$lr(]a], size: #150%)$` | **64x65**（放大） | **54x52 ≡ 不带 size（同哈希）** |
  | `$lr(]a], size: #300%)$` | 76x108 | 65x74 |
  | `$lr(]sum])$` | 89x65 | 89x65 |
  | `$lr(]sum], size: #150%)$` | 92x83 | 92x83 |
  | `$lr(sum, size: #200%)$` | 64x63 ≡ 无 size | 54x52 ≡ 无 size |
  | `$lr(x mid y, size: #50%)$` | 114x47 ≡ 无 size | 114x47 ≡ 无 size |

- 结论：`size` 在 0.15 改为**相对基础字形解析**（迁移指南原文：绝不对已 display 缩放的字形再算），同输入的帧尺寸在两版不同（第一行数据即证据）；对 `sum`、`mid` 两例在所测版本里 size 一直无效果。changelog 另称"lr 的 size 对 mid 同等生效、按内部内容高度解析"——该点在 `lr(x mid y, size: #50%)` 上**测不出差异**（各版 114x47）。

### 5.4 `math.class` 只作用直接 body、不再递归（⚠️ breaking）

- **例子**
  ```typst
  #let cc = math.class("opening", $a + b$)
  $ x + #cc + y $
  $ x + ($a + b$) + y $     // 对照（无 class）
  ```
- **实测** ✅（montage 肉眼 + 同版哈希，决定性）：
  - 0.11.1–**0.14.2**：渲成 `x + a+b+y`——class 递归传播，组内 `+` 也被改成 opening，内部间距收紧（0.12.0–0.14.2 同哈希 `57fd8328`）。
  - **0.15.0/0.15.1**：渲成 `x + a + b + y`——只有整组按 opening 处理，组内 `+` 保持原 class（0.15 同哈希 `f4a50624`）。
- `math.class(...)` 语法本身各版可用；裸 `#class(...)`（无 `math.` 前缀）**各版都** `unknown variable: class`。

### 5.5 报错/hint 文案升级（非语法，0.15）

- 符号 named arg：0.14 `unexpected argument: y` → 0.15 `named-argument syntax can only be used with functions` + `hint: to render the colon as text, escape it: y\: #1`（见 4.7）。✅ 7 版实测。
- `$sym.floor(x)$`：0.11.1 `unknown variable: sym` 无 hint；0.12–0.14.2 hint `try adding a hash: #sym`；0.15 hint 改为 `std.sym` 三条。✅

### 5.6 符号大规模删除与新名就位

`angle.l`、`plus.circle`、`sect`、`diff`、`bracket.l.double`、`tack.r.double`（弃用提示）等 0.15 删除；`gt.closed`、`tack.rr` 0.15.0 起才存在——全部见**第 6 节实测表**。其中值得注意：**0.14.2 的 deprecation hint 已经让人改用 `gt.closed`，但这个名字 0.15.0 才存在**（0.14.2 实测 `unknown symbol modifier`）。

### 5.7 `pi(1, 2)` 不再当调用渲染、素数与嵌套附着顺序修复——**无可见差异**

- **例子**：`$pi(1, 2)$` vs `$pi (1, 2)$`；`$f'_0$` vs `$f^'_0$`
- **实测** ✅（同版哈希）：0.13.1、0.14.2、0.15.0、0.15.1 各版内 `pi(1, 2)` 与 `pi (1, 2)` **同哈希**；`f'_0` 与 `f^'_0` **同哈希**。即这两条是结构性修复，在这些例子里像素零差异（montage 肉眼也一致）。

### 5.8 cramped 与 TeX / MathML Core 对齐

- **例子**：`$a/b_c$`（本环境实测）；`$script(a^b, cramped: true)$` 📄 未跑
- **实测** 📄：`$a/b_c$` 7 版 montage 无可见差异（0.15 的整体布局漂移与 cramped 间距变化无法在该例分离）。对 MathML 输出器仍是利好项，但本环境**未做像素级断言**。

### 5.9 布局类（changelog 记载，未做像素断言）

`underbrace` 下/上标布局、`math.op` 间距、`binom` OpenType 常量、`cancel` 默认长度/笔画改 `em`、box/block 内基线保留、分数/根式/under-over 线遵循 `text.stroke`——属渲染层；对应例子（`$underbrace(a+b+c, "sum")_1^2$`、`$cancel(a/b)$`、`#show math.equation: set text(stroke: 1pt)`、`a #box(inset: 4pt)[$b$] c`）各版均编译 OK，montage 未见结构性差异（box 例的 `c` 基线在 0.15 起有细微差别，肉眼难断言）。

### 5.10 Typst HTML 导出现已输出原生 MathML（外部能力）

📄 changelog 条目：Typst 编译器自带 Typst-AST → MathML 参考实现，可对照验证任何 MathML 输出器。本环境未跑 HTML 导出。

### 5.11 v0.15.1：仅修复，无语法变更

- **实测** ✅：第 1–6 节所有例子在 **0.15.0 与 0.15.1 上诊断逐一相同**；抽样 16 例（`gg(my-arg: #2)`、`chevron.l(x)`、`class` 递归例、`bracket.l(x)`、`23/45` 等）**PNG 哈希逐一相同**。0.15.1 的修复（`lr` 内 `&` 对齐点回归、`op` 竖直错位）未触及语法与本清单内行为。

---

## 6. 符号改名与移除：7 版实测表

判定：`$ <name> $` 编译通过记 ✓、报 `unknown ...` 记 ✗、通过但带 deprecation warning 记 warn。

| 名字 | 0.11.1 | 0.12.0 | 0.13.1 | 0.14.0 | 0.14.2 | 0.15.0 | 0.15.1 | 说明 |
|---|---|---|---|---|---|---|---|---|
| `lt.curly` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 0.12 起删除；对应名 `prec`/`succ`（`prec` 7 版全 ✓） |
| `shell.l` | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 0.12 新增 |
| `sect` | ✓ | ✓ | warn | warn | warn | ✗ | ✗ | 0.13 弃用 → `inter`（`inter` 0.13.1 起 ✓），0.15 删除 |
| `ohm` / `kelvin` / `degree.c` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | 0.13 直接删除 |
| `angle.l` | ✓ | ✓ | ✓ | warn | warn | ✗ | ✗ | 0.14 弃用 → `chevron.l`（0.14.0 起 ✓），0.15 删除 |
| `chevron.l` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 0.14.0 新增 |
| `plus.circle` | ✓ | ✓ | ✓ | warn | warn | ✗ | ✗ | 0.14 弃用 → `plus.o`（0.14.0 起 ✓），0.15 删除 |
| `diff` | ✓ | ✓ | ✓ | warn | warn | ✗ | ✗ | 0.14 弃用 → `partial`（7 版全 ✓），0.15 删除 |
| `bracket.l.double` | ✓ | ✓ | ✓ | warn | warn | ✗ | ✗ | 0.14 弃用 → `bracket.l.stroked`（0.14.0 起 ✓），0.15 删除 |
| `paren.l.double` / `shell.l.double` | ✗ | ✓ | ✓ | warn | warn | ✗ | ✗ | 0.12 才加入，0.14 弃用，0.15 删除 |
| `gt.tri` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | warn | 0.15 弃用 → `gt.closed`（0.15.0 起才 ✓；0.14.2 的 hint 已指向它但当时不存在） |
| `tack.r.double` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | warn | 0.15 弃用 → `tack.rr`（0.15.0 起 ✓）；旧名仍可用 |
| `sacred_lit` / `sacred_fraktur` / `ss` / `st` / `arrow.twoheaded` / `integral.dblintegral` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **不是 typst 数学名**——0.11.1 就不存在，别把它们当改名源/目标 |

要点：

- 改名**不是一次到位**：`sect` 0.13 弃用、0.15 才删；`angle.l`/`plus.circle`/`diff` 0.14 弃用、0.15 删；`gt.tri` 到 0.15.1 都还能用（仅 warning）。
- 新名与旧名弃用的时序：`inter` 与 `sect` 的弃用同版出现（0.13.1）；`chevron.l`/`plus.o`/`bracket.l.stroked` 与 0.14 的弃用提示同版出现；**反例**是 `gt.closed`（0.15.0 才存在，0.14.2 的 hint 已开始指向它）。
- 诊断差异不等于语法差异：`unknown variable: X`（点号前缀都没有）与 `unknown symbol modifier`（有前缀但修饰符不认识）是两类报错，例子中已逐条记录。

---

## 7. 明确"未变"的文法主干 + 附带的非 math 变化

### 7.1 0.12–0.15 没有文法改动的部分

以下主干在 7 版实测中没有出现文法级差异（只有布局/文案演进）：

- `$…$` / `$$…$$` 与 inline/block 判定（按 `$` 旁空白）；
- `^` / `_` 附着、`limits` / `scripts` 的**文法**（字符档位漂移是数据层，见第 8 节 8.4）；
- `/` 分数的文法形状（结合优先级见 4.1）；
- `f(...)` 调用、`'` 素数、`!` 阶乘、`.` 点号修饰；
- shorthand 集合本身（`->`、`<=>` 等；变的只是 `~` 的目标与 shorthand 的结合，见 2.1、4.1）；
- `&` / `\` 行列与对齐、mat 的 `;` / `,` 分隔；
- `#` 内插基本文法（math 内 code 值带 `#` 的规则不变）；
- 标签 `<name>` 文法（`$x$ <lbl>` 各版 OK）。

### 7.2 附带的非 math 变化（影响嵌在数学里的内容）

- **`#-30deg`（一元负号）**：各版都 `error: unexpected minus`；**0.15.0 起**新增 hint `to use a unary operator here, wrap the entire expression in parentheses`（0.14.2 及以前无 hint）。✅ 7 版实测。
- **顶层不配对 `]`**：0.13 起硬错误（见 3.5）。✅
- set 规则里标识符与 `(` 之间不得有空格、`0b…pt` 非法（0.13 changelog）：📄 非 math，未实测。

### 7.3 参考来源

- Typst releases：`https://github.com/typst/typst/releases/tag/v0.12.0 … v0.15.1`
- Changelog 源文件：`docs/content/changelog/0.{12,13,14,15}.0.typ` @ v0.15.1（0.14.0 经 jsdelivr、0.15.0 经 release 页取正文）
- 优先级两条的上游 issue/PR：#5925 "Make math shorthands noncontinuable"（关闭 #2789 "Incorrect rendering of parentheses around a fraction with greater than or equal"）、#5996 "Parse multi-character numbers consistently in math"（关闭 #4828，原例 `1/2(x)` vs `1/10(x)`）
- 本文件所有 ✅ 结论来自 7 个本地官方二进制的实测（诊断 / 帧尺寸 / 同版哈希 / montage），探针与拼图脚本为一次性产物、不入库。

---

## 8. 版本升级操作：`_`/`^` 上下位置（`rel_names`）的规则同步

> 适用：任何把 `version.lan` 从 0.11.1 上调的**版本升级任务**。平时只 `sync:symbols`（数据层）**不用**动本节。
> 关联代码：`src/normalize.ts` → `rel_names` + `is_limit`；该集合上方注释记录了 2026-10-05 的核对结论与本节 8.4 的漂移清单。
> 判定链：**符号名 → 字符 → 官方数学类 → `limits`（正上正下）还是 `scripts`（右上右下）**。运行时真源只有 `rel_names` 一份，Unicode 类表只在核对时临时用，不进 `src`。

### 8.1 规则写在哪（源码坐标随版本搬家）

| | v0.11.1（现基线） | v0.15.1 |
|---|---|---|
| 规则本体 | `crates/typst/src/math/attach.rs :: Limits::for_char` (:202) · `for_class` (:217) | `crates/typst-library/src/math/attach.rs :: Limits::for_char` (:160) → `for_char_with_class` (:165) |
| class 输入 | **直接查底表** `unicode_math_class::class(c)` | `crates/typst-utils/src/lib.rs:385 :: default_math_class(c)`：typst 自己的逐字符 override 表（`':'`→Relation、`'⋯⋱⋰⋮'`→Normal、`'⊥'`→Normal、`'⟇'`→Binary、`'⎰⟅'`→Opening、`'⎱⟆'`→Closing、`'⅋'`→Binary…，每条挂 issue/PR 链接），末尾才 fallback 底表 |
| 调用点 | `crates/typst/src/math/fragment.rs :: Glyph::with_id:269`（`limits: Limits::for_char(c)`）；同函数 :249-255 的 `':'`/`'⋯⋮⋱⋰'` 特例**只进间距 class，不进 limits** | `crates/typst-layout/src/math/ir/item.rs:957-958`（`class = default_math_class(c); limits = for_char_with_class(c, class)`）——特例**同时进了 limits** |
| 底表 | `Cargo.lock → unicode-math-class 0.1.0`（MathClass-15.txt, rev 15） | 同版本、同 checksum（**底表没变**） |
| 手动强制入口 | `crates/typst/src/math/class.rs:42` `set_limits(Limits::for_class(class))` | `crates/typst-library/src/math/ir/resolve.rs:1198` 同式 |

**规则形状两版一致**：`Relation → Always`（上下，与 display 无关）/ `Large → Display`（积分特例 `Never`）/ 其余 `Never`。
→ 会漂移的从来不是这条 `match`，而是**喂给它的 class**：0.11 只把 typst 的字符特例写在间距路径上，0.15 把它们并进了 `default_math_class`，于是 limits 跟着变。

### 8.2 升级流程（读 diff → 导出名单 → 改 `rel_names`）

```bash
OLD=v0.11.1 NEW=v0.15.1
git diff $OLD..$NEW -- '**/math/attach.rs'                       # ① 规则形状
git diff $OLD..$NEW -- crates/typst-utils/src/lib.rs              # ② class 输入（0.15 起；0.11 看 fragment.rs::Glyph::with_id）
git diff $OLD..$NEW -- Cargo.lock | grep -A2 unicode-math-class   # ③ 底表版本
pnpm sync:symbols                                                 # ④ 新符号名 → 决定 rel_names 候选集合
TYPST_BIN=~/.cache/xmmath/typst/$NEW/typst node <探针>            # ⑤ 导出实测表（见 8.3）
```

⑤ 的输出与 ①②③ 对齐后，改 `src/normalize.ts` 的 `rel_names` 及其注释（版本、日期、漂移清单），再走 AGENTS.md 的 review 流程：`pnpm test` 保住断言 → `pnpm review` 的「变更」标签（HEAD vs 工作区，现场算）逐例看图。

### 8.3 为什么非重跑实测不可（要重跑，不用重新设计）

1. **typst 没暴露 class/limits 查询**：`query` 只能取 `metadata`、`eval` 读不到内部属性，「哪些字符落在哪一档」只能靠一次实测导出成名单。
2. **漂移可能是行为级而非档位级**：0.15.1 把 `⟅`/`⎰` 归 `Opening` 后 `$⟅_1^2$` 直接 `error: unexpected underscore`（附着被语法禁止），读表看不出来，只有编译一次才知道。
3. **探针要自校准**：判据依赖布局的宽度公式（0.15 把布局搬到 `typst-layout`），每次都要带控制组，控制组翻了就是公式变了、判据得重写。

判据来自同一份源码，是**帧宽差**而非尺寸比例：

| 模式 | 附着后的帧宽 | 源码 |
|---|---|---|
| `limits` | `max(底座宽, 附着宽)`（上下附着居中叠放） | `attach_top_and_bottom` |
| `scripts` | `底座宽 + 附着宽 + space_after_script` | `layout_attachments` |

自包含探针（脚注用 20 位数字保证 `附着宽 ≫ 底座宽`；`wref` 基准取 `+`，官方 class=Vary ⇒ 必走 scripts）：

```js
// 存成 rel-probe.mjs：TYPST_BIN=~/.cache/xmmath/typst/v0.15.1/typst node rel-probe.mjs '<' '≈' ':' …
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const BIN = process.env.TYPST_BIN;
const S = "01234567890123456789";
const chars = process.argv.slice(2); // 由 rel_names ∪ 官方 Relation 名展开；关系符号里没有 \ $ # _ ^ { } 等需转义字符
writeFileSync(
	"/tmp/rel-probe.typ",
	"#set page(width: auto, height: auto, margin: 5pt)\n" +
		chars
			.map(
				(c) => `#context {
  let wref = measure($ +_${S}^${S} $).width - measure($ + $).width
  let w = measure($ ${c} $).width
  let a = measure($ ${c}_${S}^${S} $).width
  [#metadata((w: w, d: a - w - wref)) <p>]
}`,
			)
			.join("\n"),
);
const r = spawnSync(BIN, ["query", "/tmp/rel-probe.typ", "<p>", "--field", "value"], {
	encoding: "utf8",
});
if (r.status !== 0) {
	console.error(r.stderr);
	process.exit(1);
}
JSON.parse(r.stdout).forEach((x, i) => {
	const w = parseFloat(x.w);
	const d = parseFloat(x.d);
	console.log(chars[i], d < -w / 2 ? "limits" : "scripts", `w=${w} d=${d}`);
});
```

判定 `d < -w/2` ⇒ `limits`（limits 下 `d ≈ -(w+space)`，scripts 下 `d ≈ 0`）。**2026-10-05 实测裕度：limits 组 `d/(-w/2) ≥ 2.07`、scripts 组 `0.00`，两组中间是空的**，无临界样本。控制组：`<`、`≈` 必须 limits；`+`、`:`（0.11.1 下）必须 scripts。

### 8.4 0.11.1 → 0.15.1 实测漂移清单（11 个字符，升级时的核对起点）

| 字符 | 0.11.1 | 0.15.1 | 0.15 起因（`default_math_class`） |
|---|---|---|---|
| `:` | scripts | **limits** | `':' → Relation`（commit 2e039cb；0.11 只在间距路径有此特例） |
| `⋯ ⋱ ⋰ ⋮` | limits | scripts | `→ Normal`（PR 1726） |
| `⊥` | limits | scripts | `→ Normal`（PR 5714，与 `⟂` 区分） |
| `⟇` | limits | scripts | `→ Binary`（issue 5764） |
| `⎱ ⟆` | limits | scripts | `→ Closing`（issue 5764） |
| `⟅ ⎰` | limits | ❌ `error: unexpected underscore` | `→ Opening`，Opening 底座不可附着 |

对 `rel_names` 的落点（真升级时）：`colon` 要**加回**；`bag` `bag.l` `bag.r` `mustache` `mustache.l` `mustache.r` `bot` `tack.t` `dots` `dots.h.c` `dots.v` `dots.down` `dots.up` `or.dot` 共 **14 项**需删/改判（前 4 项还牵涉"是否允许附着"的裁决）；`bowtie` `harpoon` `harpoons` `parallel.slanted` `prec.curly` `succ.curly` `tack` `tilde` **8 项**跨版本稳定。

### 8.5 现状与待办

- 8.3 的探针是**一次性脚本，不入库**；判据、源码坐标、漂移清单都在本文档，升级时照 8.3 现场重建（几分钟的事）。

---

## 9. 本库自身的已知缺口（与 Typst 版本无关）

> 原第 6 节，内容一字未改；因新版主体占用 6/7 两节编号，顺延为第 9 节（AGENTS.md 引用的「第 8 节」仍指上面的版本升级操作节）。

1. 🔴 **行注释吞 token 的解析 bug**（`src/ast.ts`）：`// … \n` 与 `/* … */` 的终止处 `i++` 与 `for` 的 `i++` 叠加，**跳过注释结束符后的第一个字符**（`// x\nb` 丢 `b`、`/*c*/b` 丢 `b`），仅当其后是空白时无害。字符扫描 pass 同样写法会影响紧随注释的括号配对计数。
2. 🔴 **未知函数名静默丢弃**：`render` 的 `f`/`ss`/`ff` 三查无最终 `else`（`src/main.ts:812-860`），全 miss 则什么都不输出（无报错、无文本）——影响 `text/class/hide/link/box/rect/table/context/here/star/compose/...` 等 Typst 测试名。
3. 🔴 **`#` 求值是 TODO**：`src/normalize.ts:638` `x.value = v; // todo 数学运算`，`#(…)`/`#1+2` 仅存原始串，不求值。
4. 🟡 生产路径残留调试 `console.log`：`src/main.ts`（`ast1`/`ast3` dump）、`src/normalize.ts`（`+1`/`1` dump）。
5. 🟡 `esc` 标志对 `!`/shorthand 的尊重不完全；`upright/italic` 只作用 `mi/ms`；`bold` 是 CSS `fontWeight` 非 `mathvariant`；`font()` 仅覆盖 ASCII 字母+部分数字，希腊字母不映射。
