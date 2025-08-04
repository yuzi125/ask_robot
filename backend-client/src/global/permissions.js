const Permissions = {
    chkICSC: function (authId) {
        const user_no = ["IT0193", "I30412", "icsc-admin", "I30420", "I20496", "I14249"];
        if (user_no.includes(authId)) {
            return true;
        } else {
            return false;
        }
    },
    chkGOOGLE: function (authId) {
    },
};
export default Permissions;
