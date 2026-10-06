# 第二輪 VFX：實作／QA／使用者過目

本 PR 僅處理路線圖 #3–#9，保留第一輪報告 `scripts/vfx-refactor-qa.md` 作歷史記錄。**不合併、不部署；等待使用者過目。** 起始 checkout `76c4badd`，既有功能基線來自 `6bfef005`；本輪修改前重新執行 baseline 與 VFX tests，兩者 **PASS**，不是沿用上輪結果。

## 先調查 → 分流 → 實作

以下係**模擬評審角度**，唔係十位真人、十個獨立代理或已完成玩家 playtest。

| 玩家視角 | 原碼調查／本輪驗收 |
|---|---|
| 成就者 | 原治療文字使用請求量而非 clamp 後增量；驗收真實 HP／MP、shield、傷害數字，並比較實際遊戲函式的 state／RNG draws，唔改獎勵或經濟。 |
| 探索者 | 檢查清場、Boss callback、hidden 拒絕及重入；補 follow／snapshot、失去錨點與視窗改變邊界。 |
| 社交者／領袖 | 原文字附在可被 eviction 的裝飾節點；驗收獨立結果 lanes、文字／形狀辨識、鍵盤設定及窄版。今輪唔涉及多人系統。 |
| 競爭者 | 原 projectile helper 喺命中判定前生成 `.vfx-hit`，MISS 亦有成功爆光；改 cast tracer，confirmed hit 仍由 combat 決定，×6 不等於播六個爆光。 |

**QA＋遊戲設計 triage：** 只修呈現真確性及安全邊界；保持命中、暴擊、逐次 damage／shield loop、治療 state assignment、AI 條件及回合速度原樣。前端實作 renderer／消費端；UI/UX 與 VFX/2D 美術檢查 labels、增強形狀及 legacy；後端、帳號、存檔 schema、資料庫明確不在範圍。

## 功能範圍與刻意差異

| # | 實作 | 狀態 |
|---|---|---|
| 3 | 不可變 effect registry 集中 color／shape／duration／particles／priority；技能可提供 `vfx: { element: "ice" }`，既有名稱／職業 fallback 保留，未大批遷移技能資料。 | 已實作，測試結果見下 |
| 4 | `triggerProjectileFX` 播 cast tracer，不再冒充 hit；combat 成功分支才播 hit／crit；聚合結果以 `resolvedCount` 顯示實際 ×N。 | 已實作 |
| 5 | 單一結果文字獨立於裝飾，固定有界 lanes／queue；HP、MP、SHIELD、HIT、CRIT、MISS 字樣及邊框，不只靠顏色；現有 VFX 治療消費端與日誌顯示實際 clamp 後 delta。 | 已實作 |
| 6 | `positionMode: "snapshot"`（預設）／`"follow"`；explicit x/y 優先。Follow 使用單一有界 updater、每 anchor 共用讀取；隱藏／消失凍結最後有效位置；死亡在 UI 改變前取 snapshot。 | 已實作 |
| 7 | 可選 enhanced 斬弧、火爆散、冰晶、雷折線、回復上升、護盾環；沿用 DOM／CSS，無全畫面 flash／shake、無 remote asset。 | 已實作，legacy 預設 |
| 8 | header 小型摺疊「特效設定」：low／standard／high、獨立額外減少動態；系統 reduce 優先。namespaced localStorage，無帳號傳送；preview 使用記憶體，不讀寫玩家偏好。 | 已實作 |
| 9 | active 裝飾／particles／pending spawns／external callbacks／active labels／queued labels 硬上限、priority admission／eviction、evicted cleanup timer 取消、bounded diagnostics；不使用 pooling／Canvas／WebGL。 | 已實作，量度見下 |

**保持預設：** legacy + standard；正常 24 active decorations、4 burst、每 node 最多 6 particles、55ms 間隔；reduce 12 decorations、2 burst、0 particles；既有公開 helpers、classic loading 及 explicit x/y fallback 保留。`spawnVfx` 仍以 null 表示 no-op、true 表示已接受呈現工作；不代表命中或傷害成功。

| quality | active 裝飾硬上限 | 全局 particles | burst／每 node particles |
|---|---:|---:|---:|
| low | 12 | 24 | 2／3 |
| standard | 24 | 96 | 4／6 |
| high | 32 | 128 | 4／6 |
| 任一 quality + reduce | 最多 12 | 0 | 2／0 |

