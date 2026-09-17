// ============================================================================
// browser-compat.js - GitHub Pages bootstrap and diagnostics
// ============================================================================
(function (global) {
    function showBootError(message) {
        console.error(message);
        const box = document.getElementById('legacy-box');
        if (box) box.textContent = message;
    }

    function exposeGlobal(name) {
        try {
            if (typeof global[name] !== 'function' && typeof window !== 'undefined' && typeof window[name] === 'function') {
                global[name] = window[name];
            }
        } catch (error) {
            console.warn(`Unable to expose ${name}:`, error);
        }
    }

    // Preserve inline HTML callbacks on GitHub Pages even if the game script
    // is still being parsed or is temporarily unavailable during bootstrap.
    const publicApi = [
        'handleStartGame',
        'clearAllLegacySaves',
        'hideMaterialAlert',
        'switchVillageLocation',
        'toggleTacticsDrawer',
        'selectTactic',
        'closeJobAdvancementModal'
    ];

    publicApi.forEach(exposeGlobal);

    if (typeof global.handleStartGame !== 'function') {
        global.handleStartGame = async function handleStartGame() {
            if (typeof global.initOrLoadPlayer !== 'function') {
                showBootError('遊戲核心載入失敗：game.js 無法執行，請恢復完整 game.js 後再試。');
                return;
            }

            const name = document.getElementById('player-name-input')?.value || '';
            const pin = document.getElementById('player-pin-input')?.value || '';

            try {
                const result = await global.initOrLoadPlayer(name, pin);
                if (!result || !result.success) return;

                if (result.isNewUser && typeof global.renderInitialJobModal === 'function') {
                    global.renderInitialJobModal(false);
                } else if (typeof global.enterGameMainShell === 'function') {
                    global.enterGameMainShell();
                } else {
                    showBootError('登入成功，但遊戲核心尚未載入：請恢復完整 game.js。');
                }
            } catch (error) {
                console.error('Game bootstrap failed:', error);
                showBootError('遊戲核心啟動失敗，請查看 Console 並恢復完整 game.js。');
            }
        };
    }

    global.addEventListener('DOMContentLoaded', function () {
        const form = document.getElementById('login-form');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (typeof global.handleStartGame === 'function') {
                global.handleStartGame();
            } else {
                showBootError('遊戲核心載入失敗：handleStartGame 不存在，請恢復完整 game.js。');
            }
        });
    });
})(window);
