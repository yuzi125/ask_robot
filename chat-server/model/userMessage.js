function UserMessage() {
    this.userMessage = new Map();
}
UserMessage.prototype.getRoomMsg = function (roomId) {
    return this.userMessage.get(roomId);
};
UserMessage.prototype.setRoomMsg = function (roomId, message) {
    //沒有房間時，新增一個
    if (!this.userMessage.has(roomId)) {
        this.userMessage.set(roomId, []);
    }
    this.userMessage.get(roomId).push(message);
    //超過十筆，刪除第一筆
    if (this.userMessage.get(roomId).length > 50) {
        this.userMessage.get(roomId).shift();
    }
};
var userMsg = new UserMessage();
module.exports = userMsg;