所有 profile 共用：最多 48 queued decoration spawns、32 external VFX callbacks、12 active labels（每 anchor 最多 4 lanes）、36 queued labels。數值 options 不能提高上限；diagnostics 只保留固定數量的 counters，唔存無限事件歷史。visibility／motion／resize 各固定一個 module-lifetime listener，唔會逐次 spawn 註冊；clear 後集合清空，不保留舊場景節點。follow updater 只喺有 active followers 時運行，clear／到期／eviction 會取消。零 active 且無位置可放時，用單一 500ms retry，最多四次／2 秒後丟棄，唔會擱置永久 backlog；正常 lane 滿額則等現有 label 到期再播放有界 queue。

**刻意呈現改變：** 施放由爆光改 tracer（包括 MISS 前的 cast）；文字不再重複印在每個 burst／被 decoration eviction 刪去；labels 顯示種類及 ×N；所有既有 VFX heal 路徑的 labels／logs 改實際增量（滿血／滿魔顯示 +0，不改補量）。物品「未知物體」的最低 1 HP clamp 同樣只修顯示 delta。死亡 snapshot 共用安全定位 helper。新的硬預算可能捨棄裝飾／飽和 labels，現有 HP／MP UI 及 combat log 仍為權威保底；沒有新增 accessibility live region。

新增型別需加入 registry；未知效果型別現在拒絕，已審查正式呼叫端全部為支援型別。設定變更會清除在播及排程中的 VFX，避免舊 quality／motion backlog；唔會改遊戲 state。

### 戰鬥路徑 characterization

- 普通攻擊／魔物攻擊：原 `calculateDamage` 決定 MISS／crit，原 shield／HP application 結算，再建立結果。MISS 不扣血，亦不建立 confirmed-hit decoration。
- 一般技能：原本先施放，再作一次傷害判定；成功後按 `hitCount` 原 loop 逐次套用 shield／HP，顯示合計與 ×N。沒有提高視覺 cap 或補做額外傷害。
- OFFENSIVE AI 技能分支原本只有一次 damage application，沒有一般技能的 multi-hit loop；本輪照舊，不將技能 metadata／視覺 count 當成額外傷害指令。
- 治療／護盾技能的既有施放呼叫改 tracer；治療、盾量由原 state 邏輯決定。劇毒／燃燒等原 log-only 路徑維持 log-only，沒有借此擴大戰鬥修改。

**RNG 限制：** VFX 使用私有 presentation RNG，唔再抽取 global `Math.random`。控制測試比較本輪各 profile／停用 renderer 的相同 gameplay draws／結果，另在兩版本皆停用 rendering 時比較舊／新 game 函式；移除舊 renderer 隨機抽取會改歷史 interleaving，**不宣稱與舊版本開啟 VFX 的全局 random sequence 或整局結果完全相同**。沒有改 gameplay RNG implementation。

## 改動檔案

- `vfx.js`、`css/04-components.css`：registry、rendering、labels、定位、設定及 hard budgets。
- `game.js`：metadata 消費、resolvedCount、實際治療／物品傷害文字、死亡 snapshot；state／damage assignment 保留。
- `index.html`、`ui.js`：小型本機畫面設定及 binding，startup／login ownership 不變。
- `scripts/test-vfx.js`：擴充原零依賴 harness；保留第一輪 lifecycle／scene tests，只更新上述刻意 text／cast 呈現 characterization。
- `scripts/vfx-preview.html`：隔離預覽、比較／控制／壓力與 diagnostics。
- 本報告；第一輪歷史、legacy styles／data／state／statengine／backend 未修改。

## 實際驗證

以下係本輪重新執行的證據；未完成項目不當 PASS。VM fixture 的 DOM、UI、save／interval 及技能輸入有 stub，但實際 `game.js` action 函式、`statengine.js` 的傷害計算及 `applyDamageWithShield` 均有執行，不是以 mocked action 冒充 gameplay。

