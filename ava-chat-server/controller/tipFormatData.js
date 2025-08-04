function formatDate(text) {
    if (typeof text !== 'string') {
        return text;
    }

    const parts = text.split(/(\{[^}]+\})/g);

    return parts.map(part => {
        return part.replace(/{([^}]+)}/g, (match, content) => {
            const firstSpaceIndex = content.indexOf(" ");
            if (
                firstSpaceIndex === -1 && 
                !/^(now\([.\-\/]?\)|nextweek\(([0-6]|[.\-\/]|[0-6][.\-\/])?\)|nextmonth\([.\-\/]?\))$/.test(content)
            ) {
                return match;
            }
            const date = content.slice(0, firstSpaceIndex);
            const offsets = [content.slice(firstSpaceIndex + 1).replace(/\s/g, "")];
            let newDate;

            // 預設分隔符為 '-'
            const originalSeparator = date.includes('-') ? '-' 
                        : date.includes('/') ? '/' 
                        : date.includes('.') ? '.' 
                        : '-';

            // 初始化日期
            if (date.startsWith("now")) {
                newDate = new Date();
            } else if (date.startsWith("nextweek")) {
                const weekDay = content.match(/nextweek\(([0-6])(?:[.\-\/])?\)/);
                const nextWeekDate = new Date();
                if (weekDay) {
                    const targetDay = parseInt(weekDay[1], 10) % 7;
                    const currentDay = nextWeekDate.getDay();
                    let daysToAdd = targetDay > currentDay
                        ? targetDay - currentDay + 7
                        : targetDay - currentDay + 7;
                    nextWeekDate.setDate(nextWeekDate.getDate() + daysToAdd);
                }else {
                    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
                }
                newDate = nextWeekDate;
            } else if (date.startsWith("nextmonth")) {
                const currentDate = new Date();
                const safeDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);;
                safeDate.setMonth(safeDate.getMonth() + 1);
                const lastDayOfNextMonth = new Date(safeDate.getFullYear(), safeDate.getMonth() + 1, 0).getDate();
                newDate = new Date(safeDate.getFullYear(), safeDate.getMonth(), Math.min(currentDate.getDate(), lastDayOfNextMonth));
            } else {
                const dateParts = date.split(originalSeparator);
                newDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            }

            // 處理偏移量
            offsets.forEach(offset => {
                const subOffsets = offset.match(/([+-]\d+)([dmyDMY]?)/g) || [];
                subOffsets.forEach(subOffset => {
                    const match = subOffset.match(/([+-])(\d+)([dmyDMY]?)/);
                    if (match) {
                        const sign = match[1] === '+' ? 1 : -1;
                        const amount = parseInt(match[2], 10) * sign;
                        const unit = match[3] ? match[3].toLowerCase() : 'd'; // 如果單位缺失，預設為天 (d)
                        if (unit === 'd') {
                            newDate.setDate(newDate.getDate() + amount);
                        } else if (unit === 'm') {
                            newDate.setMonth(newDate.getMonth() + amount);
                        } else if (unit === 'y') {
                            newDate.setFullYear(newDate.getFullYear() + amount);
                        }
                    }
                });
            });

            if (isNaN(newDate.getTime())) {
                return match; // 如果日期無效，返回原始字串
            }

            // 格式化日期，保持原分隔符
            const year = newDate.getFullYear();
            const month = String(newDate.getMonth() + 1).padStart(2, '0');
            const day = String(newDate.getDate()).padStart(2, '0');
            return `${year}${originalSeparator}${month}${originalSeparator}${day}`;
        });
    }).join('');
}

function tipFormatDate(input) {
    try {
        // 判斷是否為物件格式
        const parsed = JSON.parse(input);

        if (Array.isArray(parsed)) {
            // 處理陣列
            return JSON.stringify(parsed.map(item => {
                if (typeof item === 'string') {
                    return formatDate(item);
                } else if (typeof item === 'object' && item !== null) {
                    // 遞歸處理物件
                    const newObj = {};
                    for (const key in item) {
                        newObj[key] = formatDate(item[key]);
                    }
                    return newObj;
                }
                return item;
            }));
        } else if (typeof parsed === 'object' && parsed !== null) {
            // 處理單一物件
            const newObj = {};
            for (const key in parsed) {
                newObj[key] = formatDate(parsed[key]);
            }
            return JSON.stringify(newObj);
        }
        return input;
    } catch (e) {
        // 非 JSON 格式，直接格式化
        return formatDate(input);
    }
}

module.exports = tipFormatDate;