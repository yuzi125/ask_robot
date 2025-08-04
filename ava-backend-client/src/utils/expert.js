import { exportExpertModel } from "@/network/service";

export async function handleModelExport(exportData, updateModelType) {
    try {
        const { displayName, expertId, modelItem } = exportData;
        const status = await exportExpertModel(expertId, updateModelType, displayName, modelItem);

        let result = {
            success: false,
            skippedExperts: [],
            message: "",
        };

        if (status?.skippedExperts && status.skippedExperts.length > 0) {
            const expertNames = status.skippedExperts.join(", ");
            const successfulExperts = expertId.length - status.skippedExperts.length;

            if (successfulExperts === 0) {
                // 所有的 expert 都是重複的，沒有成功新增
                result.message = `以下專家的模型名稱已存在: ${expertNames}`;
                result.skippedExperts = status.skippedExperts;
                return result;
            } else {
                // 部分成功，部分重複
                result.message = `模型名稱已存在於以下專家: ${expertNames}。其他 ${successfulExperts} 個專家已成功新增。`;
                result.skippedExperts = status.skippedExperts;
                result.success = true;
                return result;
            }
        } else {
            // 全部成功新增
            result.message = `匯出 ${displayName} 成功`;
            result.success = true;
            return result;
        }
    } catch (error) {
        console.error("Error during export:", error);
        return {
            success: false,
            message: "匯出時發生錯誤，請稍後再試",
        };
    }
}
