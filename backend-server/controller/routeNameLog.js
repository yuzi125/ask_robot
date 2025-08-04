function logRouteDetails(functionName, req, shouldLog = true) {
    if (!shouldLog) return;

    try {
        if (req.session && req.session.userInfo && req.session.userInfo.user_no && req.session.userInfo.nickname) {
            console.info(`${functionName} ${req.session.userInfo.user_no} ${req.session.userInfo.nickname}`);
        } else {
            console.info(`${functionName}`);
        }
    } catch (err) {
        console.error(err);
    }
}

module.exports = logRouteDetails;