| 檢查 | 結果 |
|---|---|
| 修改前 `node scripts/check-refactor-baseline.js` | **PASS** |
| 修改前 `node scripts/test-vfx.js` | **PASS** |
| 修改後 `node scripts/check-refactor-baseline.js` | **PASS** |
| `node scripts/test-vfx.js` | **PASS**：32 actual-action 情境 × 11 rendering configs（352 runs）；另 32 對原 `6bfef005:game.js`／本輪函式比較，停用 rendering 時 state、RNG draws 及 ordered damage applications 相同 |
| registry／metadata fallback／cast／MISS／crit／shield／×6 | **PASS**；兩條六連擊路徑實際轉發並驗證六次原 damage application，唔以動畫 count 代替 |
| 每個既有 VFX healing site、+0 HP／MP、rest 兩分支／sanctum／AI／item、死亡 snapshot | **PASS**：實際函式 delta／logs／state 比較；原 clamp assignment 不變 |
| labels、queues、priorities、evicted timers、invalid options、motion runtime／storage failures、定位及 retry | **PASS**：含 10×10 無可用位置，1,999ms 仍有界、2,000ms 丟棄歸零；resize／clear 取消 retry |
| startup APIs／load order、第一輪 lifecycle／hidden／fresh scene／Boss victory integration | **PASS**；沒有刪去原 lifecycle／scene assertions |
| `node --check vfx.js`、`game.js`、`ui.js`、`scripts/test-vfx.js`；preview inline scripts compile；`git diff --check`（含 staged） | **PASS** |
| 桌面／375px 隔離 Chromium preview、profile／quality／motion／scroll／resize／clear-reentry | **PASS**：36 組 matrix、4 組定位、20 次 lifecycle；最後長文字／CJK refresh 見下 |
| read-only code review | **PASS**：兩項有效回歸已修正，最終無剩餘 high-confidence finding |
| 提交後 CodeQL security scan | **PASS**：JavaScript 0 alerts |
| 提交前 secret scan（全部 11 個新增／修改檔案，含截圖） | **PASS**：沒有 secrets |
| `parallel_validation` 自動 code-review 子工具 | **NOT RUN**：設定的 `claude-sonnet-4.6` model 不在 registry；工具標頭雖顯示 Success，內文實際表示 unavailable，不能當自動審查 PASS。上述獨立 read-only review 已完成，但不冒充該工具成功 |
| physical mobile、完整 authenticated gameplay、真實背景分頁／省電 throttling、玩家主觀易讀性 | **NOT RUN** |
| 實際 GPU／FPS／長時間遊戲效能 | **NOT RUN**；harness／預覽 workload 不等於遊戲 FPS |

近期 Actions 已完成 runs 為 success；`37282236399` 查詢詳細 failed-job logs 回覆 0 failed jobs，本次 cloud-agent run 起初仍執行中。未觸發部署工作流，亦不以歷史 CI 成功取代本輪測試。

### 回歸分流

- 修改前 baseline／VFX suite 沒有已知 FAIL。
- 本輪審查找到 **introduced regression**：正式頁面後載入 `css/11-accessibility.css` 的全域 `0.01ms !important` 動畫規則，會讓新結果文字在系統 reduce 下立即消失。已針對 result 加 readable duration override，並將同一 accessibility CSS 加入隔離 preview；24 組 reduce browser cases 量度 192 labels，computed duration 0.5s、非零 opacity、無 overlap／clipping。
- 最後靜態複核找到長文字 `width:auto` 隨 left 改變的 shrink-to-fit 問題，會令量度 cache 失準；已加 `width:max-content`、原 max-width 及 border-box 保留。最後 focused suite 的長文字 8／92 邊界及 repeated resize regression **PASS**，read-only reviewer 確認 finding 已解決。
- 實體裝置、完整登入實戰、背景 throttling 及主觀閱讀仍係 **untested risk**，唔以自動化結果掩蓋。

### 量度與截圖

**CLI workload（最後 width 修正後一次記錄）：** Node **22.23.3**、Linux/x64、AMD EPYC 9V45；fake DOM／virtual timers，400 個同步 `spawnVfx` requests × count 4 × 6 particles、duration 1400ms、三個 anchors，正常 standard，輸入工作量相同。原 `6bfef005:vfx.js` 與本輪 legacy／enhanced 在同一 harness 比較：

| renderer | elapsed（ms） | peak decorations + labels | peak particles | peak timers | global Math.random draws |
|---|---:|---:|---:|---:|---:|
| 第一輪 | 139.87 | 24 + 0 | 144 | 1600 | 3200 |
| 第二輪 legacy | 13.48 | 24 + 12 | 96 | 60 | 0 |
| 第二輪 enhanced | 8.50 | 24 + 12 | 96 | 60 | 0 |

這是 scheduler／fake DOM 的單次 diagnostic，不是 renderer painting、GPU 或 FPS benchmark；時間受主機及 harness 排程演算法影響，無 timing gate。新硬預算實際減少要處理的工作，**不是相同顯示粒子量的繪製速度比較**，不能宣傳為遊戲倍速提升。主要可驗證收益係 timers／particles／queues 的上限；沒有以此引入 pooling 或新 renderer。

