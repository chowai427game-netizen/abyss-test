# 命運深淵：血脈傳承

這是以 GitHub Pages 發佈的文字地下城打寶遊戲，採用原生 HTML、CSS 與 classic JavaScript，全域資料和遊戲模組依固定順序載入；不使用 bundler 或 npm build。

## 目錄

| 路徑 | 用途 |
|---|---|
| `index.html` | GitHub Pages 遊戲入口，必須留在倉庫根目錄。 |
| `css/` | 基礎樣式、設計 token、元件、響應式與無障礙樣式。 |
| `data/` | 全域遊戲資料庫與資料 schema。 |
| `js/` | VFX、屬性計算、存檔狀態、UI、地下城與瀏覽器相容程式。 |
| `js/legacy/` | 未接入正式入口的舊 bootstrap 備份；不由 `index.html` 載入。 |
| `scripts/` | 零依賴 Node 測試、靜態檢查、QA 預覽頁及歷史 QA 紀錄。 |

## 載入順序

`index.html` 以相對路徑載入 CSS 與腳本，避免 GitHub Pages 的 `/abyss-test/` 子路徑失效。遊戲資料檔先載入，接著載入 `data/data-schema.js`、`js/vfx.js`、`js/statengine.js`、`js/state.js`、`js/ui.js`、`js/game.js`，最後是 `js/browser-compat.js`。這些都是 classic scripts，順序不可隨意調換；標記 `defer` 可在保留順序的同時等待 HTML 完成解析。Socket.IO CDN 也排在 UI 初始化前。

## 本機檢查

需要 Node.js；測試僅使用 Node 內建模組，無需安裝 npm 套件：

```bash
node scripts/check-refactor-baseline.js
node scripts/test-critical-flows.js
node scripts/test-vfx.js
find . -maxdepth 3 -type f -name '*.js' -not -path './.git/*' -print0 | sort -z | xargs -0 -n1 node --check
```

`node scripts/test-vfx.js` 也會執行基線檢查，並涵蓋戰術策略選擇、MP 保留規則、共用技能效果與戰鬥暫停／恢復計時器。可用 `python3 -m http.server 4173` 以瀏覽器開啟 `http://127.0.0.1:4173/abyss-test/index.html`（從倉庫上一層啟動服務時），或直接以 HTTPS 檢查部署頁。只測開機時，不要輸入真實帳號 PIN、清除存檔或執行會推進進度的遊戲操作。
