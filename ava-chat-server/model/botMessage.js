function BotMessage() {
    this.botMessage = new Map();
}
BotMessage.prototype.getRoomMsg = function (roomId) {
    return this.botMessage.get(roomId);
};
BotMessage.prototype.setRoomMsg = function (roomId, message) {
    //沒有房間時，新增一個
    if (!this.botMessage.has(roomId)) {
        this.botMessage.set(roomId, []);
    }
    this.botMessage.get(roomId).push(message);
    //超過十筆，刪除第一筆
    if (this.botMessage.get(roomId).length > 50) {
        this.botMessage.get(roomId).shift();
    }
};
var botMsg = new BotMessage();
module.exports = botMsg;
