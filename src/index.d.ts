declare namespace Jafish_WatchRoute {
    interface KV {
        [key: string]: any
    }
    
    // 页面附加参数
    type OtherData = () => any 

    // 页面位置
    type PagePosition = number

    // history所用id
    type HistoryStateID = number

    // 页面id
    type PageID = number

    // data 参数
    interface PageData {
        from: string
        historyStateID?: HistoryStateID
    }
    
    // 页面前进路线
    interface PageForward {
        id: PageID
        pathname: string
        hash: string
        search: string
        data: PageData
        otherData: KV
    }

    // 页面栈
    interface PageStack {
        id: PageID
        pathname: string
        hash: string
        search: string
        data: PageData
        otherData: {
            [key: string]: OtherData
        }
    }

    interface JoinPathData {
        pathname: string
        hash: string
        search: string
        [key: string]: any
    }

    type RouteChangeHook = (newPage: PageStack, oldPage: PageForward) => any
}