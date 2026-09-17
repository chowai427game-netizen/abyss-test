// ============================================================================
// browser-compat.js - GitHub Pages bootstrap diagnostics
// ============================================================================
(function (global) {
    function showBootError(message) {
        console.error(message);
        const box = document.getElementById('legacy-box');
        if (box) box.textContent = message;
    }

    function verifyGameCore() {
        const requiredFunctions = [
            'initOrLoadPlayer',
            'handleStartGame',
            'renderInitialJobModal',
            'selectInitialJob',
            'enterGameMainShell'
        ];

        const missing = requiredFunctions.filter((name) => typeof global[name] !== 'function');
        if (missing.length === 0) return;

        showBootError(`遊戲核心載入不完整：缺少 ${missing.join(', ')}，請恢復完整 game.js。`);
    }

    if (document.readyState === 'complete') {
        verifyGameCore();
    } else {
        global.addEventListener('load', verifyGameCore, { once: true });
    }
})(window);
