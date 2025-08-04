const dayjs = require("dayjs");

// 取得從startDate到endDate的每一天的日期
function getDateList(startDate, endDate) {
    const dateList = new Map();
    let currentDate = dayjs(startDate);
    const finalDate = dayjs(endDate);
    while (currentDate.isBefore(finalDate) || currentDate.isSame(finalDate, "day")) {
        dateList.set(currentDate.format("YYYY-MM-DD"), { date: currentDate.format("YYYY-MM-DD") });
        currentDate = currentDate.add(1, "day");
    }
    return dateList;
}

// 取得搜尋開始時間
function getSearchStartTime(period) {
    let startDate = dayjs();
    let searchStartTime;

    if (period.match("days")) {
        startDate = startDate.subtract(Number(period.split(" ")[0]) - 1, "day"); // 少減1天是因為要包含今天
        searchStartTime = startDate.startOf("day").format(); // 從起始日的00:00:00開始搜尋
    } else if (period.match("mons")) {
        startDate = startDate.subtract(Number(period.split(" ")[0]), "month"); // 取得N個月前的相同日期
        startDate = startDate.add(1, "day"); // 起算日為N個月前同一日期的隔天
        searchStartTime = startDate.startOf("day").format(); // 從起始日的00:00:00開始搜尋
    } else {
        return null;
    }
    return searchStartTime;
}

module.exports = {
    getDateList,
    getSearchStartTime,
};
