import { computed } from "vue";
import { usePermissionStore } from "@/store/index";

import { storeToRefs } from "pinia";

export function usePermissionChecker(permissionType) {
    const permissionStore = usePermissionStore();
    const { actionPermissions } = storeToRefs(permissionStore);

    const canPerformAction = computed(() => {
        if (!actionPermissions.value) {
            return false;
        }

        return actionPermissions.value[permissionType] || false;
    });

    return {
        canPerformAction,
    };
}
