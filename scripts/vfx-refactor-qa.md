# 第一輪安全 VFX 重構：QA／過目摘要

## 修改範圍

- `vfx.js`：抽出既有 VFX helper、效果建立及投射物 helper；加入 tracked timeout、場景世代及 visibility 防護。
- `game.js`：將 Boss 登場的零延遲 callback 改由 VFX scheduler 管理；在推進離場、重跑、撤退及戰敗時清除舊場景 VFX。
- `index.html`：於 UI／遊戲腳本前載入 `vfx.js`。
- `scripts/check-refactor-baseline.js`：保留原檢查並驗證 VFX 載入順序和 `window.spawnVfx`。
- `scripts/test-vfx.js`：新增零依賴的 DOM／timer characterization、lifecycle 及實際場景函式測試。
- `scripts/vfx-preview.html`：獨立、手動開啟的特效預覽頁，只使用正式 VFX 模組及 CSS。

`css/04-components.css` 沒有修改。既有 hit／crit／heal／shield／MISS／Boss 外觀、錨點、文字、55ms burst 間隔、粒子和 active cap 沿用；`triggerProjectileFX` 最多 6 次、`spawnVfx` 最多建立 4 個的既有差異亦保留。未做元素重設、數值／戰鬥調整、Canvas、pooling、依賴遷移或後端修改。

## 玩家視角 → QA／設計分流

以下是依照代碼與測試結果整理的**模擬評審角度**，不是十位真人、獨立代理或實際玩家測試。

- **成就者：** VFX 不參與傷害、治療或獎勵計算；場景轉換測試確認推進時玩家及帳號資料未被改動。戰鬥 RNG／整局結果等價不作無根據保證。
- **探索者：** 優先檢查連發中途清場、零延遲 Boss callback、斷線／不存在的 layer、隱藏分頁和新場景重新播放。
- **社交者／領袖：** 保留原 CSS 和資訊文字；預覽頁不載入登入、玩家狀態或存檔程式。實際遊戲易讀性仍需使用者過目。
- **競爭者：** 不改命中結果、暴擊、MISS、傷害顯示或連發 cap；視覺的既有連發差異維持不變。

**QA＋遊戲設計 triage：** 這是生命週期 bug 及安全抽取，不是戰鬥重新平衡。接受模組化與場景清理；Boss 擊敗效果保留至玩家真正離開勝利場景，戰敗清理則立即生效。

## 匿名交叉評議摘要

- **評議 A** 最強觀點：世代標記加計時器取消，能同時封住已排程 burst、效果移除及外部延遲 callback。盲點：單元 harness 不等於真人實戰。
- **評議 B** 最強觀點：保留原 CSS、呼叫參數及 legacy helper，限制視覺風險。盲點：程式層特徵測試無法取代玩家主觀比較。
- **評議 C** 最強觀點：實際執行轉場函式並測 Boss 登場 callback，比只測 scheduler 更有保障。盲點：測試中的 UI／ticker 依賴使用 stub。
- **評議 D** 最強觀點：hidden 時拒絕新 VFX，回到可見頁面後新效果仍可用。盲點：實體手機、瀏覽器效能及分頁切換手動測試未執行。

**最終決定：** 僅交付第一輪 #10 基線／預覽、#1 抽取、#2 生命週期修正。前端負責程式及整合；UI／UX 與特效／2D 美術以 CSS／類名及預覽保護既有表現；QA 負責回歸；遊戲設計確認戰鬥範圍不變；後端確認沒有服務端或資料庫工作。這些是責任視角，不代表另有真人審核。

## 執行結果

| 檢查 | 結果 |
|---|---|
| 修改前基線：`node scripts/check-refactor-baseline.js` | **PASS**（修改前） |
| `node scripts/check-refactor-baseline.js` | **PASS** |
| `node scripts/test-vfx.js` | **PASS**：legacy 特徵、定位／fallback、效果數量／時間／cap、reduced motion、清場、hidden／visible、Boss entry／defeat 和遊戲場景轉換 |
| `node --check vfx.js && node --check game.js && node --check scripts/test-vfx.js` | **PASS** |
| `git diff --check` | **PASS** |
| Chromium headless 預覽 | **PASS**：預覽可渲染；375×812 窄版 smoke 的普通／reduced-motion 結果分別為 `pass-normal`、`pass-reduced` |
| 遊戲完整登入／實戰、手機實機、真實分頁切換與效能量度 | **NOT RUN** |
| GitHub Actions | 檢查近期執行：既有已完成 runs 沒有失敗；本次 Copilot run 當時仍在執行，沒有可供判讀的失敗 build/test log。這不是本地回歸測試的替代品。 |

場景整合測試直接呼叫遊戲的轉場／勝利／戰敗函式，但 DOM、UI、interval、save 及部分遊戲依賴使用測試 stub；不宣稱完成完整遊戲 playtest。瀏覽器預覽截圖只檢查預覽頁版面，不是遊戲戰鬥截圖。

## 使用者手動過目步驟

1. 在瀏覽器開啟 `scripts/vfx-preview.html`，依次查看命中、暴擊、HP／MP 治療、護盾、MISS、投射物連發、Boss 登場／擊敗；測試清除按鈕、窄版及系統 reduced-motion。
2. 遊戲中測普通命中、暴擊、回復、護盾、MISS 和連發；比較原本效果大小、顏色、錨點及文字。
3. Boss 登場零延遲時立即推進／撤退；快速撤退重入；戰敗返回村莊；隱藏分頁期間觸發效果再切回。確認舊場景不復活，Boss 擊敗效果在勝利 UI 尚未離場時仍顯示。
4. 如任何舊效果有視覺回歸，先暫停合併並記錄裝置、viewport、系統動態偏好及重現步驟。

## 回退方式

此變更待使用者審閱，沒有合併或部署。若 PR 尚未合併，關閉／要求修改即可；若日後已合併，revert 整個 PR 對應提交。不要只刪除 `vfx.js`，因為 `index.html` 與遊戲轉場目前依賴它。
