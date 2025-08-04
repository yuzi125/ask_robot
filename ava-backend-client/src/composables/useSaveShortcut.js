import { onMounted, onUnmounted } from "vue";

function useSaveShortcut(saveCallback) {
    const handleKeydown = (event) => {
        if (event.ctrlKey && event.key === "s") {
            event.preventDefault();
            console.log("save");
            saveCallback();
        }
    };

    onMounted(() => {
        window.addEventListener("keydown", handleKeydown);
    });

    onUnmounted(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
}

export default useSaveShortcut;
