(function () {
    const ensureWindowFunction = (name, factory) => {
        if (typeof window[name] !== 'function') {
            window[name] = factory;
        }
    };

    ensureWindowFunction('handleStartGame', async function handleStartGame() {
        const inputName = document.getElementById('player-name-input')?.value || '';
        const inputPin = document.getElementById('player-pin-input')?.value || '';

        if (typeof window.initOrLoadPlayer === 'function') {
            try {
                const result = await window.initOrLoadPlayer(inputName, inputPin);
                if (!result || !result.success) return;

                if (result.isNewUser && typeof window.renderInitialJobModal === 'function') {
                    window.renderInitialJobModal(false);
                    return;
                }

                if (typeof window.enterGameMainShell === 'function') {
                    window.enterGameMainShell();
                    return;
                }
            } catch (error) {
                console.error('handleStartGame bootstrap failed:', error);
            }
        }

        const legacyBox = document.getElementById('legacy-box');
        if (legacyBox) {
            legacyBox.textContent = '登入成功，但遊戲核心尚未載入：請恢復完整 game.js。';
        }
        console.error('game.js did not bootstrap required game entrypoints.');
    });

    ensureWindowFunction('renderInitialJobModal', function renderInitialJobModal(shouldReset = false) {
        const modal = document.getElementById('initial-job-modal');
        if (modal) {
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');
        }

        if (typeof window.showToast === 'function') {
            window.showToast(shouldReset ? '已重置職業選擇' : '請選擇你的初始冒險血脈', 'info');
        }
    });

    ensureWindowFunction('enterGameMainShell', function enterGameMainShell() {
        const titleBox = document.getElementById('title-box');
        const statusPanel = document.getElementById('status-panel-box');
        const villagePanel = document.getElementById('village-panel-box');
        const actionPanel = document.getElementById('action-panel-box');

        if (titleBox) titleBox.style.display = 'none';
        if (statusPanel) statusPanel.style.display = 'block';
        if (villagePanel) villagePanel.style.display = 'block';
        if (actionPanel) actionPanel.style.display = 'block';

        if (typeof window.updatePlayerStats === 'function') {
            window.updatePlayerStats();
        }

        if (typeof window.renderVillagePanel === 'function') {
            window.renderVillagePanel();
        }
    });

    ensureWindowFunction('selectInitialJob', function selectInitialJob(jobKey) {
        if (typeof window.handleInitialJobSelection === 'function') {
            return window.handleInitialJobSelection(jobKey);
        }

        if (typeof window.setPlayerJob === 'function') {
            return window.setPlayerJob(jobKey);
        }

        const modal = document.getElementById('initial-job-modal');
        if (modal) modal.style.display = 'none';

        const legacyBox = document.getElementById('legacy-box');
        if (legacyBox) {
            legacyBox.textContent = `已選擇職業: ${jobKey}`;
        }
    });

    ensureWindowFunction('closeJobAdvancementModal', function closeJobAdvancementModal() {
        const modal = document.getElementById('job-advancement-overlay');
        if (modal) modal.style.display = 'none';
    });

    ensureWindowFunction('switchVillageLocation', function switchVillageLocation(location) {
        if (typeof window.renderVillageLocation === 'function') {
            return window.renderVillageLocation(location);
        }

        document.querySelectorAll('.v-sub-loc-panel').forEach((panel) => {
            panel.style.display = 'none';
        });

        const targetId = `v-loc-${String(location).toLowerCase()}`;
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
            targetPanel.style.display = 'block';
        }
    });

    ensureWindowFunction('toggleTacticsDrawer', function toggleTacticsDrawer() {
        const panel = document.getElementById('tactics-drawer-box');
        if (!panel) return;
        panel.classList.toggle('open');
    });

    ensureWindowFunction('selectTactic', function selectTactic(tactic) {
        if (typeof window.applySelectedTactic === 'function') {
            return window.applySelectedTactic(tactic);
        }

        const buttons = document.querySelectorAll('.btn-tactic-option');
        buttons.forEach((button) => {
            button.classList.toggle('active', button.id === `tactic-btn-${tactic}`);
        });
    });

    ensureWindowFunction('hideMaterialAlert', function hideMaterialAlert() {
        const overlay = document.getElementById('mat-alert-overlay');
        if (overlay) overlay.style.display = 'none';
    });

    ensureWindowFunction('clearAllLegacySaves', function clearAllLegacySaves() {
        if (confirm('⚠️ 確定要清空本地所有快取資料嗎？')) {
            localStorage.clear();
            if (window.location) window.location.reload();
        }
    });
})();
