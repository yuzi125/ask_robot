export default {
    //取得本地指定房間聊天
    getLocalMsg: (roomId) => {
        return JSON.parse(localStorage.getItem("msg_" + roomId)) || [];
    },
    //設定本地指定房間聊天
    setLocalMsg: (roomId, msg) => {
        localStorage.setItem("msg_" + roomId, JSON.stringify(msg || []));
    },
    //取得本地房間機器人context
    getLocalContext: (roomId) => {
        return JSON.parse(localStorage.getItem("context_" + roomId)) || [];
    },
    //設定本地房間機器人context
    setLocalContext: (roomId, msg) => {
        localStorage.setItem("context_" + roomId, JSON.stringify(msg || []));
    },
    //取得本地隧道模式
    getLocalTunnel: (roomId) => {
        return JSON.parse(localStorage.getItem("tunnel_" + roomId)) || false;
    },
    //設定本地隧道模式
    setLocalTunnel: (roomId, msg) => {
        localStorage.setItem("tunnel_" + roomId, JSON.stringify(msg || false));
    },
};

