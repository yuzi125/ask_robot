require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
const LoginType = require("../orm/schema/login_type");
const TwoFactorAuthentication = require("../orm/schema/two_factor_authentication");
const responseModel = require("../model/responseModel");
const platform = require("platform");

async function createJustTwoFactorAuth(req, res, next) {
    req.session.justTwoFactorAuth = true
    setTimeout(() => {
        if (req.session) {
            req.session.justTwoFactorAuth = undefined;
            req.session.save(err => {
                if (err) {
                    console.error("創建justTwoFactorAuth時出錯", err);
                }
            });
            console.log("justTwoFactorAuth建立成功")
        }
    }, 2500) // 2.5秒
}

async function twoFactorAuthentication(req, res, next) {
    // 在每個登入的地方加session  req.session.justLogin = true;
    const justLogin = req.session.justLogin || null;
    if ( justLogin ){
        const isLoginAction = req.path.match(/\/authentication|\/logout|\/checkJustTwoFactorAuth|\/checkLockButton/);
        if (isLoginAction) {
            return next();
        }
        const useTwoFactorAuthentication = await LoginType.findOne({
            attributes: ["use_two_factor_authentication"],
            where:{
                id: req.session.loginType
            },
        })
        //查詢此公司是否有開啟二次驗證的功能
        if (useTwoFactorAuthentication.dataValues.use_two_factor_authentication == 1){
            let rsmodel = new responseModel();
            try {
                const userInfo = req.session.userInfo;
                const uid = userInfo.uid;
                const record = await TwoFactorAuthentication.findOne({
                    where: { user_id: uid },
                });
                if (record !== null) {
                    const isEnable = record.dataValues.is_enable;
                    const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress).split(",")[0];
                    const twoFactorIp = record.dataValues.ip;
                    const userAgent = req.headers["user-agent"];
                    const deviceInfo = platform.parse(userAgent);
                    const nowDevice = `OS: ${deviceInfo.os.family}, Browser: ${deviceInfo.name}`;
                    const lastDevice = record.dataValues.last_device;
                    const now = new Date();
                    const lastAuthTime = new Date(record.dataValues.last_auth_time);
                    if (isEnable === 1) {
                        if (ip !== twoFactorIp) {
                            // 回傳二次驗證畫面
                            rsmodel.data = {
                                userInfo: userInfo,
                                twoFactorAuth: true,
                            };
                            rsmodel.code = 0;
                            rsmodel.message = "IP與上次登入不一致，需二次驗證";
                            createJustTwoFactorAuth(req, res, next)
                            return res.json(rsmodel);
                        } else {
                            // ip是上一次登入的ip
                            const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;
        
                            // 判斷上次與目前的裝置是否不同，或上次驗證時間超過 7 天
                            if (lastDevice !== nowDevice || now - lastAuthTime > sevenDaysInMillis) {
                                // 回傳二次驗證畫面
                                rsmodel.data = {
                                    userInfo: userInfo,
                                    twoFactorAuth: true,
                                };
                                rsmodel.code = 0;
                                rsmodel.message = "更換裝置、瀏覽器或超過七天沒驗證，需進行二次驗證";
                                createJustTwoFactorAuth(req, res, next)
                                return res.json(rsmodel);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("登入時二次驗證過程有問題:", err);
                res.status(500).json({ error: "登入時二次驗證過程有問題" });
                return;
            }
        }
    }
    if (req.session.justLogin){
        delete req.session.justLogin;
    }
    return next();
}

module.exports = twoFactorAuthentication;
