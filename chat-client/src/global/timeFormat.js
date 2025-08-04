/*--------------------------
接收建立時間
 這邊給指定朋友回傳所有訊息時間
 同一日顯示 時與分  00:00
 不同日顯示 月與日 時與分  01-01 00:00
 不同年顯示 年與月與日 時與分 2022-01-01 00:00
----------------------------*/
// import { format } from "date-fns";
// format(new Date(time), "yyyy-MM-dd hh:mm:ss");

export function timeDateFormat(time) {
    let timeString = "";

    const nowTime = new Date();
    const nowYear = nowTime.getFullYear();
    const nowMonth = nowTime.getMonth() + 1;
    const nowDay = nowTime.getDate();

    const createTime = new Date(time);
    const createYear = createTime.getFullYear();
    let createMonth = createTime.getMonth() + 1;
    let createDay = createTime.getDate();
    let createHour = createTime.getHours();
    let createMinute = createTime.getMinutes();

    if (createMonth < 10) createMonth = `0${createMonth}`;
    if (createDay < 10) createDay = `0${createDay}`;
    if (createHour < 10) createHour = `0${createHour}`;
    if (createMinute < 10) createMinute = `0${createMinute}`;

    //這邊用!=字串跟數字對比
    if (nowYear !== createYear) {
        timeString = `${createYear}-${createMonth}-${createDay} ${createHour}:${createMinute}`;
    } else if (nowMonth != createMonth || nowDay != createDay) {
        timeString = `${createMonth}-${createDay} ${createHour}:${createMinute}`;
    } else {
        timeString = `${createHour}:${createMinute}`;
    }

    return timeString;
}
