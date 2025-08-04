const platform = require("platform");
const { redisClient } = require("../global/redisStore.js");
const BanIp = require("../orm/schema/ban_ip");
const BanIpHistory = require("../orm/schema/ban_ip_history");
const Settings = require("../orm/schema/settings");
const lastRequestTime = {};
const crypto = require("crypto");
const { PassThrough } = require("stream");

function getRedisKey(cookieValue) {
    return crypto.createHash("sha256").update(cookieValue).digest("hex");
}

// 新增：計算到下一個凌晨 00:00 的秒數
const getSecondsUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight - now) / 1000);
};

// 檢查 Redis key 是否為 list 並初始化
const checkAndResetList = async (redisClient, key) => {
    const type = await redisClient.type(key);
    
    if (type === "string") {
        const currentValue = await redisClient.get(key);
        await redisClient.del(key);
        await redisClient.lPush(key, currentValue);
    }

    return true;
};

const formatCountdown = (targetDate) => {
    try {
        if (isNaN(targetDate.getTime())) {
            throw new Error("Invalid date");
        }

        const now = new Date();
        const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
        const diff = targetMidnight - now;

        // 過期就回0，會繼續做原先ban ip的動作
        return diff > 0 ? Math.floor(diff / 1000) : 0;
    } catch (e) {
        console.error("formatCountdown error:", e);
        return 0;
    }
};

