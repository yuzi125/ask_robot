let socket = null;
export default function () {
    if (socket) {
        return socket;
    } else {
        socket = new WebSocket(import.meta.env.VITE_SOCKET_HOST);
        return socket;
    }
}
