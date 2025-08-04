const sql = require("../db/pgsql");
const BotMessages = require("../orm/schema/bot_messages");
const Expert = require("../orm/schema/expert");
const GroupPermission = require("../orm/schema/group_permission");
// 權限檢查相關的 utility functions

// userId 是用來找出資料庫的使用者
// userNo 是用來判斷權限 因為 permission 是設定在 userNo (職編)

const permissionUtils = {
    // 檢查特定使用者是否有權限訪問特定專家
    validateExpertPermission(expertId, userNo, permissions) {
        return (
            permissions.chatExperts &&
            permissions.chatExperts[expertId] &&
            permissions.chatExperts[expertId].includes(userNo)
        );
    },

    // 取得權限設定
    async getPermissionSettings() {
        const { rows } = await sql.query("SELECT value FROM settings WHERE key='knowledge_permission'");
        return rows[0] ? JSON.parse(rows[0].value) : null;
    },

    // 檢查專家訪問權限
    async checkExpertAccess(expertId, userNo) {
        try {
            const permissions = await this.getPermissionSettings();

            // 如果沒有權限設定，允許訪問
            if (!permissions || !permissions.chatExperts) {
                return {
                    hasAccess: true,
                };
            }

            // 如果專家不在權限列表中，允許訪問
            if (!permissions.chatExperts[expertId]) {
                return {
                    hasAccess: true,
                };
            }

            // 檢查使用者是否在權限列表中
            const hasPermission = this.validateExpertPermission(expertId, userNo, permissions);

            return {
                hasAccess: hasPermission,
                message: hasPermission ? null : "您沒有權限訪問此專家",
            };
        } catch (error) {
            console.error("Check expert access error:", error);
            throw error;
        }
    },

    async findAvailableExpert(userId, userNo, excludeExpertId = null) {
        try {
            // 找出使用者所有的對話記錄，並依照專家的 sort_order 排序
            const botMessages = await BotMessages.findAll({
                where: { users_id: userId },
                include: [
                    {
                        model: Expert,
                        required: true,
                        where: {
                            is_enable: 1,
                        },
                    },
                ],
                order: [[{ model: Expert }, "sort_order", "ASC"]],
            });

            if (!botMessages || botMessages.length === 0) {
                return null;
            }

            // 因為已經排序過了，第一個符合條件的就是 sort_order 最小的
            for (const message of botMessages) {
                if (excludeExpertId && message.expert_id === excludeExpertId) {
                    continue;
                }

                const accessCheck = await this.checkExpertAccess(message.expert_id, userNo);
                if (accessCheck.hasAccess) {
                    return {
                        botMessage: message,
                        expert: message.Expert,
                    };
                }
            }

            return null;
        } catch (error) {
            console.error("Find available expert error:", error);
            throw error;
        }
    },
    // 先定義一個函數來獲取使用者所屬的所有群組ID
    async getUserGroups(userId) {
        try {
            // 從 ORM 中獲取群組權限數據
            const groupPermissions = await GroupPermission.findAll();

            // 建立使用者所屬群組的集合
            const userGroups = new Set();

            // 遍歷所有群組，找出使用者所屬的群組
            if (groupPermissions && groupPermissions.length > 0) {
                groupPermissions.forEach((group) => {
                    const members = group.groupMember || [];

                    // 如果使用者在此群組中，將群組ID加入使用者的群組集合
                    if (Array.isArray(members) && members.includes(userId)) {
                        userGroups.add(`#${group.groupId}`);
                    }
                });
            }

            return userGroups;
        } catch (error) {
            console.error("Error fetching user groups", error);
            return new Set();
        }
    },

    // 修改後的專家權限驗證函數
    async validateExpertPermission(expertId, userId, permissions) {
        // 檢查直接使用者權限
        const hasDirectPermission =
            permissions.chatExperts &&
            permissions.chatExperts[expertId] &&
            Array.isArray(permissions.chatExperts[expertId]) &&
            permissions.chatExperts[expertId].includes(userId);

        if (hasDirectPermission) {
            return true;
        }

        // 檢查群組權限
        const userGroups = await this.getUserGroups(userId);

        // 如果使用者沒有加入任何群組，直接返回 false
        if (userGroups.size === 0) {
            return false;
        }

        // 檢查專家權限中是否有使用者所屬的任何群組
        return (
            permissions.chatExperts &&
            permissions.chatExperts[expertId] &&
            Array.isArray(permissions.chatExperts[expertId]) &&
            permissions.chatExperts[expertId].some(
                (permission) => permission.startsWith("#") && userGroups.has(permission)
            )
        );
    },

    // 修改後的專家過濾函數
    async filterChatExpertsByPermission(experts, userNo, permissions) {
        // 獲取使用者所屬群組 - 只需取一次，用於所有專家的權限檢查
        const userGroups = await this.getUserGroups(userNo);

        // 過濾專家列表
        return experts.filter((expert) => {
            // 如果專家ID不在權限列表中，保留該專家
            if (!permissions.chatExperts || !permissions.chatExperts[expert.expertId]) {
                return true;
            }

            // 檢查直接使用者權限
            const hasDirectPermission =
                Array.isArray(permissions.chatExperts[expert.expertId]) &&
                permissions.chatExperts[expert.expertId].includes(userNo);

            if (hasDirectPermission) {
                return true;
            }

            // 檢查群組權限
            return (
                Array.isArray(permissions.chatExperts[expert.expertId]) &&
                permissions.chatExperts[expert.expertId].some(
                    (permission) => permission.startsWith("#") && userGroups.has(permission)
                )
            );
        });
    },
};

module.exports = permissionUtils;
