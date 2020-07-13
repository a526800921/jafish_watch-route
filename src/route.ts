/// <reference path="./index.d.ts" />

import { isNumber, isUndefined } from '@jafish/utils'
import {
    initStorage,
    addPageForward,
    pushPageStack,
    replacePageStack,
    backPageStack,
    forwardPageStack,
    updatePageStackCurrent,
    removePageStack,
    getPageStack,
    getCurrentPage,
    getCurrentIndex,
    useHistoryStateID,
} from './stack'

const isObject = obj => Object.prototype.toString.call(obj) === '[object Object]'
const joinPath = (obj: Jafish_WatchRoute.JoinPathData): string => `${obj.pathname}${obj.search}${obj.hash}`
const noHistoryStateID = (target: Jafish_WatchRoute.PageStack): boolean => isUndefined(target.data.historyStateID)

// 前进路线增加，并添加数据
const addPageForwardUnify = () => addPageForward(getCurrentPage())

// 监听初始化
export default function init() {
    // 初始化缓存
    initStorage()

    // history 代理
    const { back, forward, go, pushState, replaceState } = window.History.prototype
    // 阻止 popstate
    let stopPopstate: boolean = false

    // 返回
    window.History.prototype.back = function (...arg: any[]) {
        // 前进路线增加
        addPageForwardUnify()
        // 页面栈后退
        setTimeout(() => backPageStack(), 4)
        // back 会触发 popstate
        stopPopstate = true

        return back.apply(this, arg)
    }
    // 前进
    window.History.prototype.forward = function (...arg: any[]) {
        // 前进路线增加
        addPageForwardUnify()
        // 页面栈前进
        setTimeout(() => forwardPageStack(), 4)
        // forward 会触发 popstate
        stopPopstate = true

        return forward.apply(this, arg)
    }
    // 前进 or 后退
    window.History.prototype.go = function (delta: number, ...arg: any[]) {
        if (delta !== 0 && typeof delta === 'number') {
            // 前进路线增加
            addPageForwardUnify()
            // 页面栈前进
            setTimeout(() => updatePageStackCurrent(delta), 4)
        }
        // go 会触发 popstate
        stopPopstate = true

        return go.apply(this, [delta, ...arg])
    }
    // 新增前进
    window.History.prototype.pushState = function (data: any, title: string, url: string, ...arg: any[]) {
        // 前进路线增加
        addPageForwardUnify()
        // 页面栈添加
        // 给 histroy 添加标记参数
        const watchRouteID: number = useHistoryStateID()
        const newData: Jafish_WatchRoute.KV = isObject(data) ? { ...data, watchRouteID } : { data, watchRouteID }
        // 跳转完成后添加到页面栈
        setTimeout(() => pushPageStack(
            {
                from: 'history',
                historyStateID: watchRouteID
            },
            url
        ), 4)

        return pushState.apply(this, [newData, title, url, ...arg])
    }
    // 重定向
    window.History.prototype.replaceState = function (data: any, title: string, url: string, ...arg: any[]) {
        // 前进路线增加
        addPageForwardUnify()
        // 页面栈重定向
        // 给 histroy 添加标记参数
        const watchRouteID: number = useHistoryStateID()
        const newData: Jafish_WatchRoute.KV = isObject(data) ? { ...data, watchRouteID } : { data, watchRouteID }
        // 跳转完成后添加到页面栈
        setTimeout(() => replacePageStack(
            {
                from: 'history',
                historyStateID: watchRouteID
            },
            url
        ), 4)

        return replaceState.apply(this, [newData, title, url, ...arg])
    }

    // 监听浏览器原生动作
    // 返回、前进、hashchange
    // 连续的两次 hash 操作只会触发一次 popstate
    window.addEventListener('popstate', e => {
        // 阻止一次触发
        if (stopPopstate) return stopPopstate = false

        const historyStateID: number = (e.state && e.state.watchRouteID !== void 0) ? e.state.watchRouteID : null

        // 记录通过非 history 即 hash 生成 or 第一次进入的记录
        if (historyStateID === null) {
            // hash 操作只能一次一层，故只需要与前进路线做匹配就可以得到具体位置
            // hash 没有更改时会触发 popstate 但是页面历史无新增
            // location.href = location.href 在有 hash 时页面无刷新操作，在无 hash 时页面会刷新页面等同 location.reload
            const fillPath = joinPath(window.location)
            const pageStack = getPageStack()
            const currentIndex = getCurrentIndex()
            const currentPage = pageStack[currentIndex]
            const prevPage = pageStack[currentIndex - 1]
            const nextPage = pageStack[currentIndex + 1]

            // 当前 href 与记录中当前页面的 href 相同，且带有 hash 代表 location.href = location.href
            if (noHistoryStateID(currentPage) && fillPath === joinPath(currentPage)) {
                // 页面无新增，不处理
            }
            // 当前 href 与记录中当前页面的上一个页面 href 相同，代表用户返回
            // 返回到第一次进入的页面也可通过 href 判断
            else if (prevPage && noHistoryStateID(prevPage) && fillPath === joinPath(prevPage)) {
                // 前进路线增加
                addPageForward(currentPage)
                // 页面栈后退
                backPageStack()
            }
            // 当前 href 与记录中当前页面的下一个页面 href 相同，可以认为是前进（当再次前进时如果 href 不匹配则会认为是新增）
            else if (nextPage && noHistoryStateID(nextPage) && fillPath === joinPath(nextPage)) {
                // 前进路线增加
                addPageForward(currentPage)
                // 页面栈前进
                forwardPageStack()
            }
            // 当前 href 与记录中 href 都没有匹配上，表示用户前进了一个页面
            else {
                // 前进路线增加
                addPageForward(currentPage)
                // 页面栈新增
                pushPageStack({
                    from: 'hash'
                })
            }
        }
        // 记录通过 history 生成
        else {
            // 通过 history 生成时，与历史记录做匹配，判断所在位置
            const pageStack = getPageStack()
            const nextIndex = pageStack.findIndex(item => (item.data || {}).historyStateID === historyStateID)
            const currentIndex = getCurrentIndex()

            // 一般不会出现
            if (nextIndex === -1 || currentIndex === -1) return

            const currentPage = pageStack[currentIndex]

            // 前进路线增加
            addPageForward(currentPage)
            // 页面栈改变
            updatePageStackCurrent(nextIndex - currentIndex)
        }
    })

    // 载入页面时，进行一次对当前页面的记录
    const start = () => {
        const fillPath = joinPath(window.location)
        const { state } = window.history
        const pageStack = getPageStack()

        // 页面栈无数据，说明为第一次进入
        if (pageStack.length === 0) {
            // 页面栈新增
            pushPageStack({
                from: 'enter',
            })
        }
        // 非第一次进入
        // location.reload, location.href, location.replace, history.go 到 location 跳转的页面, history.back 到 location 跳转的页面
        else {
            const currentIndex = getCurrentIndex()
            const currentPage = pageStack[currentIndex]
            const prevPage = pageStack[currentIndex - 1]
            const nextPage = pageStack[currentIndex + 1]

            // 当前页面为 history 跳转的页面
            // 则直接将匹配页面作为当前页面
            if (state && isNumber(state.watchRouteID)) {
                const nextIndex = pageStack.findIndex(item => item.data.historyStateID === state.watchRouteID)

                // 这种情况一般不会存在
                if (currentIndex === -1 || nextIndex === -1) return
                // 前进路线增加
                addPageForward(currentPage)
                // 页面栈改变
                updatePageStackCurrent(nextIndex - currentIndex)
            }
            // 非 history 跳转的页面
            else {
                // 先判断是否为刷新
                // 与当前页做全判断
                if (noHistoryStateID(currentPage) && fillPath === joinPath(currentPage)) {
                    // 刷新页面，不做处理
                }
                // 判断是否为返回
                else if (prevPage && noHistoryStateID(prevPage) && fillPath === joinPath(prevPage)) {
                    // 前进路线增加
                    addPageForward(currentPage)
                    // 页面栈后退
                    backPageStack()
                }
                // 判断是否为前进
                else if (nextPage && noHistoryStateID(nextPage) && fillPath === joinPath(nextPage)) {
                    // 前进路线增加
                    addPageForward(currentPage)
                    // 页面栈前进
                    forwardPageStack()
                }
                // 与页面栈记录的当前位置、前一个、后一个都匹配不上，则表示用户进入了一个新的页面 or 使用了 location.replace 
                else {
                    // 在这里做一个 location.replace 的校正处理
                    // 将记录的当前位置的前三个到后三个全部进行匹配，超出3次的 replace 不做处理
                    const cut: number = 3
                    const pageStackCut = pageStack.slice(currentIndex - cut, currentIndex + cut)
                    const findPage = pageStackCut.find(item => noHistoryStateID(item) && fillPath === joinPath(item))

                    // 如果找到了，则需要移除记录的当前位置到查找到的位置中间的记录 [a, b, c] -> [a, c]
                    if (findPage) {
                        const findIndex = pageStack.findIndex(item => item === findPage)

                        // 前进路线增加
                        addPageForward(currentPage)
                        // 页面栈改变
                        updatePageStackCurrent(findIndex - currentIndex)
                        // 中间记录移除
                        findIndex < currentIndex ?
                            removePageStack(findIndex, currentIndex) :
                            removePageStack(currentIndex, findIndex)
                    }
                    // 没有找到，按照 location.href 处理
                    else {
                        // 前进路线增加
                        addPageForward(currentPage)
                        // 页面栈新增
                        pushPageStack({
                            from: 'location'
                        })
                    }
                }
            }
        }
    }

    start()
}
