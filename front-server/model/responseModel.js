function ResponseModel() {
    this.code = 1;
    this.message = "";
    this.data = null;
}

ResponseModel.prototype.code = this.code;
ResponseModel.prototype.message = this.message;
ResponseModel.prototype.data = this.data;

module.exports = ResponseModel;
