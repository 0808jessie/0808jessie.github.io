import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// 這是標準的 Vite 設定，完美支援 GitHub Pages 靜態編譯
export default defineConfig({
  base: "./", // 確保打包後的資源路徑為相對路徑，防止網頁白畫面
  plugins: [
    react(),
    tsconfigPaths(), // 支援專案中的 @/ 路徑別名
  ],
  build: {
    outDir: "docs", // GitHub Pages 直接使用 docs 目錄
    emptyOutDir: true,
  },
});
