// ============================================================================
// browser-compat.js - safe bootstrap for GitHub Pages
// ============================================================================
(function (global) {
    const uiMessage = "遊戲核心尚未載入，請重新整理頁面或恢復完整 game.js。";

    function showBootMessage(message) {
        console.error(message);
        const legacyBox = document.getElementById('legacy-box');
        if (legacyBox) legacyBox.textContent = message;
    }

    function ensureFallbacks() {
        if (typeof global.handleStartGame !== 'function') {
            global.handleStartGame = function handleStartGameFallback() {
                showBootMessage('handleStartGame is unavailable because game.js did not load.');
            };
        }

        const safeNames = [
            'clearAllLegacySaves',
            'hideMaterialAlert',
            'switchVillageLocation',
            'toggleTacticsDrawer',
            'selectTactic',
            'closeJobAdvancementModal'
        ];

        safeNames.forEach((name) => {
            if (typeof global[name] !== 'function') {
                global[name] = function fallbackNoop() {
                    console.warn(`${name} is unavailable because the core game script did not load.`);
                };
            }
        });
    }

    ensureFallbacks();

    global.addEventListener('DOMContentLoaded', function () {
        const form = document.getElementById('login-form');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            if (typeof global.handleStartGame === 'function') {
                global.handleStartGame();
                return;
            }

            showBootMessage(uiMessage);
        });
    });
})(window);
