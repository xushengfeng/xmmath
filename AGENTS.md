vitest作为测试 pnpm安装

这是一个库，传入typst数学语法，解析为mathml

symbols和emoji与上游同步到0.15.1，src语法解析渲染与上游同步到0.11.1

语法解析后用vdom渲染，最后才是mathml，可能需要css实现更多装饰

火狐浏览器渲染的mathml不错，其他浏览器多少有细节问题

现在的测试很弱，只能靠人类视觉测试，ast等有一些测试样板。旧的人类测试是 test/typst/more_test.html ，测试例应该是官方的，现已不可考，但仍是重要且丰富的测试例

sync:symbols脚本用于同步emoji和symbols，render:typst可以自定typst版本，查看官方标准渲染结果的图片