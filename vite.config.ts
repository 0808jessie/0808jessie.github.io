import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// 使用標準的 Vite 設定，這樣才能完美支援 base 路徑與 GitHub Pages 部署
export default defineConfig({
  base: "./", // 確保打包後的路徑為相對路徑，徹底解決白畫面問題
  plugins: [
    react(),
    tsconfigPaths(), // 確保支援專案中的 @/ 路徑別名
  ],
  build: {
    outDir: "dist", // 打包產出的資料夾名稱
  },
});
