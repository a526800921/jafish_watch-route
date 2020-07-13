/// <reference path="./index.d.ts" />

import { getItemUseSession, setItemUseSession, removeItemUseSession } from '@jafish/utils'

const createKey = (key: string): string => `watch-route/${key}`

const pageForwardKey: string = createKey('PAGE_FORWARD')
const pageStackKey: string = createKey('PAGE_STACK')
const pagePositionKey: string = createKey('PAGE_POSITION')
const historyStateIDKey: string = createKey('HISTORY_STATE_ID')

// 应该有个页面前进路线 
// 该路线不包括当前页面
const pageForward: Jafish_WatchRoute.PageForward[] = []
// 还有一个页面栈
const pageStack: Jafish_WatchRoute.PageStack[] = []
// 当前页面位置（将位置独立，因页面栈分组缓存）
let pagePosition: Jafish_WatchRoute.PagePosition = -1
// 以及用于记录的 history state 参数
let historyStateID: Jafish_WatchRoute.HistoryStateID = 1

// 初始化缓存，兼顾ssr
let initStorageFlag: boolean = false
export const initStorage = () => {
    if (initStorageFlag) return
    initStorageFlag = true

    // 初始化页面前进路线
    pageForward.push(...(getItemUseSession(pageForwardKey) || []))
    // 初始化页面栈
    pageStack.push(...((() => {
        let stack: Jafish_WatchRoute.PageStack[] = []
        let isEnd = false
        let count = 0

        while (!isEnd) {
            // 分组获取，直到没有
            const items = getItemUseSession(`${pageStackKey}/${count}`)

            if (items && items.length > 0) {
                stack = stack.concat(items)
                count++
            }
            else isEnd = true
        }
        // 补充缓存移除的 otherData 字段
        stack.forEach(item => item.otherData = {})

        return stack
    })()))
    // 初始化页面位置
    pagePosition = getItemUseSession(pagePositionKey)
    if (pagePosition === null) pagePosition = -1

    // 初始化 historyStateID
    historyStateID = getItemUseSession(historyStateIDKey) || 1
}

const getPagePosition = (): Jafish_WatchRoute.PagePosition => pagePosition
// 设置位置
const setPagePosition = (relative: number) => {
    pagePosition += relative
    setItemUseSession(pagePositionKey, pagePosition)
    return pagePosition
}

export const getHistoryStateID = (): Jafish_WatchRoute.HistoryStateID => historyStateID
export const useHistoryStateID = (): Jafish_WatchRoute.HistoryStateID => {
    const id = historyStateID
    // 缓存下一个要使用的
    setItemUseSession(historyStateIDKey, ++historyStateID)
    return id
}

// 页面栈成员缓存会进行分组，每组成员个数定为20个
// 前进路线则上限为20个
const itemAmount: number = 20
// 获取成员位置所在分组
const getInCount = (index: number): number => Math.floor(index / itemAmount)

const getPageForwardData = (currentPage: Jafish_WatchRoute.PageStack): Jafish_WatchRoute.PageForward => {
    const { pathname, hash, search, data } = currentPage

    return { pathname, hash, search, data, otherData: getCurrentPageOtherData(currentPage) }
}
// 有添加 pageForward 的方法
/** 
 * @param {Object} currentPage 使用 PageStack 使 pageForward 与 pageStack 数据保持统一
*/
export const addPageForward = (currentPage: Jafish_WatchRoute.PageStack): void => {
    const item = getPageForwardData(currentPage)

    // 添加
    pageForward.push(item)

    // 超出上限移除最旧的那一个
    if (pageForward.length >= itemAmount) pageForward.shift()
    // 缓存
    setItemUseSession(pageForwardKey, pageForward)
}

