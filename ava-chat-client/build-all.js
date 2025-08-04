import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

// 刪除目錄的輔助函數
function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folderPath);
    }
}

// 移動目錄的輔助函數
async function moveFolder(src, dest) {
    try {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        await fs.move(src, dest, { overwrite: true });
        console.log(`Moved folder from ${src} to ${dest}`);
    } catch (error) {
        console.error(`Error moving folder from ${src} to ${dest}:`, error);
        throw error;
    }
}

// 清理先前的構建
console.log("Cleaning previous builds...");
deleteFolderRecursive("dist");

// 構建默認版本
console.log("Building default version...");
execSync("npm run build", { stdio: "inherit" });

// 將默認版本移到臨時目錄
await moveFolder("dist", "dist-default");

// 構建高雄版本
console.log("Building Kaohsiung version...");
execSync("cross-env VITE_APP_MODE=kaohsiung npm run build", { stdio: "inherit" });

// 將高雄版本移到臨時目錄
await moveFolder("dist", "dist-kaohsiung");

// 創建最終的 dist 目錄
fs.mkdirSync("dist");

// 移動構建結果到最終位置
await moveFolder("dist-default", "dist/avaClient");
await moveFolder("dist-kaohsiung", "dist/kaohsiung");

console.log("Build complete. Output is in the dist directory.");
