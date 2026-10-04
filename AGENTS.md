vitest作为测试 pnpm安装

这是一个库，传入typst数学语法，解析为mathml

symbols和emoji与上游同步到0.15.1，src语法解析渲染与上游同步到0.11.1

任何语法解析严格参照0.11.1，除非进行版本升级任务

语法解析后用vdom渲染，最后才是mathml，可能需要css实现更多装饰

火狐浏览器渲染的mathml不错，其他浏览器多少有细节问题

测试分层：test/corpus/math.test.ts 一个文件跑完整份 test/fixtures/math.json（412 例，每分类一个 describe、每例一个 it + vdom/MathML 快照，快照集中在 __snapshots__/math.test.ts.snap）；test/custom.test.ts 是手工维护的针对性用例，普通 it 断言、不用快照（已知缺陷用 it.fails 占位，修好后它会反过来报警）；阶段单测在 test/{ast,normalize,vdom,render}.test.ts；math.json 是唯一语料来源，可用 test/typst/get.mjs 从上游 tests/suite/math/*.typ 重新抽取

pnpm review 打开 test/review/index.html，只做对照不记录反馈：每例并排显示本库渲染与 typst 官方 PNG；「自定义」标签是临时输入对照，要长期钉住就写进 test/custom.test.ts。typst 图按 hash+typst版本缓存在 test/review/cache/（不进 git），版本固定在 test/review/config.json，默认 0.11.1（与 src 的 version.lan 一致；改版本会让缓存全部失效重渲染）

改语法/渲染导致快照不过时的流程：pnpm test 变红 → 立刻 pnpm snap:update 接受新预期并把快照连同 src 一起提交（git 里那份就是上一次认可的基线）→ pnpm review:changes 生成「git 基线 vs 工作区快照」的变更清单（cache/changes.json）→ pnpm review 的「变更」标签逐例看旧渲染/新渲染/typst 官方图；发现不对就回去改代码，下一轮循环会覆盖

官方一致性基准：typst 0.15.x `compile --format html --features html` 会输出原生 MathML（0.13/0.14 不会），可拿它和本库输出做结构化对比

语料里有一批 typst 自己也拒绝编译的用例（..args 展开、未定义变量、故意不配对的分隔符、旧符号名），不同版本失败集合不同，对照时按「官方无输出」处理

旧的人类测试 test/typst/more_test.html 保留作历史参考，现改为读 math.json，需经 pnpm dev 打开（/test/typst/more_test.html）

sync:symbols脚本用于同步emoji和symbols，render:typst可以自定typst版本，查看官方标准渲染结果的图片

版本升级任务（动 version.lan 之前）先读 docs/math-syntax-typst-diff.md 第 8 节：`_`/`^` 上下位置规则的源码坐标（0.11.1 vs 0.15.1）、帧宽差探针脚本与判据、0.11→0.15 的 11 个字符漂移清单；升级后先重跑探针、再改 src/normalize.ts 的 rel_names 及其注释