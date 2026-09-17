// ============================================================================
// 🧩 browser-compat.js：GitHub Pages inline-handler compatibility bridge
// ============================================================================
// Classic <script> files may define functions in the global lexical scope but
// inline HTML handlers resolve through window. Expose the public entry points
// explicitly so form/button handlers work consistently on GitHub Pages.
(function exposeBrowserApi(global) {
    const expose = (name) => {
        try {
            if (typeof global[name] !== "function" && typeof window !== "undefined" && typeof window[name] === "function") {
                global[name] = window[name];
            }
        } catch (error) {
            console.warn(`Unable to expose ${name}:`, error);
        }
    };

    // handleStartGame is required by index.html#login-form onsubmit.
    // It may already be exported by game.js in newer builds.
    if (typeof global.handleStartGame !== "function") {
        try {
            if (typeof handleStartGame === "function") {
                global.handleStartGame = handleStartGame;
            }
        } catch (error) {
            console.error("handleStartGame is not available. Check game.js loading.", error);
        }
    }

    [
        "handleStartGame",
        "clearAllLegacySaves",
        "hideMaterialAlert",
        "switchVillageLocation",
        "toggleTacticsDrawer",
        "selectTactic"
    ].forEach(expose);

    if (typeof global.handleStartGame !== "function") {
        global.handleStartGame = function handleStartGameUnavailable() {
            console.error("handleStartGame is unavailable because game.js did not load.");
            const message = document.getElementById("legacy-box");
            if (message) message.textContent = "遊戲核心未能載入，請重新整理頁面或檢查 GitHub Pages 的 JavaScript 檔案。";
        };
    }
})(window);