// 限速檢查和 session 控制
const checkRateLimitThenSession = async (req, res, next) => {
    try {
        const isInitialApi = req.path.match(
            /\/initial/
        );
        if (isInitialApi) {
            return next();
        }
        
        // 新增：檢查 Redis 中的 access_control:max_access_count
        let maxSessionLimit = await redisClient.get("access_control:max_access_count");
        if (!maxSessionLimit) {
            // 如果 Redis 中沒有，從資料庫中取得
            try {
                const settings = await Settings.findOne({
                    where: { key: "create_session_limit" },
                    attributes: ["value"],
                });
                maxSessionLimit = settings ? settings.value : 30;
                await redisClient.set("access_control:max_access_count", maxSessionLimit);
            } catch (e) {
                console.error("從資料庫中取得 create_session_limit 時發生錯誤", e);
            }
        }
        maxSessionLimit = parseInt(maxSessionLimit);

        let banIpExpireDate = await redisClient.get("access_control:ban_ip_expire_date");        
        if (!banIpExpireDate) {
            // 如果 Redis 中沒有，從資料庫中取得
            try {
                const settings = await Settings.findOne({
                    where: { key: "ban_ip_expire_date" },
                    attributes: ["value"],
                });
                banIpExpireDate = settings ? settings.value : 0;
                await redisClient.set("access_control:ban_ip_expire_date", banIpExpireDate);           
            } catch (e) {
                console.error("從資料庫中取得 ban_ip_expire_date 時發生錯誤", e);
            }
        }
        if (banIpExpireDate == -1) {
            return next();
        }else if (banIpExpireDate != 0 && banIpExpireDate != -1) {
            const setBanIpExpireDate = formatCountdown(new Date(banIpExpireDate));
            if (setBanIpExpireDate > 0) {
                return next();
            }
        }             
        
        const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress)
            .split(",")[0]
            .replace(/^::ffff:/, "")
            .replace(/^::1$/, "127.0.0.1");

        // 新增：先檢查 Redis 中是否有此 IP 的封鎖記錄
        const banKey = `access_control:ip:${ip}`;
        let isBanned = await redisClient.get(banKey);

        // 如果 Redis 中沒有記錄，則檢查資料庫
        if (!isBanned) {
            try {
                const banRecord = await BanIp.findOne({
                    where: { ip: ip },
                });

                if (banRecord) {
                    // 如果找到封鎖記錄
                    const now = new Date();
                    if (!banRecord.expired_time || banRecord.expired_time > now) {
                        // 如果是永久封鎖或尚未過期
                        const expireTime = banRecord.expired_time ? Math.floor((banRecord.expired_time - now) / 1000) : 0; // 0 表示永不過期

                        // 寫入 Redis
                        await redisClient.set(banKey, "100000000000000");
                        if (expireTime > 0) {
                            await redisClient.expire(banKey, expireTime);
                        }

                        // 新增：設定 triggered key
                        const redisTriggerKey = `access_control:triggered:${ip}`;
                        await redisClient.set(redisTriggerKey, "1");

                        if (expireTime > 0) {
                            await redisClient.expire(redisTriggerKey, expireTime);
                        }

                        return res.status(430).json({
                            status: "error",
                            message: "此IP已被封鎖",
                            expiredTime: banRecord.expired_time,
                        });
                    }
                }
            } catch (e) {
                console.error("從資料庫中取得 ban_ip 時發生錯誤", e);
            }
        } else {
            const currentCount = await redisClient.get(banKey);
            if (currentCount && parseInt(currentCount) >= maxSessionLimit) {
                const redisExpireTime = await redisClient.ttl(banKey)
                let expiredTime = null;
                if (redisExpireTime > 0) {
                    expiredTime = new Date(Date.now() + redisExpireTime * 1000);
                }
                return res.status(430).json({
                    status: "error",
                    message: "此IP已被封鎖",
                    expiredTime,
                });
            }
        }

        const currentTime = Date.now();

        // 檢查是否在 x 秒內重複請求
        if (lastRequestTime[ip] && currentTime - lastRequestTime[ip] < 4000) {
            // 若在限制時間內，直接跳過計數並進行下一步
            return next();
        }

        // 記錄最後一次請求時間
        lastRequestTime[ip] = currentTime;

        // 確認 ava-guest cookie 是否變更
        const guestCookieKey = `access_control:last_guest_cookie:${ip}`;
        // 將舊資料轉換為 list
        await checkAndResetList(redisClient, guestCookieKey);
        const lastGuestCookies = await redisClient.lRange(guestCookieKey, 0, -1);

        // 確保 "first_time" 在列表中
        if (!lastGuestCookies.includes("first_time")) {
            await redisClient.lPush(guestCookieKey, "first_time");
            await redisClient.expire(guestCookieKey, getSecondsUntilMidnight());
        }
        
        const currentGuestCookie = req.cookies["ava-guest"] ? getRedisKey(req.cookies["ava-guest"]) : "first_time";

        if (!lastGuestCookies.includes(currentGuestCookie)) {
            // 若 ava-guest cookie 改變，增加計數器並更新 Redis 中的 guest cookie
            const redisKey = `access_control:ip:${ip}`;
            const current = await redisClient.incr(redisKey);

            if (current === 1) {
                // 修改：設定在凌晨過期
                await redisClient.expire(redisKey, getSecondsUntilMidnight());
            }

            if (current >= maxSessionLimit) {
                // 修改：設定在凌晨過期
                await redisClient.expire(redisKey, getSecondsUntilMidnight());
            }

            // 更新 Redis 中的 guest cookie 列表
            await redisClient.lPush(guestCookieKey, currentGuestCookie);
            await redisClient.expire(guestCookieKey, getSecondsUntilMidnight());
        } else {
            return next();
        }

        // 檢查是否已達到限制
        const redisKey = `access_control:ip:${ip}`;
        const currentCount = await redisClient.get(redisKey);

        if (currentCount && parseInt(currentCount) >= maxSessionLimit) {
            const redisTriggerKey = `access_control:triggered:${ip}`;
            const hasTriggered = await redisClient.get(redisTriggerKey);

            if (!hasTriggered) {
                const userAgent = req.headers["user-agent"];
                const deviceInfo = platform.parse(userAgent);
                const nowDevice = `OS: ${deviceInfo.os.family}, Browser: ${deviceInfo.name}`;
                const expiredTime = new Date();
                expiredTime.setHours(24, 0, 0, 0);

                try {
                    // 先查詢 BanIp 是否存在
                    const existingBanIp = await BanIp.findOne({
                        where: { ip: ip },
                    });

                    const banIpData = {
                        ip: ip,
                        device: nowDevice,
                        status: "temporary",
                        type: "system",
                        expired_time: expiredTime,
                        operator: "system",
                    };

                    if (existingBanIp) {
                        // 如果存在就更新
                        await existingBanIp.update(banIpData);
                    } else {
                        // 不存在就新增
                        await BanIp.create(banIpData);
                    }

                    // 新增 BanIpHistory 記錄
                    await BanIpHistory.create({
                        ip: ip,
                        device: nowDevice,
                        status: "temporary",
                        type: "system",
                        expired_time: expiredTime,
                        operator: "system",
                        action: "create",
                    });

                    // 修改：設定在凌晨過期
                    await redisClient.set(redisTriggerKey, "1");
                    await redisClient.expire(redisTriggerKey, getSecondsUntilMidnight());
                } catch (e) {
                    console.error("封鎖的IP存入資料庫時發生錯誤", e);
                }
            }

            // 當請求超出限制，回傳狀態碼 430 和訊息
            const redisExpireTime = await redisClient.ttl(redisKey);

            let expiredTime = null;
            if (redisExpireTime > 0) {
                expiredTime = new Date(Date.now() + redisExpireTime * 1000);
            }
            return res.status(430).json({
                status: "error",
                message: "請求過於頻繁，已達到限制次數，請稍後再試。",
                expiredTime,
            });
        }

        next();
    } catch (e) {
        console.error("accessControlIp Middleware error:", e);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = checkRateLimitThenSession;
