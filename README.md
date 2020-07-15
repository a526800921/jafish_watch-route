# @jafish/watch-route

[![npm](https://img.shields.io/npm/v/@jafish/watch-route)](https://www.npmjs.com/package/@jafish/watch-route)

监听路由，通过代理 history，以及记录路由信息进行匹配，可以做到底层的路由监听，以及页面级的数据存储，可用于埋点所需

因代理了 history，故对 history 操作路由提供完全可靠支持，对 hash location 提供尽量可靠的支持

### 注意事项

* 因为是 主动 + 被动 监听，在个别情况下会有误差

* 从有 watch-route 的页面无刷新跳转到无 watch-route 的页面目前不做处理，这种情况目前只会在微服务框架下出现。 解决思路：页面栈为数组，页面 change 的时候根据页面跨越个数来做数组的填充，如 [A] -> 返回跨越2个页面 -> [B, null, A] ，然后在后续的跳转中补充占位的 null 或者移除，形成完整的页面栈

* 若在两个页面内互相跳转，且前进后退则stack无法判断 - hash跳转，location跳转（history跳转已判断） 例如：A 跳到 B, B 跳到 A, A 跳到 B，则此时页面栈为 [A, B, A]，在此点击返回，页面栈为 [A, B] 历史页面栈为 [A]，在这时，前进或者后退，下一个页面都是 A 页面，此时无法判断是前进还是后退，默认给定 后退 操作

* 使用 location.replace 进行跳转，会进行当前页面前三项到后三项的判断，超出无法判断，超出之后给定 href 操作

### 使用

```js
import * as watchRoute from '@jafish/watch-route'

// 初始化
watchRoute.initWatchRoute()

// 监听路由改变
watchRoute.routeChange((newPage, oldPage) => {
    console.log(newPage.pathname)
    console.log(oldPage.pathname)
})

// 获取页面前进路线，最大缓存20条
watchRoute.getPageForward()

// 获取页面栈
watchRoute.getPageStack()

// 获取当前页面信息
watchRoute.getCurrentPage()

// 更新当前页面的 otherData
const pageId = watchRoute.updatePageStackOtherData('<onlyKey>', (): any => {

    return {
        aaa: 1
    }
})

// 删除选中页面的 otherData
watchRoute.removePageStackOtherData(pageId, '<onlyKey>')

// 获取当前页面所有的 otherData
watchRoute.getCurrentPageOtherData(getCurrentPage())

// 获取当前页面指定key的 otherData
watchRoute.getCurrentPageOtherData(getCurrentPage(), '<onlyKey>')
```


