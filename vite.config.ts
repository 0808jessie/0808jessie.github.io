import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// 這是標準的 Vite 設定，完美支援 GitHub Pages 靜態部署
export default defineConfig({
  base: "./", // 確保打包後的路徑為相對路徑，防止白畫面
  plugins: [
    react(),
    tsconfigPaths(), // 支援專案中的 @/ 路徑別名
  ],
  build: {
    outDir: "dist", // 確保打包產出的資料夾名稱為 dist
  },
});