Browser 使用 Linux headless **Chromium 154**，1280×900／375×812、DPR 1。36 組 = 2 viewports × 2 styles × 3 qualities × normal／user-reduce／system-reduce。零 runtime exceptions、Storage calls／水平 overflow；snapshot／follow、scroll／resize、移除凍結／還原與重入已執行。Production settings 的獨立 inert CSS fixture 亦測 wrap／2px keyboard focus（不是 authenticated game UI）。最後使用實際中文字型再測 24 組 corner cases（x/y 8／92、長中文文字、同位置跨 anchors）；四 lanes／八同位置 labels 均無 overlap／clipping。另 12 個不 respawn 的 label resize flows／48 stages，desktop→narrow→short→restore 均 PASS：短視窗四 active／四 queued，還原後八 active／零 queued；清除後零 timers。375×200 無足夠位置 probe 依然有界；薄 cast 桌面 58×5px／窄版 28×5px。

截圖只係隔離 preview，唔係實戰。相同五筆合成結果：fire HIT −24、ice CRIT −48、HP +32、MP +12、shield −8，各 duration 1400ms、3 particles，約 70ms 時捕捉，normal motion／standard。原版 renderer 來自 `6bfef005`：

- [第一輪 renderer](vfx-round2-before.png)
- [第二輪 legacy（預設）](vfx-round2-legacy.png)
- [第二輪 enhanced（可選）](vfx-round2-enhanced.png)

初次環境沒有 CJK 字型，截圖中文字為方框，不能當中文易讀性 PASS。已安裝 **environment-only** Noto CJK 字型（不加入 production dependencies），Chromium 平台字型證據確認 **Noto Sans CJK TC** 真實 glyph，244 個頁面中文字元均有 glyph。三張提交截圖於 **2026-10-06 03:43:27–31Z** 重新捕捉，不保留方框版作最後證據。玩家主觀閱讀與實體手機仍需使用者過目。

最後驗證 production hashes：`vfx.js` SHA-256 `e2b2358c33e534c1a3e1543db190f884eeca9e93970e82726347995846b56318`；components CSS `fab42f47d8081095a206d0fed29f1597e6663bc1dcae65b313b9ad79b5efd9e7`。沒有 production lint/build 工具或依賴遷移；原兩個 Node scripts 與現有 Chromium 用於驗證。臨時 browser profiles／中間資料已清理，只提交三張指定 PNG。

## 匿名交叉評議／決策

- **評議 A（數值／競爭）最強：** delta 與 ×N 都從已結算 combat state 取得。盲點：測試 state／controlled RNG 不能證明完整 authenticated 遊戲每條技能分支。
- **評議 B（探索／前端）最強：** clear generation、hidden rejection 與 callback cancellation 保留，並對 active／queue／particles 全局限流。盲點：fake DOM 不反映真實 layout／背景 timer throttling。
- **評議 C（UI/UX／美術）最強：** legacy 為預設，enhanced 可選；文字與形狀共同辨識。盲點：自動 browser geometry checks 唔等於玩家主觀過目或實體手機。
- **評議 D（QA／行銷）最強：** 預覽完全隔離登入／存檔，展示可重現工作負載與 diagnostics。盲點：不能將 preview screenshot／VM 計時宣稱為完整遊戲 performance 改善。

**最終決定：** 先交付使用者審閱，未執行項目明確保留；有視覺／實戰異常先修正及複測，唔直接合併／發佈。

## 使用者過目／回退

1. 用靜態 server 開 `scripts/vfx-preview.html`（例如 repo root 執行 `python3 -m http.server 8000 --bind 127.0.0.1`，開 `http://127.0.0.1:8000/scripts/vfx-preview.html`），預設先睇 legacy／standard，再切 enhanced。同一組 hit／crit／MISS／cast、HP／MP／shield 與 ×6 比較。
2. 切全部 quality 及額外 reduce，另在 OS／browser 啟用系統 reduce 確認不能被 high 解除；點 stress 睇 budgets／dropped，清除後計時器／queue 歸零。
3. 試 follow／snapshot、scroll、resize／橫直向、移除／還原錨點；快速 teardown／重入，確認舊 callback 不復活。
4. 遊戲登入後在 header 設定，再手動比較普通攻擊、各技能、滿血／差少量 HP／MP、吸收、MISS、crit、六連擊；確認 log／血條與 labels 一致。Boss 勝利視覺保留至真正離場；撤退／戰敗／hidden 清理。
5. 記錄裝置、viewport、系統動態偏好及重現步驟。這些係待使用者執行的步驟，唔係已做的 playtest。

未合併可要求修改／關閉 PR。若將來合併後需回退，revert 整組本輪 commits（含 game／UI／renderer／CSS），唔只刪單一模組。可移除本機 `abyss.vfx.preferences.v1` 重置畫面偏好；不需要改帳號／玩家存檔。