// 操作 pageStack 的方法
// 缓存修正
const setPageStackCache = ({
    index = 0, // 被修改的记录下标
    removeTail = 0, // 移除尾部记录的个数
    refreshTail = false, // 是否需要刷新下标开始到最后的所有数据缓存
}) => {
    // 记录所在的分组
    const inCount = getInCount(index)
    const filterPageStack = pageStack.map(item => {
        // 附加值 otherData 不做缓存
        const { otherData, ...filterItem } = item

        return filterItem
    })
    // 尾部编号
    const tailCount = getInCount(filterPageStack.length - 1)

    // 有移除记录，判断是否需要移除缓存
    if (removeTail > 0) {
        // 旧的编号
        const oldCount = getInCount(filterPageStack.length - 2 + removeTail)

        let diff = oldCount - tailCount
        while (diff > 0) {
            // 移除缓存
            removeItemUseSession(`${pageStackKey}/${tailCount + diff}`)
            // 下一个
            diff--
        }

        // 被修改记录所在组与尾部分组不同，则也需要刷新尾部分组
        if (inCount !== tailCount) setItemUseSession(`${pageStackKey}/${tailCount}`, filterPageStack.slice(tailCount * itemAmount))
    }

    // refreshTail 为 true 刷新被修改项之后的所有数据，否则只刷新当前所在组
    const diff = refreshTail ? (tailCount - inCount) : 0
    let count = 0
    while (count <= diff) {
        // 顺序写入
        const nextCount = inCount + count
        // 设置缓存
        setItemUseSession(`${pageStackKey}/${nextCount}`, filterPageStack.slice(nextCount * itemAmount, (nextCount + 1) * itemAmount))
        // 下一个
        count++
    }
}
// 获取页面基本参数
const getPageStackData = (data, url = ''): Jafish_WatchRoute.PageStack => {
    let { pathname, hash, search } = window.location
    // 传入url与实际不符，以传入为准
    if (url && (pathname.indexOf(url) === -1 && url.indexOf(pathname) === -1)) {
        [pathname, search = ''] = url.split('?');
        [search = '', hash = ''] = search.split('#');
    }

    return { pathname, hash, search, data, otherData: {} }
}
// 添加
export const pushPageStack = (data, url?: string): void => {
    const item = getPageStackData(data, url)
    const index = getPagePosition()
    const remove = index > -1 ? pageStack.splice(index + 1) : []

    // 新增
    pageStack.push(item)
    // 设置位置
    setPagePosition(1)
    // 缓存
    setPageStackCache({ index: pageStack.length - 1, removeTail: remove.length })
    // 触发钩子
    runRouteChangeHooks()
}
// 重定向
export const replacePageStack = (data, url: string): void => {
    const item = getPageStackData(data, url)
    const index = getPagePosition()

    // 替换，位置不变
    pageStack.splice(index, 1, item)
    // 缓存
    setPageStackCache({ index: index })
    // 触发钩子
    runRouteChangeHooks()
}
// 返回
export const backPageStack = (): void => {
    updatePageStackCurrent(-1)
}
// 前进
export const forwardPageStack = (): void => {
    updatePageStackCurrent(1)
}
// 修改当前页面所在位置
export const updatePageStackCurrent = (relative: number = 0): void => {
    const index = getPagePosition()
    let newIndex = index + relative

    // 范围限制
    if (newIndex > pageStack.length - 1) newIndex = pageStack.length - 1
    else if (newIndex < 0) newIndex = 0

    if (index === newIndex) return

    // 设置
    setPagePosition(relative)
    // 所在分组
    const inCount = getInCount(index)
    const newInCount = getInCount(newIndex)
    // 缓存
    // 不在一个分组，缓存旧分组
    if (inCount !== newInCount) setPageStackCache({ index: index })
    // 缓存当前分组
    setPageStackCache({ index: newIndex })
    // 触发钩子
    runRouteChangeHooks()
}
// 移除从开始到结束中间的页面
export const removePageStack = (start: number, end: number) => {
    // 截取前半段
    const splice = pageStack.splice(start + 1)
    // 截取后半段
    const endPageStack = splice.splice(end - start - 1)

    // 进行拼接
    pageStack.push(...endPageStack)
    // 缓存分组，并刷新 start 之后的尾部缓存
    setPageStackCache({ index: start, removeTail: end - start - 1, refreshTail: true })
}
// 修改当前页面附加参数
export const updatePageStackOtherData = (key: string, data: () => any): void => {
    const index = getPagePosition()
    const { otherData } = pageStack[index]

    // 赋值
    otherData[key] = function () {
        try {
            return data()
        } catch (error) {
            console.error('@jafish/watch-route otherData function:', error)
            return null
        }
    }
}

// 获取前进路线
export const getPageForward = () => pageForward.slice()
// 获取页面栈
export const getPageStack = () => pageStack.slice()
// 获取当前页面
export const getCurrentPage = () => pageStack[getPagePosition()]
export const getCurrentIndex = getPagePosition
// 获取当前页面数据
export const getCurrentPageOtherData = (currentPage = getCurrentPage(), key?: string): any => {
    // 获取当前页面附带值最终结果
    if (key) return currentPage.otherData[key]()
    else return Object.keys(currentPage.otherData)
        .reduce((obj, key) => {
            // 遍历获取数据
            obj[key] = currentPage.otherData[key]()

            return obj
        }, {})
}

// 路由 change 钩子相关
const routeChangeHooks: Jafish_WatchRoute.RouteChangeHook[] = []
export const routeChange = (fn: Jafish_WatchRoute.RouteChangeHook): Function => {
    routeChangeHooks.push(fn)

    // 返回一个销毁的函数
    return (): void => {
        const index = routeChangeHooks.indexOf(fn)

        if (index > -1) routeChangeHooks.splice(index, 1)
    }
}
// 执行钩子
const runRouteChangeHooks = (): void => {
    const newPage = getCurrentPage()
    const oldPage = getPageForward().pop()

    routeChangeHooks.forEach(fn => fn(newPage, oldPage))
}
