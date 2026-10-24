// ==========================================================================
// 📺 ui.js：介面控制、選單渲染與數據同步核心 (UI/UX Hyper-Polished Master Edition v4.8 Mobile RWD Standard)
// ==========================================================================

// 🌐 1. 全域狀態變數宣告
let currentOnlineCount = 1; 
const MAX_CHAT_LOGS = 25;
let localChatHistory = [];
const BLACK_MARKET_REFRESH_MS = 4 * 60 * 60 * 1000; // 4 小時
let loginLoadingInterval = null;
let autoSelectBlessingTimer = null; // 自動戰鬥代選定時器

// 🛡️ XSS 資安防禦：HTML 特殊字元轉義函式
function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 📡 Socket.io 即時連線初始化
const SOCKET_TARGET_URL = (typeof SERVER_URL !== "undefined") ? SERVER_URL : "https://rpg-backend-fjvg.onrender.com";
const socket = (typeof io !== "undefined") ? io(SOCKET_TARGET_URL) : null;

if (socket) {
    socket.on("update_online_count", (count) => {
        currentOnlineCount = count;
        const countEl = document.getElementById('square-online-count');
        if (countEl) countEl.innerText = count;
    });

    socket.on("init_chat_history", (historyList) => {
        if (Array.isArray(historyList)) {
            localChatHistory = historyList.slice(-MAX_CHAT_LOGS);
            renderSquareChatBox();
        }
    });

    socket.on("receive_square_chat", (data) => {
        if (data && data.name && data.msg) {
            receiveSquareChatMessage(data.name, data.msg);
        }
    });
}

// 🗄️ DOM 快取管理器
const DOM = {
    isInitialized: false,
    elements: {},
    init() {
        if (this.isInitialized) return;
        const keys = [
            'p-name', 'p-job', 'p-lv', 'p-exp-text', 'p-hp', 'p-maxhp', 'p-mp', 'p-maxmp',
            'hp-bar-fill', 'hp-bar-ghost', 'mp-bar-fill', 'p-atb-row', 'p-atb-text', 'p-atb-bar-fill',
            'p-gold', 'p-atk', 'p-block', 'p-crit', 'p-spd', 'p-dodge', 'p-vamp',
            'p-skills-list', 'p-stat-points', 'p-equip-weapon', 'p-equip-armor', 'p-equip-accessory',
            'slot-weapon', 'slot-armor', 'slot-accessory',
            'btn-main-action', 'btn-rerun-action', 'btn-secondary-action', 'btn-auto-battle',
            'env-alert-bar', 'monster-status-card', 'battle-scene-box', 'battle-player-name', 'battle-player-hp-text', 'battle-player-hp-bar',
            'battle-player-mp-text', 'battle-player-mp-bar', 'battle-player-atb-text', 'battle-player-atb-bar',
            'battle-skill-cooldowns',
            'battle-monster-name', 'battle-monster-hp-text', 'battle-monster-hp-bar', 'battle-monster-atb-text', 'battle-monster-atb-bar',
            'battle-monster-shield-text', 'battle-monster-sprite', 'battle-monster-fallback',
            'battle-scene-log-line-1', 'battle-scene-log-line-2', 'battle-skill-cast-cue',
            'battle-monster-inspect-card', 'battle-monster-inspect-name', 'battle-monster-inspect-type', 'battle-monster-inspect-desc',
            'battle-monster-inspect-hp', 'battle-monster-inspect-atk', 'battle-monster-inspect-def', 'battle-monster-inspect-spd', 'battle-monster-inspect-extra',
            'battle-command-panel', 'battle-command-status', 'battle-command-categories', 'battle-command-options', 'battle-command-back',
            'semi-command-controls', 'semi-command-options', 'semi-command-status',
            'm-name', 'm-shield-text', 'm-hp-text', 'm-hp-bar', 'm-hp-bar-ghost',
            'm-atb-row', 'm-atb-text', 'm-atb-bar-fill', 'm-atk', 'm-spd',
            'reward-panel-box', 'log-box', 'title-box', 'status-panel-box', 'action-panel-box',
            'village-panel-box', 'log-wrapper-box', 'tactics-drawer-box', 'char-folder-summary',
            'stat-alloc-grid', 'bag-capacity-text', 'bag-slots-container', 'battle-item-queue-status', 'location-text',
            'guild-skills-container', 'kitchen-warehouse-display', 'recipes-container',
            'workshop-warehouse-display', 'blueprints-container',
            'player-status-badges', 'monster-status-badges',
            'mobile-bottom-hud', 'mobile-latest-log', 'mobile-hud-name', 'mobile-hud-job',
            'mobile-hud-hp', 'mobile-hud-mp', 'mobile-hud-gold', 'mobile-hud-bag-count',
            'mobile-hud-action-slot', 'mobile-character-drawer', 'mobile-log-drawer',
            'mobile-shell-drawer', 'mobile-drawer-title',
            'v-loc-gate', 'v-loc-guild', 'v-loc-kitchen', 'v-loc-workshop', 'v-loc-square'
        ];
        keys.forEach(key => {
            const el = document.getElementById(key);
            if (el) this.elements[key] = el;
        });
        this.isInitialized = true;
    },
    get(key) {
        if (!this.isInitialized) this.init();
        if (!this.elements[key]) {
            const el = document.getElementById(key);
            if (el) this.elements[key] = el;
            return el;
        }
        return this.elements[key];
    }
};

let activeCookingRange = "1-10";
let activeCraftingCategory = "all";
let activeCraftingLvlRange = "1-10";
let activeWarehouseFilter = "all";
const MOBILE_SHELL_MEDIA_QUERY = "(max-width: 640px)";
const mobileShellOrigins = {};
let mobileShellInitialized = false;
let mobileShellMediaQuery = null;
let mobileDrawerReturnFocus = null;
let mobileLatestLogText = "";

// --------------------------------------------------------------------------
// 📱 手機 UI 殼層：重用既有角色、日誌與動作節點，避免雙重資料同步
// --------------------------------------------------------------------------

function isMobileShellViewport() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_SHELL_MEDIA_QUERY).matches;
}

function setMobileText(elementId, value) {
    const element = DOM.get(elementId) || document.getElementById(elementId);
    if (element) element.textContent = value;
}

function rememberMobileShellOrigin(key, element) {
    if (!element || mobileShellOrigins[key]) return;
    const marker = document.createComment(`mobile-shell-origin:${key}`);
    element.parentNode?.insertBefore(marker, element);
    mobileShellOrigins[key] = marker;
}

function moveMobileShellElement(key, elementId, destinationId) {
    const element = document.getElementById(elementId);
    const destination = document.getElementById(destinationId);
    if (!element || !destination) return;
    rememberMobileShellOrigin(key, element);
    if (element.parentNode !== destination) destination.appendChild(element);
}

function restoreMobileShellElement(key, elementId) {
    const element = document.getElementById(elementId);
    const marker = mobileShellOrigins[key];
    if (!element || !marker?.parentNode) return;
    if (element.parentNode !== marker.parentNode || marker.nextSibling !== element) {
        marker.parentNode.insertBefore(element, marker.nextSibling);
    }
}

function setMobileDrawerExpanded(expanded) {
    ['mobile-hud-character', 'mobile-hud-vitals', 'mobile-hud-bag', 'mobile-hud-log'].forEach((id) => {
        const trigger = document.getElementById(id);
        if (trigger) trigger.setAttribute('aria-expanded', String(expanded));
    });
}

function openMobileDrawer(type, trigger = null) {
    if (!isMobileShellViewport()) return;
    const body = document.body;
    const drawer = document.getElementById('mobile-shell-drawer');
    const title = document.getElementById('mobile-drawer-title');
    if (!body || !drawer || !title) return;

    if (typeof hideFloatingCard === "function") hideFloatingCard();
    mobileDrawerReturnFocus = trigger || document.activeElement;
    body.dataset.mobileDrawer = type;
    body.classList.add('mobile-drawer-open');
    drawer.setAttribute('aria-hidden', 'false');
    title.textContent = type === 'log' ? '📜 冒險日誌' : '👤 角色與背包';
    setMobileDrawerExpanded(true);

    window.setTimeout(() => title.focus?.({ preventScroll: true }), 0);
}

function closeMobileDrawer({ restoreFocus = true } = {}) {
    const body = document.body;
    const drawer = document.getElementById('mobile-shell-drawer');
    if (!body || !drawer) return;

    body.classList.remove('mobile-drawer-open');
    delete body.dataset.mobileDrawer;
    drawer.setAttribute('aria-hidden', 'true');
    setMobileDrawerExpanded(false);

    if (restoreFocus && mobileDrawerReturnFocus?.focus) {
        mobileDrawerReturnFocus.focus({ preventScroll: true });
    }
    mobileDrawerReturnFocus = null;
}

function syncMobileShellPlacement() {
    if (typeof document === "undefined" || !document.body) return;
    const useMobileShell = isMobileShellViewport();
    document.body.classList.toggle('mobile-shell-active', useMobileShell);

    if (useMobileShell) {
        moveMobileShellElement('status', 'status-panel-box', 'mobile-character-drawer');
        moveMobileShellElement('action', 'action-panel-box', 'mobile-hud-action-slot');
        moveMobileShellElement('log', 'log-wrapper-box', 'mobile-log-drawer');
    } else {
        closeMobileDrawer({ restoreFocus: false });
        restoreMobileShellElement('status', 'status-panel-box');
        restoreMobileShellElement('action', 'action-panel-box');
        restoreMobileShellElement('log', 'log-wrapper-box');
    }
}

function syncMobileShellUI() {
    if (typeof document === "undefined") return;
    const hud = document.getElementById('mobile-bottom-hud');
    if (!hud) return;

    const isPlayableState = typeof gameState !== "undefined" && gameState !== 'TITLE';
    const showHud = isMobileShellViewport() && isPlayableState;
    hud.hidden = !showHud;
    if (!showHud || typeof currentRun === "undefined" || !currentRun) return;

    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;
    const invLen = Array.isArray(currentRun.inventory) ? currentRun.inventory.length : 0;
    const heroName = accountMeta?.name || currentRun.name || '冒險者';
    const jobName = typeof getJobChineseName === 'function' ? getJobChineseName(currentRun.job) : (currentRun.job || '職業');
    setMobileText('mobile-hud-name', `👤 ${heroName}`);
    setMobileText('mobile-hud-job', `🎭 ${jobName} · Lv.${currentRun.lv || accountMeta?.lv || 1}`);
    setMobileText('mobile-hud-hp', `${Math.max(0, currentRun.hp || 0)}/${Math.max(0, currentRun.maxHp || 0)}`);
    setMobileText('mobile-hud-mp', `${Math.max(0, currentRun.mp || 0)}/${Math.max(0, currentRun.maxMp || 0)}`);
    setMobileText('mobile-hud-gold', String(Math.max(0, currentRun.gold || 0)));
    setMobileText('mobile-hud-bag-count', `${invLen}/${maxBag}`);

    const latestLog = document.getElementById('mobile-latest-log');
    if (latestLog) latestLog.textContent = mobileLatestLogText || '準備踏入命運深淵';
}

function syncMobileLatestLog(text) {
    mobileLatestLogText = String(text || '').replace(/\s+/g, ' ').trim();
    syncMobileShellUI();
}

function initMobileShell() {
    if (mobileShellInitialized || typeof document === "undefined") return;
    mobileShellInitialized = true;

    const openCharacter = (event) => openMobileDrawer('character', event.currentTarget);
    ['mobile-hud-character', 'mobile-hud-vitals', 'mobile-hud-bag'].forEach((id) => {
        document.getElementById(id)?.addEventListener('click', openCharacter);
    });
    document.getElementById('mobile-hud-log')?.addEventListener('click', (event) => openMobileDrawer('log', event.currentTarget));
    document.getElementById('mobile-drawer-close')?.addEventListener('click', () => closeMobileDrawer());
    document.getElementById('mobile-drawer-scrim')?.addEventListener('click', () => closeMobileDrawer());
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body?.classList.contains('mobile-drawer-open')) closeMobileDrawer();
    });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        mobileShellMediaQuery = window.matchMedia(MOBILE_SHELL_MEDIA_QUERY);
        const syncForViewport = () => {
            syncMobileShellPlacement();
            syncMobileShellUI();
        };
        if (typeof mobileShellMediaQuery.addEventListener === 'function') mobileShellMediaQuery.addEventListener('change', syncForViewport);
        else if (typeof mobileShellMediaQuery.addListener === 'function') mobileShellMediaQuery.addListener(syncForViewport);
    }

    const existingLog = document.querySelector('#log-box .log-row-box:last-child');
    if (existingLog) mobileLatestLogText = existingLog.textContent || '';
    syncMobileShellPlacement();
    syncMobileShellUI();
}

// --------------------------------------------------------------------------
// ⏳ 0. 登入動態遮罩
// --------------------------------------------------------------------------

function showLoginLoadingOverlay(targetSeconds = 8, message = "正在喚醒 Render 雲端伺服器...") {
    let overlay = document.getElementById('login-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'login-loading-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 10, 15, 0.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            z-index: 10000; color: #fff; text-align: center; padding: 20px; box-sizing: border-box;
        `;
        document.body.appendChild(overlay);
    }

    let currentSec = targetSeconds;
    overlay.innerHTML = `
        <div style="background: rgba(20, 25, 35, 0.95); border: 2px solid #00ffcc; border-radius: 16px; padding: 25px; max-width: 380px; width: 90%; box-shadow: 0 0 30px rgba(0,255,204,0.3);">
            <div style="font-size: 36px; margin-bottom: 12px; display: inline-block; animation: pulse 1.5s infinite;">🔮</div>
            <div style="font-size: 16px; font-weight: bold; color: #00ffcc; margin-bottom: 8px;">${message}</div>
            <div style="font-size: 11px; color: #aaa; margin-bottom: 15px; line-height: 1.5;"> Render 免費雲端伺服器正在冷啟動中<br>請稍後 5~10 秒以建立安全的血脈通道...</div>
            <div style="background: rgba(0,0,0,0.6); border-radius: 10px; height: 12px; overflow: hidden; position: relative; width: 100%; border: 1px solid rgba(255,255,255,0.15);">
                <div id="login-progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #16a085, #00ffcc, #ffd700); transition: width 0.2s linear;"></div>
            </div>
            <div id="login-countdown-text" style="font-size: 11px; color: #ffd700; margin-top: 12px; font-weight: bold;">估計剩餘時間：${currentSec} 秒</div>
        </div>
    `;
    overlay.style.display = 'flex';

    if (loginLoadingInterval) clearInterval(loginLoadingInterval);
    let elapsedMs = 0;
    const totalMs = targetSeconds * 1000;

    loginLoadingInterval = setInterval(() => {
        elapsedMs += 100;
        const pct = Math.min(100, Math.floor((elapsedMs / totalMs) * 100));
        const remainSec = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));

        const bar = document.getElementById('login-progress-bar');
        const txt = document.getElementById('login-countdown-text');
        if (bar) bar.style.width = `${pct}%`;
        if (txt) txt.innerText = remainSec > 0 ? `估計剩餘時間：${remainSec} 秒` : `雲端伺服器響應中，即將進入...`;

        if (elapsedMs >= totalMs) {
            clearInterval(loginLoadingInterval);
        }
    }, 100);
}

function hideLoginLoadingOverlay() {
    if (loginLoadingInterval) clearInterval(loginLoadingInterval);
    const overlay = document.getElementById('login-loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --------------------------------------------------------------------------
// 🍞 1. Toast 輕量通知 API
// --------------------------------------------------------------------------

function showToast(msg, type = "info") {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type === 'success' ? 'toast-success' : type === 'warn' ? 'toast-warn' : ''}`;
    toast.innerText = msg;
    container.appendChild(toast);

    if (navigator.vibrate) {
        if (type === 'warn') navigator.vibrate([15, 30, 15]);
        else if (type === 'success') navigator.vibrate(10);
    }

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 250);
    }, 2200);
}

function showMaterialAlert(missingDetails, title = "⚠️ 所需材料 / 金幣不足！") {
    let overlay = document.getElementById('mat-alert-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mat-alert-overlay';
        overlay.innerHTML = `
            <div class="mat-alert-box">
                <div class="mat-alert-header" id="mat-alert-header-title">⚠️ 材料不足</div>
                <div class="mat-alert-content" id="mat-alert-body-content"></div>
                <button class="mat-alert-btn" onclick="hideMaterialAlert()">確認並返回</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const titleEl = document.getElementById('mat-alert-header-title');
    const bodyEl = document.getElementById('mat-alert-body-content');

    if (titleEl) titleEl.innerText = title;
    if (bodyEl) {
        if (Array.isArray(missingDetails)) {
            bodyEl.innerHTML = missingDetails.map(item => `<div style="margin-bottom: 4px;">• ${item}</div>`).join('');
        } else {
            bodyEl.innerHTML = missingDetails;
        }
    }

    overlay.classList.add('active');
}

function hideMaterialAlert() {
    const overlay = document.getElementById('mat-alert-overlay');
    if (overlay) overlay.classList.remove('active');
}

// --------------------------------------------------------------------------
// 👻 2. 血條殘影控制
// --------------------------------------------------------------------------

let ghostHpTimer = null;
let ghostMonsterHpTimer = null;

function updateHpBarWithGhost(current, max, fillElId, ghostElId) {
    const fillEl = DOM.get(fillElId);
    const ghostEl = DOM.get(ghostElId);
    if (!fillEl) return;

    const safeMax = Math.max(1, max || 1);
    const targetPct = Math.max(0, Math.min(100, (current / safeMax) * 100));

    if (!ghostEl) {
        fillEl.style.width = `${targetPct}%`;
        return;
    }

    const currentGhostPct = parseFloat(ghostEl.style.width) || 100;

    if (targetPct < currentGhostPct) {
        fillEl.style.width = `${targetPct}%`;
        clearTimeout(fillElId === 'hp-bar-fill' ? ghostHpTimer : ghostMonsterHpTimer);
        const timer = setTimeout(() => {
            ghostEl.style.width = `${targetPct}%`;
        }, 220);

        if (fillElId === 'hp-bar-fill') ghostHpTimer = timer;
        else ghostMonsterHpTimer = timer;
    } else {
        fillEl.style.width = `${targetPct}%`;
        ghostEl.style.width = `${targetPct}%`;
    }
}

// --------------------------------------------------------------------------
// 🎴 3. 通用 Floating Card 浮動卡片引擎
// --------------------------------------------------------------------------

let touchCardTimer = null;

function showFloatingCard(e, title, type, desc, stats = "") {
    let card = document.getElementById('floating-item-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'floating-item-card';
        document.body.appendChild(card);
    }

    card.innerHTML = `
        <div style="font-weight: bold; font-size: 13px; color: var(--gold-glow, #ffd700); margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>${title}</span>
            <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.08); color: #aaa;">${type}</span>
        </div>
        <div style="font-size: 11px; color: #d1d1d6; line-height: 1.5; margin-bottom: 6px;">${desc}</div>
        ${stats ? `<div style="font-size: 10px; color: #00ffcc; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 5px; margin-top: 5px;">${stats}</div>` : ''}
    `;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let posX = clientX + 15;
    let posY = clientY - 40;

    if (posX + 230 > window.innerWidth) posX = Math.max(10, clientX - 235);
    if (posY < 10) posY = 10;
    if (posY + 180 > window.innerHeight) posY = Math.max(10, window.innerHeight - 190);

    card.style.left = `${posX}px`;
    card.style.top = `${posY}px`;
    card.classList.add('active');
}

function hideFloatingCard() {
    if (touchCardTimer) {
        clearTimeout(touchCardTimer);
        touchCardTimer = null;
    }
    const card = document.getElementById('floating-item-card');
    if (card) card.classList.remove('active');
}

function bindFloatingCard(element, getCardDataFn) {
    if (!element) return;

    element.onmouseenter = (e) => {
        const data = getCardDataFn();
        if (data) showFloatingCard(e, data.title, data.type, data.desc, data.stats);
    };
    element.onmouseleave = () => hideFloatingCard();

    element.ontouchstart = (e) => {
        if (touchCardTimer) clearTimeout(touchCardTimer);
        touchCardTimer = setTimeout(() => {
            const data = getCardDataFn();
            if (data) showFloatingCard(e, data.title, data.type, data.desc, data.stats);
        }, 220);
    };
    element.ontouchmove = () => hideFloatingCard(); 
    element.ontouchend = () => hideFloatingCard();
    element.ontouchcancel = () => hideFloatingCard();
}

// --------------------------------------------------------------------------
// ✨ 4. Buff / Debuff 狀態徽章列渲染引擎
// --------------------------------------------------------------------------

function renderStatusBadges(containerEl, effectsMap) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    const activeMap = effectsMap || (typeof currentRun !== "undefined" ? (currentRun.activeEffects || currentRun.buffs) : null) || (typeof playerStatusEffects !== "undefined" ? playerStatusEffects : null);
    if (!activeMap || Object.keys(activeMap).length === 0) return;

    for (let key in activeMap) {
        const eff = activeMap[key];
        if (!eff) continue;

        const duration = typeof eff === "object" ? eff.duration : eff;
        if (!duration || duration <= 0) continue;

        const name = typeof eff === "object" ? eff.name : key.toUpperCase();
        const icon = typeof eff === "object" ? (eff.icon || '✨') : '🔥';
        const isBuff = typeof eff === "object" ? (eff.type === "buff") : false;

        const badge = document.createElement('div');
        badge.className = `status-badge ${isBuff ? 'buff' : 'debuff'}`;
        badge.style.cssText = `
            display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px;
            border-radius: 12px; font-size: 10px; font-weight: bold; margin-right: 4px; margin-bottom: 4px;
            background: ${isBuff ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)'};
            border: 1px solid ${isBuff ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)'};
            color: ${isBuff ? '#2ecc71' : '#ff4757'}; cursor: pointer;
        `;
        badge.innerHTML = `<span>${icon}</span> <span>${name}</span> <b>(${duration})</b>`;

        bindFloatingCard(badge, () => ({
            title: name,
            type: isBuff ? "增益 Buff" : "減益 Debuff",
            desc: (typeof eff === "object" && eff.desc) ? eff.desc : "戰場狀態影響。",
            stats: `剩餘回合 / 層數: ${duration}`
        }));

        containerEl.appendChild(badge);
    }
}

// --------------------------------------------------------------------------
// 📱 5. 手機端橫向滑動切換村莊分頁
// --------------------------------------------------------------------------

function initSwipeNavigation() {
    const villageBox = DOM.get('village-panel-box');
    if (!villageBox) return;

    let touchStartX = 0;
    let touchStartY = 0;
    const locations = ['GATE', 'GUILD', 'KITCHEN', 'WORKSHOP', 'SQUARE'];

    villageBox.ontouchstart = (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    };

    villageBox.ontouchend = (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
            const currentIndex = locations.indexOf(currentVillageLocation);
            if (diffX < 0 && currentIndex < locations.length - 1) {
                switchVillageLocation(locations[currentIndex + 1]);
                showToast(`轉至 ${locations[currentIndex + 1]} 區域`, "info");
            } else if (diffX > 0 && currentIndex > 0) {
                switchVillageLocation(locations[currentIndex - 1]);
                showToast(`轉至 ${locations[currentIndex - 1]} 區域`, "info");
            }
        }
    };
}

// --------------------------------------------------------------------------
// 🎯 屬性配點邏輯
// --------------------------------------------------------------------------

function allocateStatPoint(statKey) {
    if (!accountMeta.statPoints || accountMeta.statPoints <= 0) {
        if (typeof showToast === "function") showToast("自由能力點數不足！", "warn");
        return;
    }
    
    if (!accountMeta.stats) {
        accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    }
    
    accountMeta.statPoints--;
    accountMeta.stats[statKey] = (accountMeta.stats[statKey] || 0) + 1;
    
    if (typeof resetCurrentRunData === "function") {
        resetCurrentRunData();
    } else if (typeof StatEngine !== "undefined" && StatEngine.resetCurrentRunData) {
        StatEngine.resetCurrentRunData();
    }
    
    if (typeof currentRun !== "undefined" && currentRun) {
        if (typeof gameState !== "undefined" && gameState === "VILLAGE") {
            currentRun.hp = currentRun.maxHp;
            currentRun.mp = currentRun.maxMp;
        }
    }
    
    if (typeof saveGameData === "function") saveGameData();
    
    if (typeof showToast === "function") showToast(`⚡ ${statKey} 提升至 ${accountMeta.stats[statKey]}！`, "success");
    if (typeof addLog === "function") {
        addLog(`⚡ 屬力配點：<strong>${statKey}</strong> 提升至 ${accountMeta.stats[statKey]}！(HP: ${currentRun.maxHp} / MP: ${currentRun.maxMp})`, "perfect");
    }

    updateUI();
}

// --------------------------------------------------------------------------
// 🎛️ 動態戰術動作面板引擎
// --------------------------------------------------------------------------

function updateActionPanelUI() {
    const actionBox = DOM.get('action-panel-box') || document.getElementById('action-panel-box');
    if (!actionBox) return;

    actionBox.innerHTML = "";
    actionBox.style.display = "flex";
    actionBox.style.gap = "8px";
    actionBox.style.width = "100%";

    if (gameState === "VILLAGE") {
        const btnEnter = document.createElement('button');
        btnEnter.id = "btn-main-action";
        btnEnter.className = "btn-game btn-explore full-width";
        btnEnter.style.cssText = "flex: 1; padding: 12px; font-size: 13px; font-weight: bold;";
        btnEnter.innerHTML = `🔮 進入地下城 (B${typeof dungeonFloor !== "undefined" ? (dungeonFloor || 1) : 1}F)`;
        btnEnter.onclick = () => { if (typeof startNextFloor === "function") startNextFloor(); };
        actionBox.appendChild(btnEnter);
        return;
    }

    if (gameState === "ENDING") {
        const btnReturn = document.createElement('button');
        btnReturn.id = "btn-secondary-action";
        btnReturn.className = "btn-game btn-rest full-width";
        btnReturn.innerText = "⛺ 返回村莊";
        btnReturn.onclick = () => {
            if (typeof closeCampaignEndingModal === "function") closeCampaignEndingModal();
            else if (typeof returnToVillage === "function") returnToVillage();
        };
        actionBox.appendChild(btnReturn);
        return;
    }

    if (gameState === "BATTLE") {
        const btnFlee = document.createElement('button');
        btnFlee.id = "btn-secondary-action";
        btnFlee.className = "btn-game btn-rest";
        btnFlee.style.cssText = "flex: 1; padding: 10px; font-size: 12px; font-weight: bold; background: linear-gradient(135deg, #c0392b, #7f8c8d) !important;";
        btnFlee.innerHTML = "🏃 回到村莊";
        btnFlee.onclick = () => { if (typeof returnToVillage === "function") returnToVillage(); };

        actionBox.appendChild(btnFlee);
        return;
    }

    if (gameState === "REWARD" || gameState === "ENCOUNTER" || gameState === "ENCOUNTER_RESOLVED") {
        const currentF = typeof dungeonFloor !== "undefined" ? dungeonFloor : 1;
        const nextF = currentF + 1;

        const btnNext = document.createElement('button');
        btnNext.id = "btn-main-action";
        btnNext.className = "btn-game btn-explore";
        btnNext.style.cssText = "flex: 2; padding: 10px; font-size: 12px; font-weight: bold;";
        btnNext.innerHTML = `⚔️ 進入下層 (B${nextF}F)`;
        btnNext.onclick = () => { if (typeof startNextFloor === "function") startNextFloor(); };
        actionBox.appendChild(btnNext);

        const btnRerun = document.createElement('button');
        btnRerun.id = "btn-rerun-action";
        btnRerun.className = "btn-game btn-rerun";
        btnRerun.style.cssText = "flex: 1.5; padding: 10px; font-size: 11px; font-weight: bold;";
        btnRerun.innerHTML = `🔄 重巡此層 (B${currentF}F)`;
        btnRerun.onclick = () => { if (typeof rerunCurrentFloor === "function") rerunCurrentFloor(); };
        actionBox.appendChild(btnRerun);

        const btnReturn = document.createElement('button');
        btnReturn.id = "btn-secondary-action";
        btnReturn.className = "btn-game btn-rest";
        btnReturn.style.cssText = "flex: 1; padding: 10px; font-size: 11px; font-weight: bold;";
        btnReturn.innerHTML = "⛺ 回到村莊";
        btnReturn.onclick = () => { if (typeof returnToVillage === "function") returnToVillage(); };
        actionBox.appendChild(btnReturn);
    }
}

// --------------------------------------------------------------------------
// 🌟 靈魂賜福手動三選一卡片渲染引擎
// --------------------------------------------------------------------------

function renderBlessingRewardCards(customChoices = null) {
    const rewardBox = DOM.get('reward-panel-box');
    if (!rewardBox) return;

    if (autoSelectBlessingTimer) clearTimeout(autoSelectBlessingTimer);

    const defaultChoices = customChoices || [
        {
            id: "blessing_spd",
            icon: "⚡",
            title: "狂暴神經反射",
            type: "敏捷賜福",
            desc: "行動條積攢速度永久提升，完全閃避率提升。",
            stats: "SPD +5 | 閃避 +3%",
            apply: () => {
                if (!accountMeta.stats) accountMeta.stats = {};
                accountMeta.stats.AGI = (accountMeta.stats.AGI || 0) + 5;
                if (currentRun) currentRun.spd = (currentRun.spd || 10) + 5;
            }
        },
        {
            id: "blessing_hp",
            icon: "🛡️",
            title: "龍血不滅體魄",
            type: "生存賜福",
            desc: "最大生命值獲得史詩級突破，戰鬥減傷增加。",
            stats: "MAX HP +30 | 減傷 +5",
            apply: () => {
                if (!accountMeta.stats) accountMeta.stats = {};
                accountMeta.stats.VIT = (accountMeta.stats.VIT || 0) + 5;
                if (currentRun) {
                    currentRun.maxHp = (currentRun.maxHp || 100) + 30;
                    currentRun.hp = currentRun.maxHp;
                }
            }
        },
        {
            id: "blessing_atk",
            icon: "🔮",
            title: "深淵法力湧動",
            type: "輸出賜福",
            desc: "解鎖深淵魔力共鳴，極大增強魔法與物理攻擊力。",
            stats: "ATK +8 | MATK +12",
            apply: () => {
                if (currentRun) {
                    currentRun.atk = (currentRun.atk || 10) + 8;
                    currentRun.matk = (currentRun.matk || 10) + 12;
                }
            }
        }
    ];

    rewardBox.innerHTML = `
        <div style="font-size: 13px; font-weight: bold; color: #ffd700; text-align: center; margin-bottom: 10px; letter-spacing: 1px;">
            ✨ 抉擇靈魂賜福（請選擇一項） ✨
        </div>
        <div id="blessing-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; width: 100%;"></div>
    `;

    const grid = document.getElementById('blessing-cards-grid');

    defaultChoices.forEach((choice) => {
        const card = document.createElement('div');
        card.className = "reward-card blessing-choice-card";
        card.style.cssText = `
            background: radial-gradient(circle at 50% 0%, rgba(255, 215, 0, 0.15) 0%, rgba(20, 25, 35, 0.95) 100%);
            border: 1px solid rgba(255, 215, 0, 0.5);
            border-radius: 10px; padding: 10px 8px; text-align: center; cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; flex-direction: column; justify-content: space-between;
        `;

        card.innerHTML = `
            <div>
                <div style="font-size: 22px; margin-bottom: 4px;">${choice.icon}</div>
                <div style="font-size: 12px; font-weight: bold; color: #ffd700; margin-bottom: 2px;">${choice.title}</div>
                <div style="font-size: 9px; color: #00ffcc; margin-bottom: 6px;">[${choice.type}]</div>
                <div style="font-size: 10px; color: #ddd; line-height: 1.3; margin-bottom: 6px;">${choice.desc}</div>
            </div>
            <div style="font-size: 10px; font-weight: bold; color: #2ecc71; background: rgba(46, 204, 113, 0.1); padding: 3px; border-radius: 4px; border: 1px solid rgba(46, 204, 113, 0.3);">
                ${choice.stats}
            </div>
        `;

        card.onclick = () => selectBlessingChoice(choice);

        card.onmouseenter = () => {
            card.style.transform = "translateY(-4px)";
            card.style.borderColor = "#00ffcc";
            card.style.boxShadow = "0 6px 18px rgba(0,255,204,0.3)";
        };
        card.onmouseleave = () => {
            card.style.transform = "none";
            card.style.borderColor = "rgba(255, 215, 0, 0.5)";
            card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
        };

        grid.appendChild(card);
    });

    rewardBox.style.display = "block";

    if (typeof autoBattleActive !== "undefined" && autoBattleActive) {
        showToast("🤖 自動戰術啟動中：1.5 秒後自動挑選賜福...", "info");
        autoSelectBlessingTimer = setTimeout(() => {
            selectBlessingChoice(defaultChoices[0]);
        }, 1500);
    }
}

function selectBlessingChoice(choice) {
    if (autoSelectBlessingTimer) clearTimeout(autoSelectBlessingTimer);

    if (choice && typeof choice.apply === "function") {
        choice.apply();
    }

    if (typeof saveGameData === "function") saveGameData();

    showToast(`✨ 獲得靈魂賜福：${choice.title}！`, "success");
    if (typeof addLog === "function") {
        addLog(`✨ 抉擇靈魂賜福：成功覺醒 <strong>${choice.title}</strong> (${choice.stats})！`, "perfect");
    }

    const rewardBox = DOM.get('reward-panel-box');
    if (rewardBox) {
        rewardBox.innerHTML = "";
        rewardBox.style.display = "none";
    }

    updateUI();
}

// --------------------------------------------------------------------------
// 🎒 背包與倉庫高效率互轉機制
// --------------------------------------------------------------------------

function executeWithdrawFoodFromWarehouse(itemName) {
    if (!currentRun.inventory) currentRun.inventory = [];
    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;

    if (currentRun.inventory.length >= maxBag) {
        showToast(`🎒 背包容量已滿 (${currentRun.inventory.length}/${maxBag})！`, "warn");
        return;
    }

    const qtyInWarehouse = accountMeta.warehouse?.[itemName] || 0;
    if (qtyInWarehouse <= 0) {
        showToast(`📦 倉庫內已無存貨 (${itemName})！`, "warn");
        return;
    }

    accountMeta.warehouse[itemName]--;
    if (accountMeta.warehouse[itemName] <= 0) {
        delete accountMeta.warehouse[itemName];
    }
    currentRun.inventory.push(itemName);

    if (typeof saveGameData === "function") saveGameData();
    showToast(`🎒 取出 ${itemName} 放入背包`, "success");
    addLog(`🎒 從倉庫取出 <strong>${itemName}</strong> 放入攜帶背包。`, "perfect");
    
    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
}

function executeDepositBagItemToWarehouse(bagIndex) {
    if (!currentRun.inventory || !currentRun.inventory[bagIndex]) return;

    const itemName = currentRun.inventory[bagIndex];
    currentRun.inventory.splice(bagIndex, 1);

    if (!accountMeta.warehouse) accountMeta.warehouse = {};
    accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;
    hideFloatingCard();

    if (typeof saveGameData === "function") saveGameData();
    showToast(`📦 ${itemName} 已存入倉庫`, "info");
    addLog(`📦 已將背包中的 <strong>${itemName}</strong> 退回存放至倉庫。`, "perfect");

    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
    if (currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

function executeDepositAllBagItems() {
    if (!currentRun.inventory || currentRun.inventory.length === 0) {
        showToast("🎒 背包內目前沒有物品！", "warn");
        return;
    }

    const count = currentRun.inventory.length;
    if (!accountMeta.warehouse) accountMeta.warehouse = {};

    currentRun.inventory.forEach(itemName => {
        accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;
    });

    currentRun.inventory = [];
    hideFloatingCard();

    if (typeof saveGameData === "function") saveGameData();
    showToast(`📦 已將 ${count} 件物品全存入倉庫！`, "success");
    addLog(`📦 已將背包內全部 <strong>${count}</strong> 件物品一次性轉存至倉庫！`, "perfect");

    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
    if (currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

// --------------------------------------------------------------------------
// ⚔️ 裝備數值比對與預覽
// --------------------------------------------------------------------------

function getEquipmentStatDiff(blueprint) {
    if (!blueprint || !blueprint.stats) return "";

    const slotType = blueprint.type;
    const currentlyEquippedName = accountMeta.equipment?.[slotType];

    let currentStats = {};
    if (currentlyEquippedName) {
        const equippedBp = typeof getItemBlueprintByName === "function" ? getItemBlueprintByName(currentlyEquippedName) : (typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS.find(b => b.name === currentlyEquippedName) : null);
        if (equippedBp) {
            const currentRefineLvl = (accountMeta.itemRefines?.[currentlyEquippedName]) || (accountMeta.equipmentStars?.[slotType]) || 0;
            for (let k in equippedBp.stats) {
                currentStats[k] = Math.floor(equippedBp.stats[k] * (1 + currentRefineLvl * 0.15));
            }
        }
    }

    const itemRefineLvl = (accountMeta.itemRefines?.[blueprint.name]) || 0;
    const nameMap = { atk: "攻擊", matk: "魔攻", spd: "速度", mpRegen: "回魔", block: "減傷", maxHp: "生命", maxMp: "魔力", flee: "閃避", hit: "命中", critChance: "暴擊", def: "物防", mdef: "魔防" };

    let diffParts = [];
    for (let statKey in blueprint.stats) {
        const newBase = blueprint.stats[statKey];
        const newFinal = Math.floor(newBase * (1 + itemRefineLvl * 0.15));
        const oldFinal = currentStats[statKey] || 0;
        const diff = newFinal - oldFinal;

        const label = nameMap[statKey] || statKey;
        const displayValue = newFinal >= 0 ? `+${newFinal}` : `${newFinal}`;
        if (diff > 0) {
            diffParts.push(`${label} ${displayValue} <span style="color:#2ecc71; font-weight:bold;">(🟢 +${diff})</span>`);
        } else if (diff < 0) {
            diffParts.push(`${label} ${displayValue} <span style="color:#ff4757; font-weight:bold;">(🔴 ${diff})</span>`);
        } else {
            diffParts.push(`${label} ${displayValue} <span style="color:#8e8e93;">(=)</span>`);
        }
    }

    return diffParts.join(" | ");
}

// --------------------------------------------------------------------------
// 👤 角色數據 UI 同步
// --------------------------------------------------------------------------

function syncCharacterDataUi() {
    if (!accountMeta || !currentRun) return;

    if (typeof resetCurrentRunData === "function") {
        resetCurrentRunData();
    } else if (typeof StatEngine !== "undefined" && StatEngine.resetCurrentRunData) {
        StatEngine.resetCurrentRunData();
    }

    const nameEl = DOM.get('p-name');
    const jobEl = DOM.get('p-job');
    const lvEl = DOM.get('p-lv');
    const expTextEl = DOM.get('p-exp-text');
    
    if (nameEl) nameEl.innerText = accountMeta.name || "無名勇者";
    if (jobEl) jobEl.innerText = getJobChineseName(currentRun.job);
    if (lvEl) lvEl.innerText = accountMeta.lv || currentRun.lv || 1;
    if (expTextEl) expTextEl.innerText = `${accountMeta.exp || 0} / ${accountMeta.nextExp || currentRun.nextExp || 30}`;

    const pts = accountMeta.statPoints || 0;
    const ptsEl = DOM.get('p-stat-points');
    if (ptsEl) ptsEl.innerText = pts;

    const folderSummary = DOM.get('char-folder-summary');
    if (folderSummary) {
        folderSummary.innerHTML = pts > 0 
            ? `🔍 展開角色面板 <span style="color: #00ffcc; font-weight: bold; text-shadow: 0 0 6px rgba(0,255,204,0.5);">[✨ ${pts} 點數待分配]</span>`
            : `🔍 展開查看 戰偶裝備、配點與詳細數值`;
    }

    const gridEl = DOM.get('stat-alloc-grid');
    if (gridEl) {
        gridEl.innerHTML = "";
        const statConfig = [
            { key: "STR", name: "⚔️ 力量", desc: "近戰ATK / 負重", detail: "每點增加近戰物理攻擊與背包負重上限。" },
            { key: "AGI", name: "⚡ 敏捷", desc: "攻速 / 迴避", detail: "每點增加行動條積攢速度與完全閃避率。" },
            { key: "VIT", name: "🛡️ 體質", desc: "HP上限 / 防禦", detail: "每點增加生命上限與物理減傷數值。" },
            { key: "INT", name: "🔮 智力", desc: "魔攻 / 魔防", detail: "每點增加魔法攻擊力、最大 MP 與魔防。" },
            { key: "DEX", name: "🎯 靈巧", desc: "命中 / 詠唱", detail: "每點增加物理命中 Hit 與技能吟唱速度。" },
            { key: "LUK", name: "🎰 幸運", desc: "暴擊 / 完迴", detail: "每點增加暴擊觸發率與幸運迴避率。" }
        ];

        const hasPoints = pts > 0;
        const currentStats = accountMeta.stats || { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };

        statConfig.forEach(s => {
            const val = currentStats[s.key] || 0;
            const cell = document.createElement('div');
            cell.style.cssText = `
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 6px; padding: 5px 8px;
                display: flex; justify-content: space-between; align-items: center;
                cursor: pointer; transition: all 0.2s ease;
            `;

            cell.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 11px; color: #ddd; font-weight: 600;">${s.name} <b style="color: #00ffcc;">${val}</b></span>
                </div>
                <button class="btn-game" 
                    style="padding: 2px 8px; font-size: 11px; min-width: 24px; height: 22px; line-height: 1; font-weight: bold; background: ${hasPoints ? 'linear-gradient(135deg, #16a085, #0a5c4c)' : 'rgba(255,255,255,0.05)'};"
                    ${hasPoints ? "" : "disabled"} 
                    onclick="event.stopPropagation(); allocateStatPoint('${s.key}')">+</button>
            `;

            bindFloatingCard(cell, () => ({
                title: s.name,
                type: "基礎配點",
                desc: s.detail,
                stats: `當前投資點數: ${val}`
            }));

            gridEl.appendChild(cell);
        });
    }

    const hpEl = DOM.get('p-hp');
    const maxHpEl = DOM.get('p-maxhp');
    const mpEl = DOM.get('p-mp');
    const maxMpEl = DOM.get('p-maxmp');
    const pAtbRow = DOM.get('p-atb-row');
    const pAtbBar = DOM.get('p-atb-bar-fill');
    const pAtbText = DOM.get('p-atb-text');
    
    if (hpEl) hpEl.innerText = currentRun.hp;
    if (maxHpEl) maxHpEl.innerText = currentRun.maxHp;
    if (mpEl) mpEl.innerText = currentRun.mp;
    if (maxMpEl) maxMpEl.innerText = currentRun.maxMp;
    
    if (pAtbRow) {
        if (gameState === "BATTLE") {
            pAtbRow.style.display = "block";
            const pAtbPercent = Math.min(100, Math.max(0, typeof playerAtb !== "undefined" ? playerAtb : 0));
            if (pAtbBar) pAtbBar.style.width = `${pAtbPercent}%`;
            if (pAtbText) pAtbText.innerText = `${Math.floor(pAtbPercent)}%`;
        } else {
            pAtbRow.style.display = "none";
        }
    }

    updateHpBarWithGhost(currentRun.hp, currentRun.maxHp, 'hp-bar-fill', 'hp-bar-ghost');

    const mpBar = DOM.get('mp-bar-fill');
    if (mpBar) mpBar.style.width = `${Math.max(0, Math.min(100, (currentRun.mp / (currentRun.maxMp || 1)) * 100))}%`;

    renderStatusBadges(DOM.get('player-status-badges'), currentRun.activeEffects);

    const setTxt = (key, txt) => { const e = DOM.get(key); if (e) e.innerText = txt; };
    setTxt('p-gold', currentRun.gold || 0);
    setTxt('p-atk', `${currentRun.atk} (魔 ${currentRun.matk || 0})`);
    const activeCombatBuffs = currentRun.activeCombatBuffs || {};
    const activeBlockBuff = activeCombatBuffs.blockBuff?.turns > 0 ? Number(activeCombatBuffs.blockBuff.value) || 0 : 0;
    const activeMdefBuff = activeCombatBuffs.mdefBuff?.turns > 0 ? Number(activeCombatBuffs.mdefBuff.value) || 0 : 0;
    const activeDodgeBuff = activeCombatBuffs.dodgeBuff?.turns > 0 ? Number(activeCombatBuffs.dodgeBuff.value) || 0 : 0;
    const activeSpdBuff = activeCombatBuffs.spdBuff?.turns > 0 ? Number(activeCombatBuffs.spdBuff.value) || 0 : 0;
    setTxt('p-block', `${(currentRun.def || 0) + activeBlockBuff} (魔防 ${(currentRun.mdef || 0) + activeMdefBuff})`);
    setTxt('p-spd', (currentRun.spd || 0) + activeSpdBuff);
    setTxt('p-crit', `${currentRun.critChance}%`);
    setTxt('p-dodge', `${Math.floor((currentRun.flee || 0) + activeDodgeBuff)} (完迴 ${currentRun.perfectDodge || 0}%)`);
    setTxt('p-vamp', `${Math.floor(currentRun.hit || 80)} HIT`);

    const skList = Object.keys(currentRun.skills || {}).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    const skillListEl = DOM.get('p-skills-list');
    if (skillListEl) skillListEl.innerText = skList || "基本打擊";

    const getRefineLvl = (slot, eqName) => (accountMeta.itemRefines?.[eqName]) || (accountMeta.equipmentStars?.[slot]) || 0;

    const wName = accountMeta.equipment?.weapon || "空手";
    const aName = accountMeta.equipment?.armor || "布衣";
    const cName = accountMeta.equipment?.accessory || "無";

    const wRefine = getRefineLvl('weapon', wName);
    const aRefine = getRefineLvl('armor', aName);
    const cRefine = getRefineLvl('accessory', cName);

    setTxt('p-equip-weapon', wName + (wRefine > 0 ? ` (+${wRefine})` : ""));
    setTxt('p-equip-armor', aName + (aRefine > 0 ? ` (+${aRefine})` : ""));
    setTxt('p-equip-accessory', cName + (cRefine > 0 ? ` (+${cRefine})` : ""));

    ['slot-weapon', 'slot-armor', 'slot-accessory'].forEach(slotId => {
        const slotEl = DOM.get(slotId);
        if (!slotEl) return;
        const type = slotId.replace('slot-', '');
        const eqName = accountMeta.equipment?.[type] || "無";
        bindFloatingCard(slotEl, () => {
            let desc = "未裝備任何道具。";
            let stats = "";
            const bp = typeof getItemBlueprintByName === "function" ? getItemBlueprintByName(eqName) : (typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS.find(b => b.name === eqName) : null);
            if (bp) {
                desc = bp.desc;
                const rLvl = getRefineLvl(type, eqName);
                const mult = 1 + rLvl * 0.15;
                stats = Object.keys(bp.stats).map(k => `${k}: +${Math.floor(bp.stats[k] * mult)}`).join(" | ");
            }
            return { title: eqName, type: `裝備部位: ${type.toUpperCase()}`, desc: desc, stats: stats };
        });
    });

    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;
    const invLen = currentRun.inventory?.length || 0;
    
    const capTextEl = DOM.get('bag-capacity-text');
    if (capTextEl) {
        let capClass = "";
        if (invLen >= maxBag) capClass = "text-full";
        else if (invLen === maxBag - 1) capClass = "text-warn";

        if (gameState === "VILLAGE" && invLen > 0) {
            capTextEl.innerHTML = `<span class="${capClass}">🎒 ${invLen} / ${maxBag}</span> <button class="btn-game btn-rest" style="padding: 2px 8px; font-size: 10px; margin-left: 6px;" onclick="executeDepositAllBagItems()">📦 一鍵全存</button>`;
        } else {
            capTextEl.innerHTML = `<span class="${capClass}">🎒 ${invLen} / ${maxBag}</span>`;
        }
    }

    const queueStatus = DOM.get('battle-item-queue-status');
    if (queueStatus) {
        if (gameState === "BATTLE") {
            const queued = typeof pendingCombatItem !== "undefined" ? pendingCombatItem : null;
            queueStatus.style.display = "block";
            queueStatus.textContent = queued
                ? `⌛ 已排程：${queued.itemName}（下次我方 ATB 使用）`
                : "🧪 點擊背包道具，於下次我方 ATB 行動時使用";
            queueStatus.classList?.toggle("is-queued", Boolean(queued));
        } else {
            queueStatus.style.display = "none";
            queueStatus.textContent = "";
            queueStatus.classList?.remove("is-queued");
        }
    }

    const bagContainer = DOM.get('bag-slots-container');
    if (bagContainer) {
        bagContainer.classList.toggle('bag-full', invLen >= maxBag);
        bagContainer.innerHTML = "";

        for (let i = 0; i < maxBag; i++) {
            const item = currentRun.inventory[i];
            const slot = document.createElement('div');
            slot.style.cssText = `
                height: 34px;
                border: 1px ${item ? "solid rgba(255,215,0,0.5)" : "dashed rgba(255,255,255,0.15)"};
                background: ${item ? "rgba(255,215,0,0.08)" : "rgba(0,0,0,0.2)"};
                border-radius: 6px; display: flex; align-items: center; justify-content: center;
                font-size: 11px; cursor: ${item ? "pointer" : "default"}; position: relative;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px;
                color: ${item ? "#ffd700" : "#666"};
                box-shadow: ${item ? "0 2px 6px rgba(0,0,0,0.3)" : "none"};
                transition: all 0.2s ease;
            `;

            if (item) {
                slot.innerText = item;
                const isQueued = typeof pendingCombatItem !== "undefined" && pendingCombatItem && pendingCombatItem.itemIndex === i && pendingCombatItem.itemName === item;
                if (isQueued) slot.classList.add("combat-item-queued");
                slot.onclick = () => {
                    if (gameState === "BATTLE") {
                        if (typeof queueCombatItemUse === "function") queueCombatItemUse(i);
                        else if (typeof executeUseDungeonItem === "function") executeUseDungeonItem(item, i);
                    } else {
                        executeDepositBagItemToWarehouse(i);
                    }
                };

                bindFloatingCard(slot, () => {
                    let desc = "攜帶型冒險道具。";
                    let typeStr = "消耗品";
                    let statsStr = gameState === "BATTLE" ? "點擊後排入下一次我方 ATB 行動使用" : "點擊退回存入倉庫";

                    const recipe = typeof getRecipeByName === "function" ? getRecipeByName(item) : (typeof RECIPES_DATABASE !== "undefined" ? RECIPES_DATABASE.find(r => r.name === item) : null);
                    if (recipe) {
                        desc = recipe.desc;
                        typeStr = recipe.type === "village_eat" ? "長效 Buff 料理" : "戰鬥回復料理";
                    }

                    const bp = typeof getItemBlueprintByName === "function" ? getItemBlueprintByName(item) : (typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS.find(b => b.name === item) : null);
                    if (bp) {
                        desc = bp.desc;
                        typeStr = "神裝藍圖產物";
                        statsStr += " | " + Object.keys(bp.stats).map(k => `${k}: +${bp.stats[k]}`).join(" | ");
                    }

                    return { title: item, type: typeStr, desc: desc, stats: statsStr };
                });
            } else {
                slot.innerHTML = `<span style="color:#444; font-size:10px;">空位</span>`;
            }
            bagContainer.appendChild(slot);
        }
    }

    syncMobileShellUI();
}

function getJobChineseName(j) {
    if (typeof JOB_DATABASE !== "undefined" && JOB_DATABASE[j]) {
        return JOB_DATABASE[j].name;
    }
    const jobNames = { 
        swordsman: "劍士", magician: "魔法師", acolyte: "服事", thief: "盜賊", archer: "弓箭手",
        knight: "騎士", crusader: "十字軍", wizard: "巫師", sage: "賢者", 
        priest: "祭司", monk: "武僧", assassin: "刺客", rogue: "流氓", hunter: "獵人", bard_dancer: "詩人/舞孃"
    };
    return jobNames[j] || "無名勇者";
}

function switchVillageLocation(targetLoc) {
    currentVillageLocation = targetLoc;

    const panels = ['v-loc-gate', 'v-loc-guild', 'v-loc-kitchen', 'v-loc-workshop', 'v-loc-square'];
    panels.forEach((panelId) => {
        const panel = DOM.get(panelId);
        if (!panel) return;
        panel.style.display = 'none';
        panel.setAttribute('aria-hidden', 'true');
    });

    const tabs = { GATE: 'btn-tab-gate', GUILD: 'btn-tab-guild', KITCHEN: 'btn-tab-kitchen', WORKSHOP: 'btn-tab-workshop', SQUARE: 'btn-tab-square' };
    Object.keys(tabs).forEach((location) => {
        const tab = DOM.get(tabs[location]);
        if (!tab) return;
        const isActive = location === targetLoc;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-pressed', String(isActive));
    });

    const locTextEl = DOM.get('location-text');
    const locMap = {
        GATE: { el: 'v-loc-gate', text: '⛺ 地表村莊 ➔ 傳送大殿' },
        GUILD: { el: 'v-loc-guild', text: '🏛️ 地表村莊 ➔ 冒險者公會', render: renderVillageGuild },
        WORKSHOP: { el: 'v-loc-workshop', text: '🛠️ 地表村莊 ➔ 魔導加工所', render: renderVillageWorkshop },
        KITCHEN: { el: 'v-loc-kitchen', text: '🍳 地表村莊 ➔ 皇家料理屋', render: renderVillageCookingWorkshop },
        SQUARE: { el: 'v-loc-square', text: '💬 地表村莊 ➔ 中央廣場', render: renderVillageSquare }
    };

    if (locMap[targetLoc]) {
        const target = locMap[targetLoc];
        const panel = DOM.get(target.el);
        if (panel) {
            panel.style.display = 'block';
            panel.setAttribute('aria-hidden', 'false');
        }
        if (locTextEl) locTextEl.textContent = target.text;
        if (target.render) target.render();
    }

    updateUI();
}

// --------------------------------------------------------------------------
// 🛠️ updateUI 核心更新
// --------------------------------------------------------------------------

let battleSceneLogLines = [];
let battleSceneTypingTimers = [null, null];
let battleSceneLogSequence = 0;
let battleSceneTerminalUntil = 0;
let battleSceneTerminalSnapshot = null;
let battleSceneTerminalTimer = null;
let battleSceneEncounterIntroTimer = null;
let battleSceneReturnTimer = null;
let battleSceneEncounterPlaceholder = null;
let battleSkillCastCueTimer = null;

function restoreBattleSceneAfterEncounterIntro() {
    const scene = DOM.get('battle-scene-box');
    if (battleSceneEncounterIntroTimer !== null) clearTimeout(battleSceneEncounterIntroTimer);
    battleSceneEncounterIntroTimer = null;
    if (battleSceneReturnTimer !== null) clearTimeout(battleSceneReturnTimer);
    battleSceneReturnTimer = null;
    if (scene && battleSceneEncounterPlaceholder?.parentNode) {
        battleSceneEncounterPlaceholder.parentNode.insertBefore(scene, battleSceneEncounterPlaceholder);
    }
    if (battleSceneEncounterPlaceholder?.parentNode) battleSceneEncounterPlaceholder.remove();
    battleSceneEncounterPlaceholder = null;
    if (scene) {
        scene.classList?.remove('is-encounter-cinematic');
        scene.classList?.remove('is-returning-to-origin');
        ['--battle-scene-origin-top', '--battle-scene-origin-left', '--battle-scene-origin-width', '--battle-scene-origin-height']
            .forEach((property) => scene.style.removeProperty(property));
    }
    if (typeof document !== "undefined") {
        document.body?.classList?.remove('battle-scene-cinematic-active');
        document.body?.classList?.remove('battle-scene-cinematic-returning');
    }
}

function returnBattleSceneAfterResult(delay = 2000) {
    const scene = DOM.get('battle-scene-box');
    if (!scene?.classList?.contains('is-encounter-cinematic')) return false;
    if (battleSceneReturnTimer !== null) clearTimeout(battleSceneReturnTimer);
    battleSceneReturnTimer = setTimeout(() => {
        battleSceneReturnTimer = null;
        scene.classList.add('is-returning-to-origin');
        if (typeof document !== "undefined") document.body?.classList?.add('battle-scene-cinematic-returning');
        const returnDuration = typeof prefersReducedMotion === "function" && prefersReducedMotion() ? 1 : 500;
        if (battleSceneEncounterIntroTimer !== null) clearTimeout(battleSceneEncounterIntroTimer);
        battleSceneEncounterIntroTimer = setTimeout(() => {
            restoreBattleSceneAfterEncounterIntro();
            if (typeof updateUI === "function") updateUI();
        }, returnDuration);
    }, Math.max(0, Number(delay) || 0));
    return true;
}

function playBattleSceneEncounterIntro() {
    const scene = DOM.get('battle-scene-box');
    if (typeof document === "undefined" || !document.body || !scene || !scene.parentNode || typeof scene.getBoundingClientRect !== "function") return 0;
    restoreBattleSceneAfterEncounterIntro();

    const rect = scene.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;
    const computed = typeof getComputedStyle === "function" ? getComputedStyle(scene) : null;
    const placeholder = document.createElement('div');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.cssText = `width:${rect.width}px;height:${rect.height}px;margin:${computed?.margin || "0"};grid-column:${computed?.gridColumn || "auto"};grid-row:${computed?.gridRow || "auto"};align-self:${computed?.alignSelf || "auto"};justify-self:${computed?.justifySelf || "auto"};visibility:hidden;pointer-events:none;`;
    scene.parentNode.insertBefore(placeholder, scene);
    battleSceneEncounterPlaceholder = placeholder;
    document.body.appendChild(scene);

    scene.style.setProperty('--battle-scene-origin-top', `${rect.top}px`);
    scene.style.setProperty('--battle-scene-origin-left', `${rect.left}px`);
    scene.style.setProperty('--battle-scene-origin-width', `${rect.width}px`);
    scene.style.setProperty('--battle-scene-origin-height', `${rect.height}px`);
    document.body.classList.add('battle-scene-cinematic-active');
    scene.classList.add('is-encounter-cinematic');

    const duration = typeof prefersReducedMotion === "function" && prefersReducedMotion() ? 1 : 420;
    return duration;
}

function getBattleDiaryTone(text, logType = "deal") {
    if (/VICTORY!|討伐成功/i.test(text)) return "victory";
    if (/暴擊|爆擊|critical/i.test(text)) return "critical";
    if (logType === "take" || /你已被擊敗|受到.{0,8}傷害|扣減.{0,8}HP|反噬/.test(text)) return "damage";
    if (logType === "miss" || /\bMISS\b|未命中/i.test(text)) return "miss";
    if (/回復|治癒|補滿|治療|\+\d+\s*(HP|MP)/i.test(text)) return "heal";
    if (logType === "skill-hit" || /基本攻擊|發動攻擊|造成.{0,8}傷害|攻擊命中/.test(text)) return "attack";
    return "status";
}

function setBattleDiaryLine(element, index, entry, animate) {
    if (!element) return;
    const text = entry?.text || "";
    const tone = entry?.tone || "status";
    const entryId = String(entry?.id ?? "static");
    if (!element.dataset) element.dataset = {};
    if (element.dataset.entryId === entryId && element.dataset.targetText === text && element.dataset.tone === tone) return;

    if (battleSceneTypingTimers[index] !== null) clearInterval(battleSceneTypingTimers[index]);
    battleSceneTypingTimers[index] = null;
    element.dataset.targetText = text;
    element.dataset.tone = tone;
    element.dataset.entryId = entryId;
    element.className = `battle-scene-log-line battle-log-line--${tone}`;

    const reduceMotion = typeof prefersReducedMotion === "function" && prefersReducedMotion();
    if (!animate || !text || reduceMotion) {
        element.textContent = text;
        element.classList?.remove("is-typing");
        return;
    }

    const segments = typeof Intl !== "undefined" && Intl.Segmenter
        ? Array.from(new Intl.Segmenter("zh-Hant", { granularity: "grapheme" }).segment(text), (part) => part.segment)
        : Array.from(text);
    let visibleCount = 0;
    element.textContent = "";
    element.classList?.add("is-typing");
    battleSceneTypingTimers[index] = setInterval(() => {
        visibleCount += 1;
        element.textContent = segments.slice(0, visibleCount).join("");
        if (visibleCount >= segments.length) {
            clearInterval(battleSceneTypingTimers[index]);
            battleSceneTypingTimers[index] = null;
            element.classList?.remove("is-typing");
        }
    }, 22);
}

function renderBattleSceneLog(animateLatest = false) {
    const firstEntry = battleSceneLogLines[0] || { text: "發現魔物", tone: "status" };
    const secondEntry = battleSceneLogLines[1] || { text: "戰鬥開始！", tone: "status" };
    setBattleDiaryLine(DOM.get('battle-scene-log-line-1'), 0, firstEntry, false);
    setBattleDiaryLine(DOM.get('battle-scene-log-line-2'), 1, secondEntry, animateLatest);
}

function syncBattleSceneLog(message, logType = "deal") {
    const text = String(message || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const foundMonster = /發現(?:大領主|魔物)/.test(text);
    if (foundMonster) {
        restoreBattleSceneAfterEncounterIntro();
        battleSceneLogLines = [];
        battleSceneTypingTimers.forEach((timer, index) => {
            if (timer !== null) clearInterval(timer);
            battleSceneTypingTimers[index] = null;
        });
        battleSceneTerminalUntil = 0;
        battleSceneTerminalSnapshot = null;
        if (battleSceneTerminalTimer !== null) clearTimeout(battleSceneTerminalTimer);
        battleSceneTerminalTimer = null;
    }

    const victory = /VICTORY!/i.test(text);
    const defeat = /你已被擊敗/.test(text);
    const inBattle = typeof gameState !== "undefined" && gameState === "BATTLE";
    if (!inBattle && !victory && !defeat) return;
    if (battleSceneTerminalUntil > Date.now()) return;

    battleSceneLogLines.push({ id: ++battleSceneLogSequence, text, tone: getBattleDiaryTone(text, logType) });
    if (battleSceneLogLines.length > 2) battleSceneLogLines = battleSceneLogLines.slice(-2);
    renderBattleSceneLog(true);

    if (victory || defeat) {
        const monster = typeof activeMonster !== "undefined" && activeMonster ? activeMonster : null;
        battleSceneTerminalSnapshot = {
            monster: monster ? {
                name: monster.name, hp: monster.hp, maxHp: monster.maxHp,
                shield: monster.shield, isBoss: monster.isBoss
            } : null,
            hp: typeof currentRun !== "undefined" ? currentRun?.hp : 0,
            maxHp: typeof currentRun !== "undefined" ? currentRun?.maxHp : 0,
            mp: typeof currentRun !== "undefined" ? currentRun?.mp : 0,
            maxMp: typeof currentRun !== "undefined" ? currentRun?.maxMp : 0,
            playerAtb: typeof playerAtb !== "undefined" ? playerAtb : 0,
            monsterAtb: typeof monsterAtb !== "undefined" ? monsterAtb : 0
        };
        battleSceneTerminalUntil = Date.now() + 2500;
        returnBattleSceneAfterResult(2000);
        if (battleSceneTerminalTimer !== null) clearTimeout(battleSceneTerminalTimer);
        battleSceneTerminalTimer = setTimeout(() => {
            battleSceneTerminalUntil = 0;
            battleSceneTerminalSnapshot = null;
            battleSceneTerminalTimer = null;
            if (typeof updateUI === "function") updateUI();
        }, 2500);
    }
}

const BATTLE_MONSTER_PORTRAIT_OVERRIDES = Object.freeze({
    "💧 藍色史萊姆": "assets/combat/monsters/regular-01-blue-slime.png",
    "👺 綠皮哥布林": "assets/combat/monsters/regular-02-green-goblin.png",
    "🐗 荒野半獸人": "assets/combat/monsters/regular-03-wild-orc.png",
    "👻 迷途哭泣怨靈": "assets/combat/monsters/regular-04-lost-wailing-wraith.png",
    "🧱 古墓巨石守衛": "assets/combat/monsters/regular-05-ancient-tomb-stone-guardian.png",
    "❄️ 冰川小惡魔": "assets/combat/monsters/regular-06-glacier-little-demon.png",
    "🕷️ 地底毒牙蛛": "assets/combat/monsters/regular-07-underground-venomfang-spider.png",
    "🧟 復甦凍僵腐屍": "assets/combat/monsters/regular-08-revived-frozen-corpse.png"
});

function getBattleMonsterSpriteVariant(monster) {
    if (!monster) return "";
    const name = String(monster.name || "");
    if (/魔神|惡魔|魔王|狂魔|demon|devil/i.test(name)) return "demon";
    if (/史萊姆|slime/i.test(name)) return "slime";
    if (/怨靈|幽靈|亡靈|腐屍|死神|骷髏|殭屍|魔靈|ghost|undead|corpse|reaper|skeleton/i.test(name)) return "undead";
    return "";
}

function setBattleMeter(element, value, maximum) {
    if (!element) return;
    const max = Math.max(1, Number(maximum) || 1);
    const current = Math.max(0, Math.min(max, Number(value) || 0));
    element.style.width = `${Math.round((current / max) * 100)}%`;
}

function getBattleSkillCastTone(fxClass = "", effect = {}) {
    const token = String(fxClass || "").toLowerCase();
    if (/fire|flame|burn/.test(token)) return "fire";
    if (/ice|frost|freeze/.test(token)) return "ice";
    if (/lightning|thunder|bolt/.test(token)) return "lightning";
    if (/holy|heal|priest/.test(token)) return "holy";
    if (/shadow|poison|dark/.test(token)) return "shadow";
    if (effect?.isMagic) return "lightning";
    return "physical";
}

function showBattleSkillCastCue(skillName, fxClass = "", effect = {}) {
    const cue = DOM.get('battle-skill-cast-cue');
    if (!cue || !skillName) return false;
    cue.dataset.castTone = getBattleSkillCastTone(fxClass, effect);
    cue.textContent = `✦ ${String(skillName)}`;
    cue.classList.remove('is-active');
    void cue.offsetWidth;
    cue.classList.add('is-active');
    if (battleSkillCastCueTimer !== null) clearTimeout(battleSkillCastCueTimer);
    const duration = typeof prefersReducedMotion === "function" && prefersReducedMotion() ? 1 : 760;
    battleSkillCastCueTimer = setTimeout(() => {
        cue.classList.remove('is-active');
        battleSkillCastCueTimer = null;
    }, duration);
    return true;
}

function setBattleMonsterInspectVisibility(visible) {
    const card = DOM.get('battle-monster-inspect-card');
    if (!card) return;
    card.classList.toggle('is-visible', Boolean(visible));
    card.setAttribute('aria-hidden', String(!visible));
}

function bindBattleMonsterInspectHover(...targets) {
    targets.filter(Boolean).forEach((target) => {
        if (target.dataset?.inspectBound === "true") return;
        if (target.dataset) target.dataset.inspectBound = "true";
        target.addEventListener('mouseenter', () => setBattleMonsterInspectVisibility(true));
        target.addEventListener('mouseleave', () => setBattleMonsterInspectVisibility(false));
        target.addEventListener('focus', () => setBattleMonsterInspectVisibility(true));
        target.addEventListener('blur', () => setBattleMonsterInspectVisibility(false));
    });
}

function updateBattleMonsterInspectCard(monster) {
    const card = DOM.get('battle-monster-inspect-card');
    if (!card || !monster) return;
    const name = String(monster.name || "深淵魔物");
    const category = monster.isBoss ? "首領" : (monster.isElite ? "菁英" : "一般");
    const hp = Math.max(0, Number(monster.hp) || 0);
    const maxHp = Math.max(0, Number(monster.maxHp) || 0);
    const defense = Math.max(0, Number(monster.def) || 0);
    const magicDefense = Math.max(0, Number(monster.mdef) || 0);
    const details = [];
    const setText = (id, text) => {
        const element = DOM.get(id);
        if (element) element.textContent = text;
    };
    if (monster.weakness) details.push(`弱點：${monster.weakness}`);
    if (Number(monster.shield) > 0) details.push(`護盾：${Math.floor(Number(monster.shield))}`);
    if (monster.attackType === "magic") details.push("魔法攻擊");
    setText('battle-monster-inspect-name', name);
    setText('battle-monster-inspect-type', category);
    setText('battle-monster-inspect-desc', String(monster.desc || "深淵威脅生物。留意牠的行動條與攻擊節奏。"));
    setText('battle-monster-inspect-hp', `HP ${hp} / ${maxHp}`);
    setText('battle-monster-inspect-atk', `ATK ${Math.max(0, Number(monster.atk) || 0)}`);
    setText('battle-monster-inspect-def', `DEF ${defense} · MDEF ${magicDefense}`);
    setText('battle-monster-inspect-spd', `SPD ${Math.max(0, Number(monster.spd) || 0)}`);
    setText('battle-monster-inspect-extra', details.join(" · ") || "無特別弱點");
}

function appendCombatCommandButton(container, label, onClick, disabled = false, title = "") {
    const button = document.createElement('button');
    button.type = "button";
    button.className = "battle-command-option";
    const labelElement = document.createElement('span');
    labelElement.className = "combat-command-label";
    labelElement.textContent = label;
    button.appendChild(labelElement);
    button.disabled = disabled;
    if (title) {
        button.title = title;
        button.dataset.tooltip = title;
        button.setAttribute('aria-label', `${label}。${title}`);
    }
    button.addEventListener('click', onClick);
    container.appendChild(button);
    return button;
}

function populateCombatCommandOptions(container, kind, mode) {
    if (!container) return;
    container.innerHTML = "";
    const isManual = mode === "manual";
    if (kind === "skills") {
        const skills = typeof getAllSkillsForJob === "function" ? getAllSkillsForJob(currentRun?.job) : [];
        const learned = skills.filter((skillMeta) => skillMeta.type === "active" && Number(currentRun?.skills?.[skillMeta.name]) > 0);
        if (!learned.length) {
            container.textContent = "尚未學會可用的主動技能。";
            return;
        }
        learned.forEach((skillMeta) => {
            const level = Number(currentRun.skills[skillMeta.name]) || 0;
            const cost = Math.max(0, Number(skillMeta.mp) || 0);
            const cooldown = typeof getSkillCooldownRemaining === "function" ? getSkillCooldownRemaining(skillMeta) : 0;
            const disabled = Number(currentRun.mp) < cost || cooldown > 0;
            const label = `${skillMeta.name} Lv.${level} · MP ${cost}${cooldown > 0 ? ` · CD ${cooldown}s` : ""}`;
            const configuredCooldown = typeof getSkillCooldownSeconds === "function" ? getSkillCooldownSeconds(skillMeta) : 0;
            const detail = [
                skillMeta.desc || "施放職業專屬戰技。",
                `消耗 ${cost} MP`,
                configuredCooldown > 0 ? `冷卻 ${configuredCooldown} 秒` : "無冷卻"
            ].join(" · ");
            appendCombatCommandButton(container, label, () => {
                if (isManual) submitManualBattleCommand("skill", skillMeta.id);
                else queueSemiCombatCommand("skill", skillMeta.id);
            }, disabled, detail);
        });
        return;
    }

    const inventory = Array.isArray(currentRun?.inventory) ? currentRun.inventory : [];
    const usableItems = inventory
        .map((itemName, index) => ({ itemName: String(itemName || ""), index }))
        .filter((entry) => typeof isUsableCombatItem === "function" && isUsableCombatItem(entry.itemName));
    if (!usableItems.length) {
        container.textContent = "背包中沒有可在戰鬥使用的道具。";
        return;
    }
    usableItems.forEach(({ itemName, index }) => {
        appendCombatCommandButton(container, itemName, () => {
            if (isManual) submitManualBattleCommand("item", index);
            else queueSemiCombatCommand("item", index);
        });
    });
}

function openManualBattleCommandList(kind) {
    if (!manualTurnPaused || !["skills", "items"].includes(kind)) return false;
    const categories = DOM.get('battle-command-categories');
    const options = DOM.get('battle-command-options');
    const back = DOM.get('battle-command-back');
    if (!categories || !options || !back) return false;
    categories.style.display = "none";
    options.style.display = "flex";
    populateCombatCommandOptions(options, kind, "manual");
    back.style.display = "block";
    return true;
}

function closeManualBattleCommandList() {
    const categories = DOM.get('battle-command-categories');
    const options = DOM.get('battle-command-options');
    const back = DOM.get('battle-command-back');
    if (!categories || !options || !back) return false;
    options.innerHTML = "";
    options.style.display = "none";
    categories.style.display = "flex";
    back.style.display = "none";
    return true;
}

function openSemiCombatCommandList(kind) {
    if (activeTactic !== "SEMI" || !["skills", "items"].includes(kind)) return false;
    const options = DOM.get('semi-command-options');
    if (!options) return false;
    options.style.display = "flex";
    populateCombatCommandOptions(options, kind, "semi");
    const back = document.createElement('button');
    back.type = "button";
    back.textContent = "↩ 返回";
    back.addEventListener('click', () => { options.innerHTML = ""; });
    options.appendChild(back);
    return true;
}

function updateBattleScene(monster) {
    const scene = DOM.get('battle-scene-box');
    if (!scene) return;
    const terminalVisible = battleSceneTerminalSnapshot && Date.now() < battleSceneTerminalUntil;
    const sceneMonster = monster || (terminalVisible ? battleSceneTerminalSnapshot.monster : null);
    const inBattle = typeof gameState !== "undefined" && gameState === "BATTLE" && monster &&
        typeof currentRun !== "undefined" && currentRun;
    const showResult = Boolean(terminalVisible && sceneMonster && typeof currentRun !== "undefined" && currentRun);
    const showScene = Boolean(inBattle || showResult);
    scene.style.display = showScene ? "block" : "none";
    const commandPanel = DOM.get('battle-command-panel');
    const commandStatus = DOM.get('battle-command-status');
    const commandCategories = DOM.get('battle-command-categories');
    const commandOptions = DOM.get('battle-command-options');
    const commandBack = DOM.get('battle-command-back');
    const showManualCommands = Boolean(inBattle && typeof manualTurnPaused !== "undefined" && manualTurnPaused);
    if (commandPanel) {
        if (showManualCommands && commandPanel.style.display !== "grid") {
            if (commandCategories) commandCategories.style.display = "flex";
            if (commandOptions) { commandOptions.innerHTML = ""; commandOptions.style.display = "none"; }
            if (commandBack) commandBack.style.display = "none";
        }
        commandPanel.style.display = showManualCommands ? "grid" : "none";
    }
    if (commandStatus && showManualCommands) commandStatus.textContent = "Your Turn..";
    const semiControls = DOM.get('semi-command-controls');
    if (semiControls) semiControls.style.display = Boolean(inBattle && activeTactic === "SEMI") ? "block" : "none";
    const semiStatus = DOM.get('semi-command-status');
    if (semiStatus && typeof pendingCombatCommand !== "undefined") {
        const pending = pendingCombatCommand;
        const name = pending?.skillName || pending?.itemName || (pending?.type === "basic" ? "普攻" : "行動");
        semiStatus.textContent = pending ? `已預約：${name}（於下次我方 ATB 行動執行）` : "尚無預約行動。";
    }
    if (!showScene) {
        setBattleMonsterInspectVisibility(false);
        return;
    }

    const heroName = (accountMeta && accountMeta.name) || "冒險者";
    const displayedMonster = sceneMonster;
    const variant = getBattleMonsterSpriteVariant(displayedMonster);
    const image = DOM.get('battle-monster-sprite');
    const fallback = DOM.get('battle-monster-fallback');
    const variantPaths = {
        slime: "assets/combat/monster-slime.png",
        undead: "assets/combat/monster-undead.png",
        demon: "assets/combat/monster-demon.png"
    };
    const explicitPortraitPath = BATTLE_MONSTER_PORTRAIT_OVERRIDES[String(displayedMonster.name || "")] || "";
    const spritePath = explicitPortraitPath || variantPaths[variant] || "";

    DOM.get('battle-player-name').textContent = heroName;
    const playerValues = showResult ? battleSceneTerminalSnapshot : currentRun;
    DOM.get('battle-player-hp-text').textContent = `HP ${Math.max(0, playerValues.hp || 0)} / ${playerValues.maxHp || 0}`;
    DOM.get('battle-player-mp-text').textContent = `MP ${Math.max(0, playerValues.mp || 0)} / ${playerValues.maxMp || 0}`;
    setBattleMeter(DOM.get('battle-player-hp-bar'), playerValues.hp, playerValues.maxHp);
    setBattleMeter(DOM.get('battle-player-mp-bar'), playerValues.mp, playerValues.maxMp);
    const playerAtbPercent = Math.min(100, Math.max(0, showResult ? battleSceneTerminalSnapshot.playerAtb : (typeof playerAtb !== "undefined" ? playerAtb : 0)));
    DOM.get('battle-player-atb-text').textContent = `${Math.floor(playerAtbPercent)}%`;
    setBattleMeter(DOM.get('battle-player-atb-bar'), playerAtbPercent, 100);
    const cooldownEl = DOM.get('battle-skill-cooldowns');
    if (cooldownEl) {
        const knownSkills = typeof getAllSkillsForJob === "function" ? getAllSkillsForJob(currentRun.job) : [];
        const cooldownNames = knownSkills
            .filter((skillMeta) => skillMeta.type === "active" && Number(currentRun.skills?.[skillMeta.name]) > 0)
            .map((skillMeta) => ({ name: skillMeta.name, seconds: typeof getSkillCooldownRemaining === "function" ? getSkillCooldownRemaining(skillMeta) : 0 }))
            .filter((entry) => entry.seconds > 0)
            .map((entry) => `${entry.name} ${entry.seconds}s`);
        cooldownEl.textContent = cooldownNames.length ? `⏳ CD：${cooldownNames.join(" · ")}` : "";
        cooldownEl.title = cooldownNames.length ? cooldownNames.join("、") : "";
        cooldownEl.style.display = cooldownNames.length ? "block" : "none";
    }

    DOM.get('battle-monster-name').textContent = displayedMonster.name || "深淵魔物";
    DOM.get('battle-monster-hp-text').textContent = `HP ${Math.max(0, displayedMonster.hp || 0)} / ${displayedMonster.maxHp || 0}`;
    DOM.get('battle-monster-shield-text').textContent = Number(displayedMonster.shield) > 0 ? `🛡️ 護盾 ${displayedMonster.shield}` : "";
    setBattleMeter(DOM.get('battle-monster-hp-bar'), displayedMonster.hp, displayedMonster.maxHp);
    const monsterAtbPercent = Math.min(100, Math.max(0, showResult ? battleSceneTerminalSnapshot.monsterAtb : (typeof monsterAtb !== "undefined" ? monsterAtb : 0)));
    DOM.get('battle-monster-atb-text').textContent = `${Math.floor(monsterAtbPercent)}%`;
    setBattleMeter(DOM.get('battle-monster-atb-bar'), monsterAtbPercent, 100);
    renderBattleSceneLog();

    scene.classList.toggle('is-result', Boolean(showResult));
    scene.classList.toggle('is-boss-battle', Boolean(displayedMonster.isBoss));
    const environmentKey = typeof currentEnvironment === "string" ? currentEnvironment : "NORMAL";
    ["NORMAL", "VOID", "ICE", "FIRE", "POISON"].forEach((key) => {
        scene.classList.toggle(`is-${key.toLowerCase()}-zone`, environmentKey === key);
    });
    if (image) {
        image.classList.toggle('battle-boss-sprite', Boolean(displayedMonster.isBoss));
        image.hidden = !spritePath;
        image.alt = `檢視 ${displayedMonster.name || "魔物"} 資訊`;
        if (spritePath && image.dataset.variant !== spritePath) {
            image.dataset.variant = spritePath;
            image.src = spritePath;
        }
    }
    if (fallback) {
        const leadingIcon = String(displayedMonster.name || "").match(/^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u);
        fallback.textContent = leadingIcon ? leadingIcon[0] : "👹";
        fallback.hidden = Boolean(spritePath);
        fallback.setAttribute('aria-label', `檢視 ${displayedMonster.name || "魔物"} 資訊`);
    }
    updateBattleMonsterInspectCard(displayedMonster);
    bindBattleMonsterInspectHover(image, fallback);
}

function updateUI() {
    initMobileShell();
    syncMobileShellPlacement();
    const titleBox = DOM.get('title-box');
    const statusBox = DOM.get('status-panel-box');
    const actionBox = DOM.get('action-panel-box');
    const villageBox = DOM.get('village-panel-box');
    const rewardBox = DOM.get('reward-panel-box');
    const logBox = DOM.get('log-box');
    const envBar = DOM.get('env-alert-bar');
    const autoBtn = DOM.get('btn-auto-battle');
    const logWrapper = DOM.get('log-wrapper-box');
    updateBattleScene(typeof activeMonster !== "undefined" ? activeMonster : null);

    if (typeof gameState !== "undefined" && gameState === "TITLE") {
        if (titleBox) titleBox.style.display = "block";
        if (statusBox) statusBox.style.display = "none";
        if (actionBox) actionBox.style.display = "none";
        if (villageBox) villageBox.style.display = "none";
        if (rewardBox) rewardBox.style.display = "none";
        if (logWrapper) logWrapper.style.display = "none";
        if (envBar) envBar.style.display = "none";
        if (autoBtn) autoBtn.style.display = "none";
        syncMobileShellUI();
        return;
    }
    
    if (gameState === "VILLAGE") {
        hideFloatingCard();
        if (titleBox) titleBox.style.display = "none"; 
        if (statusBox) statusBox.style.display = "grid";
        if (actionBox) actionBox.style.display = "flex";
        if (villageBox) villageBox.style.display = "block";
        if (rewardBox) rewardBox.style.display = "none";
        if (logWrapper) logWrapper.style.display = "block"; 
        if (envBar) envBar.style.display = "none";
        if (autoBtn) autoBtn.style.display = "none";
        const villageMonsterCard = DOM.get('monster-status-card');
        if (villageMonsterCard) {
            villageMonsterCard.style.display = "none";
            villageMonsterCard.classList.remove('monster-threat-high');
        }
        
        const drawer = DOM.get('tactics-drawer-box');
        if (drawer) drawer.classList.remove('expanded');
        const drawerTrigger = DOM.get('tactic-trigger-btn');
        if (drawerTrigger) drawerTrigger.setAttribute('aria-expanded', 'false');

        initSwipeNavigation();
        syncCharacterDataUi();
        updateActionPanelUI();
        return; 
    }

    if (gameState === "ENDING") {
        if (titleBox) titleBox.style.display = "none";
        if (statusBox) statusBox.style.display = "grid";
        if (actionBox) actionBox.style.display = "flex";
        if (villageBox) villageBox.style.display = "none";
        if (rewardBox) rewardBox.style.display = "none";
        if (logWrapper) logWrapper.style.display = "block";
        if (envBar) envBar.style.display = "none";
        if (autoBtn) autoBtn.style.display = "none";
        syncCharacterDataUi();
        updateActionPanelUI();
        return;
    }
    
    if (titleBox) titleBox.style.display = "none";
    if (statusBox) statusBox.style.display = "grid";
    if (actionBox) actionBox.style.display = "flex";
    if (villageBox) villageBox.style.display = "none";
    if (logBox) logBox.style.display = "block";
    if (logWrapper) logWrapper.style.display = "block"; 
    if (envBar) envBar.style.display = "block";
    if (autoBtn) autoBtn.style.display = "block"; 

    if (envBar && typeof ENVIRONMENT_DATABASE !== "undefined" && ENVIRONMENT_DATABASE[currentEnvironment]) {
        envBar.className = ENVIRONMENT_DATABASE[currentEnvironment].className;
        envBar.innerHTML = `${ENVIRONMENT_DATABASE[currentEnvironment].logText} (B${dungeonFloor}F)`;
        
        bindFloatingCard(envBar, () => ({
            title: ENVIRONMENT_DATABASE[currentEnvironment].name || "環境力場",
            type: "戰場環境",
            desc: ENVIRONMENT_DATABASE[currentEnvironment].desc || "該區域受異常力場覆蓋，影響屬力變化。",
            stats: ENVIRONMENT_DATABASE[currentEnvironment].logText
        }));
    }

    const monBox = DOM.get('monster-status-card');
    if (activeMonster && monBox) {
        monBox.style.display = "block";
        DOM.get('m-name').innerText = activeMonster.name;
        const monsterShield = Math.max(0, Number(activeMonster.shield) || 0);
        DOM.get('m-shield-text').innerText = monsterShield > 0 ? `🛡️ 護盾 ${monsterShield}` : "";
        DOM.get('m-hp-text').innerText = `${activeMonster.hp} / ${activeMonster.maxHp}`;
        
        updateHpBarWithGhost(activeMonster.hp, activeMonster.maxHp, 'm-hp-bar', 'm-hp-bar-ghost');

        DOM.get('m-atk').innerText = activeMonster.atk;
        DOM.get('m-spd').innerText = activeMonster.spd;

        const mAtbPercent = Math.min(100, Math.max(0, typeof monsterAtb !== "undefined" ? monsterAtb : 0));
        
        if (mAtbPercent >= 80) {
            monBox.classList.add('monster-threat-high');
        } else {
            monBox.classList.remove('monster-threat-high');
        }

        const weakElement = activeMonster.weakness ? `弱點: ${activeMonster.weakness}` : "無特別弱點";

        bindFloatingCard(monBox, () => ({
            title: activeMonster.name,
            type: "敵對魔物",
            desc: `${activeMonster.desc || "深淵威脅生物。"}<br><br>🎯 <b>弱點屬性:</b> <span style="color:#00ffcc;">${weakElement}</span>`,
            stats: `攻擊力: ${activeMonster.atk} | 速度: ${activeMonster.spd}`
        }));

        renderStatusBadges(DOM.get('monster-status-badges'), activeMonster.activeEffects);

        const mAtbRow = DOM.get('m-atb-row');
        if (mAtbRow) {
            mAtbRow.style.display = "block";
            const mAtbBar = DOM.get('m-atb-bar-fill');
            if (mAtbBar) {
                const currentW = parseFloat(mAtbBar.style.width) || 0;
                if (mAtbPercent < currentW) {
                    mAtbBar.style.transition = "none";
                    mAtbBar.style.width = "0%";
                    mAtbBar.offsetHeight; 
                }
                mAtbBar.style.transition = "width 0.25s linear"; 
                mAtbBar.style.width = `${mAtbPercent}%`;
            }
        }
    } else if (monBox) {
        monBox.style.display = "none";
        monBox.classList.remove('monster-threat-high');
        const mAtbRow = DOM.get('m-atb-row');
        if (mAtbRow) mAtbRow.style.display = "none";
    }

    if (rewardBox) {
        const hasRewardCards = rewardBox.querySelectorAll('.reward-card').length > 0;
        rewardBox.style.display = ((gameState === "REWARD" || gameState === "ENCOUNTER") && hasRewardCards) ? "block" : "none";
    }
    
    syncCharacterDataUi();
    updateActionPanelUI(); 
}

function formatSkillEffectText(s, lv, playerRun) {
    if (!lv || lv <= 0) return "未領悟";
    if (s.type === "passive") {
        if (s.passiveStats) {
            let statsArr = [];
            for (let k in s.passiveStats) {
                statsArr.push(`${k}: +${s.passiveStats[k]}`);
            }
            return `【被動屬性】${statsArr.join(", ")}`;
        }
        return "【被動常駐效果】";
    }

    const isMagicJob = (playerRun.job === "magician" || playerRun.job === "acolyte" || playerRun.job === "wizard" || playerRun.job === "priest" || playerRun.job === "sage");
    const baseAtk = isMagicJob ? (playerRun.matk || 10) : (playerRun.atk || 15);
    const maxMp = playerRun.maxMp || 100;
    const maxHp = playerRun.maxHp || 100;

    let eff = typeof s.run === "function" ? s.run(lv, baseAtk, maxMp, maxHp, maxHp) : null;
    if (!eff) return "無特定數值";

    let parts = [];
    if (eff.dmg) {
        let hits = eff.hitCount || (eff.isTripleHit ? 3 : (eff.isDoubleHit ? 2 : 1));
        parts.push(`合共傷害: <strong>${eff.dmg}</strong> (${hits} 連發)`);
    }
    if (eff.healAmount) parts.push(`回復: <strong>+${eff.healAmount} HP</strong>`);
    if (eff.healPercent) parts.push(`回復: <strong>+${Math.floor(maxHp * eff.healPercent)} HP (${Math.round(eff.healPercent * 100)}%)</strong>`);
    if (eff.mpRestore) parts.push(`魔力回復: <strong>+${eff.mpRestore} MP</strong>`);
    if (eff.shieldGain) parts.push(`護盾: <strong>+${eff.shieldGain} Shield</strong>`);
    if (eff.blockBuff) parts.push(`減傷: <strong>+${eff.blockBuff} Block</strong>`);
    if (eff.stunChance) parts.push(`眩暈: <strong>${eff.stunChance}%</strong>`);
    if (eff.freezeChance) parts.push(`凍結: <strong>${eff.freezeChance}%</strong>`);
    if (eff.burnStacks) parts.push(`燃燒: <strong>+${eff.burnStacks} 層</strong>`);
    if (eff.poisonStacks) parts.push(`劇毒: <strong>+${eff.poisonStacks} 層</strong>`);

    return parts.length > 0 ? parts.join(" | ") : "特殊效果觸發";
}

// --------------------------------------------------------------------------
// 🏛️ 村莊設施工作台：共用資料、摘要與材料狀態
// --------------------------------------------------------------------------

function getWarehouseCounts() {
    const warehouse = (typeof accountMeta !== 'undefined' && accountMeta?.warehouse) || {};
    const recipeNames = new Set(typeof RECIPES_DATABASE !== 'undefined' ? RECIPES_DATABASE.map((recipe) => recipe.name) : []);
    const blueprintNames = new Set(typeof CRAFTING_BLUEPRINTS !== 'undefined' ? CRAFTING_BLUEPRINTS.map((blueprint) => blueprint.name) : []);
    const counts = {
        totalTypes: 0,
        totalQty: 0,
        materialTypes: 0,
        materialQty: 0,
        dishTypes: 0,
        dishQty: 0,
        equipmentTypes: 0,
        equipmentQty: 0
    };

    Object.entries(warehouse).forEach(([name, rawQty]) => {
        const qty = Math.max(0, Number(rawQty) || 0);
        if (!qty) return;
        counts.totalTypes += 1;
        counts.totalQty += qty;
        if (recipeNames.has(name)) {
            counts.dishTypes += 1;
            counts.dishQty += qty;
        } else if (blueprintNames.has(name)) {
            counts.equipmentTypes += 1;
            counts.equipmentQty += qty;
        } else {
            counts.materialTypes += 1;
            counts.materialQty += qty;
        }
    });

    return counts;
}

function getIngredientAvailability(ingredients) {
    const warehouse = (typeof accountMeta !== 'undefined' && accountMeta?.warehouse) || {};
    const missing = [];
    Object.entries(ingredients || {}).forEach(([name, rawRequired]) => {
        const required = Math.max(0, Number(rawRequired) || 0);
        const owned = Math.max(0, Number(warehouse[name]) || 0);
        if (owned < required) missing.push({ name, required, owned, shortfall: required - owned });
    });
    return { isReady: missing.length === 0, missing };
}

function renderFacilityOverview(elementId, metrics) {
    const target = DOM.get(elementId);
    if (!target) return;
    target.innerHTML = metrics.map((metric) => `
        <div class="facility-metric${metric.tone ? ` facility-metric--${metric.tone}` : ''}">
            <span class="facility-metric-label">${metric.label}</span>
            <strong class="facility-metric-value">${metric.value}</strong>
        </div>
    `).join('');
}

function createIngredientChips(ingredients) {
    return Object.entries(ingredients || {}).map(([name, rawQty]) => (
        `<span class="facility-material-chip">🌾 ${name} ×${Math.max(0, Number(rawQty) || 0)}</span>`
    )).join('');
}

function createAvailabilityChip(availability, readyLabel = '材料齊全') {
    if (availability.isReady) {
        return `<span class="facility-status-chip facility-status-chip--ready">✓ ${readyLabel}</span>`;
    }
    const names = availability.missing.map((item) => item.name).join('、');
    return `<span class="facility-status-chip facility-status-chip--missing">缺少：${names}</span>`;
}

function normalizeWarehouseFilter(allowedKeys) {
    if (!allowedKeys.includes(activeWarehouseFilter)) activeWarehouseFilter = 'all';
}

function createWarehousePill(name, qty) {
    const pill = document.createElement('span');
    pill.className = 'warehouse-pill';
    const itemName = document.createElement('span');
    itemName.textContent = name;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `×${qty}`;
    pill.append(itemName, count);
    return pill;
}

function renderWarehouseFilterBar(containerEl, onFilterChange, allowedKeys = ['all', 'mat', 'dish', 'equip']) {
    if (!containerEl) return;
    const tags = [
        { key: 'all', label: '🌐 全部' },
        { key: 'mat', label: '🌾 食材素材' },
        { key: 'dish', label: '🍱 料理成品' },
        { key: 'equip', label: '⚔️ 裝備神裝' }
    ].filter((tag) => allowedKeys.includes(tag.key));

    normalizeWarehouseFilter(tags.map((tag) => tag.key));
    const filterRow = document.createElement('div');
    filterRow.className = 'warehouse-filter-row';
    filterRow.setAttribute('aria-label', '倉庫物品篩選');

    tags.forEach((tag) => {
        const button = document.createElement('button');
        const isActive = activeWarehouseFilter === tag.key;
        button.type = 'button';
        button.className = `warehouse-filter-button${isActive ? ' is-active' : ''}`;
        button.textContent = tag.label;
        button.setAttribute('aria-pressed', String(isActive));
        button.addEventListener('click', () => {
            activeWarehouseFilter = tag.key;
            onFilterChange();
        });
        filterRow.appendChild(button);
    });

    containerEl.appendChild(filterRow);
}

// --------------------------------------------------------------------------
// 🏛️ 冒險者公會渲染
// --------------------------------------------------------------------------

function renderVillageGuild() {
    const container = DOM.get('guild-skills-container');
    if (!container || typeof SKILLS_DATABASE === 'undefined') return;

    const playerLv = accountMeta.lv || currentRun.lv || 1;
    const currentJob = currentRun.job;
    const jobSkills = typeof getAllSkillsForJob === 'function' ? getAllSkillsForJob(currentJob) : (SKILLS_DATABASE[currentJob] || []);
    const learnedCount = jobSkills.filter((skill) => Number(accountMeta.skills?.[skill.name] || currentRun.skills?.[skill.name]) > 0).length;
    const jobName = getJobChineseName(currentJob);

    renderFacilityOverview('guild-overview', [
        { label: '目前職業', value: `🎭 ${jobName}`, tone: 'accent' },
        { label: '角色等級', value: `Lv. ${playerLv}` },
        { label: '已傳承技能', value: `${learnedCount} / ${jobSkills.length}`, tone: 'ready' },
        { label: '持有金幣', value: `${Math.max(0, Number(currentRun.gold) || 0)} G`, tone: 'gold' }
    ]);

    container.innerHTML = '';

    if (typeof canAdvanceJob === 'function' && canAdvanceJob(currentRun)) {
        const advancementBanner = document.createElement('div');
        advancementBanner.className = 'guild-advancement-banner';
        advancementBanner.innerHTML = `
            <div>
                <strong>🌟 血脈突破資格已達成</strong>
                <span>你已符合皇家二轉儀式條件，可選擇下一階職業專精。</span>
            </div>
        `;
        const advancementButton = document.createElement('button');
        advancementButton.type = 'button';
        advancementButton.className = 'btn-game btn-rerun facility-action-button';
        advancementButton.textContent = '🏇 開啟二轉選擇';
        advancementButton.addEventListener('click', () => {
            if (typeof openJobAdvancementModal === 'function') openJobAdvancementModal();
            else showToast('二轉系統載入中...', 'info');
        });
        advancementBanner.appendChild(advancementButton);
        container.appendChild(advancementBanner);
    }

    if (jobSkills.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'facility-empty-state';
        empty.textContent = '此職業暫無可傳承技能。';
        container.appendChild(empty);
    }

    jobSkills.forEach((skill) => {
        const currentLv = Number(accountMeta.skills?.[skill.name] || currentRun.skills?.[skill.name]) || 0;
        const isMaxLevel = currentLv >= 10;
        const nextLv = currentLv + 1;
        const goldCost = (Number(skill.goldCost) || 0) * nextLv;
        const hasLevel = playerLv >= (Number(skill.reqLv) || 1);
        const hasGold = (Number(currentRun.gold) || 0) >= goldCost;
        const requiredMaterials = {};
        Object.entries(skill.reqMat || {}).forEach(([name, baseQty]) => {
            requiredMaterials[name] = (Number(baseQty) || 0) * nextLv;
        });
        const availability = getIngredientAvailability(requiredMaterials);
        const isDisabled = isMaxLevel || !hasLevel || !hasGold || !availability.isReady;
        const currentEffect = formatSkillEffectText(skill, currentLv, currentRun);
        const nextEffect = isMaxLevel ? '已達上限' : formatSkillEffectText(skill, nextLv, currentRun);
        const skillType = skill.type === 'passive' ? '被動常駐' : `主動 · MP ${skill.mp || 0}`;

        let statusLabel = '可升級';
        let statusClass = 'facility-status-chip--ready';
        if (isMaxLevel) {
            statusLabel = '已達滿級';
            statusClass = '';
        } else if (!hasLevel) {
            statusLabel = `Lv. ${skill.reqLv} 解鎖`;
            statusClass = 'facility-status-chip--missing';
        } else if (!hasGold) {
            statusLabel = `需 ${goldCost} G`;
            statusClass = 'facility-status-chip--missing';
        } else if (!availability.isReady) {
            statusLabel = `缺少 ${availability.missing.length} 種素材`;
            statusClass = 'facility-status-chip--missing';
        }

        const card = document.createElement('article');
        card.className = 'guild-skill-card';
        card.innerHTML = `
            <div>
                <div class="guild-skill-card__name">${skill.name} <span class="guild-skill-card__level">Lv. ${currentLv} / 10</span></div>
                <div class="facility-compact-meta">
                    <span class="guild-skill-card__type">${skillType}</span>
                    <span class="facility-status-chip ${statusClass}">${statusLabel}</span>
                    <span class="facility-detail-hint">⌁ 查看詳情</span>
                </div>
            </div>
        `;

        const learnButton = document.createElement('button');
        learnButton.type = 'button';
        learnButton.className = 'btn-game btn-explore facility-action-button';
        learnButton.textContent = isMaxLevel ? '滿級' : `升級 · ${goldCost}G`;
        learnButton.disabled = isDisabled;
        learnButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (typeof executeLearnSkill === 'function') executeLearnSkill(skill);
            else showToast('技能學習模組未載入', 'warn');
        });
        card.appendChild(learnButton);

        const materialText = Object.entries(requiredMaterials).map(([name, qty]) => `${name} ×${qty}`).join('、');
        bindFloatingCard(card, () => ({
            title: `${skill.name} (Lv.${currentLv})`,
            type: skill.type === 'passive' ? '被動技能' : `主動技能 (MP: ${skill.mp || 0})`,
            desc: `${skill.desc || '職業專屬技能。'}<br><br>🔹 當前威力: ${currentEffect}<br>${isMaxLevel ? '' : `⚡ 下級突破: ${nextEffect}`}`,
            stats: isMaxLevel ? '已達最高等級' : `升級所需: 🪙 ${goldCost} G ${materialText ? `| 📦 ${materialText}` : ''}`
        }));
        container.appendChild(card);
    });

    const resetSection = document.createElement('section');
    resetSection.className = 'guild-reset-section';
    resetSection.innerHTML = `
        <h5 class="guild-reset-section__heading">⚖️ 命運洗禮</h5>
        <p class="guild-reset-section__description">重置能力點或重選職業會影響角色配置，請在出發前確認。</p>
        <div class="guild-reset-section__actions"></div>
    `;
    const resetActions = resetSection.querySelector('.guild-reset-section__actions');
    const resetStatsButton = document.createElement('button');
    resetStatsButton.type = 'button';
    resetStatsButton.className = 'btn-game btn-rerun';
    resetStatsButton.textContent = '🧹 重洗屬性點 · 300G';
    resetStatsButton.addEventListener('click', () => {
        if (typeof executeResetStats === 'function') executeResetStats();
        else showToast('洗點模組載入中...', 'info');
    });
    const reselectJobButton = document.createElement('button');
    reselectJobButton.type = 'button';
    reselectJobButton.className = 'btn-game btn-explore';
    reselectJobButton.textContent = '🔄 重選職業 · 1,000G';
    reselectJobButton.addEventListener('click', () => {
        if (typeof triggerReselectJobUI === 'function') triggerReselectJobUI();
        else showToast('轉職模組載入中...', 'info');
    });
    resetActions.append(resetStatsButton, reselectJobButton);
    container.appendChild(resetSection);
}

// 🎯 相容性別名宣告
function closeMatAlertModal() {
    hideMaterialAlert();
}

// --------------------------------------------------------------------------
// 🍳 皇家料理屋渲染
// --------------------------------------------------------------------------

function renderVillageCookingWorkshop() {
    const recipes = typeof RECIPES_DATABASE !== 'undefined' ? RECIPES_DATABASE : [];
    const warehouse = accountMeta.warehouse || {};
    const counts = getWarehouseCounts();
    const craftableRecipes = recipes.filter((recipe) => getIngredientAvailability(recipe.ingredients).isReady).length;

    renderFacilityOverview('kitchen-overview', [
        { label: '食材種類', value: `${counts.materialTypes} 種` },
        { label: '食材存量', value: `${counts.materialQty} 個`, tone: 'accent' },
        { label: '完成料理', value: `${counts.dishQty} 份` },
        { label: '可烹飪食譜', value: `${craftableRecipes} 道`, tone: 'ready' }
    ]);

    normalizeWarehouseFilter(['all', 'mat', 'dish']);
    const warehouseBox = DOM.get('kitchen-warehouse-display');
    if (warehouseBox) {
        warehouseBox.className = 'facility-stock-card';
        warehouseBox.innerHTML = '';

        const summary = document.createElement('div');
        summary.className = 'facility-stock-summary';
        summary.innerHTML = `<span>目前倉庫共有 <strong>${counts.totalTypes}</strong> 種物品</span><span>${counts.totalQty} 件</span>`;
        warehouseBox.appendChild(summary);
        renderWarehouseFilterBar(warehouseBox, renderVillageCookingWorkshop, ['all', 'mat', 'dish']);

        const recipeNames = new Set(recipes.map((recipe) => recipe.name));
        const blueprintNames = new Set(typeof CRAFTING_BLUEPRINTS !== 'undefined' ? CRAFTING_BLUEPRINTS.map((blueprint) => blueprint.name) : []);
        const rawMaterials = [];
        const cookedDishes = [];
        Object.entries(warehouse).forEach(([name, rawQty]) => {
            const qty = Math.max(0, Number(rawQty) || 0);
            if (!qty) return;
            const isDish = recipeNames.has(name);
            const isEquipment = blueprintNames.has(name);
            if (isEquipment) return;
            if (activeWarehouseFilter === 'mat' && isDish) return;
            if (activeWarehouseFilter === 'dish' && !isDish) return;
            if (isDish) cookedDishes.push({ name, qty });
            else rawMaterials.push({ name, qty });
        });

        if (activeWarehouseFilter !== 'dish') {
            const materialTitle = document.createElement('div');
            materialTitle.className = 'facility-stock-summary';
            materialTitle.innerHTML = `<span>🌾 食材素材</span><span>${rawMaterials.length} 種</span>`;
            warehouseBox.appendChild(materialTitle);
            const materialBox = document.createElement('div');
            materialBox.className = 'warehouse-pill-box';
            if (rawMaterials.length) rawMaterials.forEach((item) => materialBox.appendChild(createWarehousePill(item.name, item.qty)));
            else materialBox.innerHTML = '<div class="facility-empty-state">目前沒有符合篩選條件的食材。</div>';
            warehouseBox.appendChild(materialBox);
        }

        if (activeWarehouseFilter !== 'mat') {
            const dishTitle = document.createElement('div');
            dishTitle.className = 'facility-stock-summary';
            dishTitle.innerHTML = `<span>🍱 完成料理</span><span>${cookedDishes.length} 種</span>`;
            warehouseBox.appendChild(dishTitle);
            const dishList = document.createElement('div');
            dishList.className = 'facility-owned-list';
            if (!cookedDishes.length) {
                dishList.innerHTML = '<div class="facility-empty-state">尚無完成料理；選擇下方食譜開始烹飪。</div>';
            } else {
                cookedDishes.forEach((dish) => {
                    const dishRow = document.createElement('div');
                    dishRow.className = 'facility-owned-item';
                    dishRow.innerHTML = `
                        <div class="facility-owned-item__meta">
                            <span class="facility-owned-item__name">${dish.name}</span>
                            <span class="facility-owned-item__hint">倉庫現存 ×${dish.qty}</span>
                        </div>
                    `;
                    const withdrawButton = document.createElement('button');
                    withdrawButton.type = 'button';
                    withdrawButton.className = 'btn-game btn-explore facility-action-button';
                    withdrawButton.textContent = '🎒 取出 1 個';
                    withdrawButton.addEventListener('click', (event) => {
                        event.stopPropagation();
                        executeWithdrawFoodFromWarehouse(dish.name);
                    });
                    dishRow.appendChild(withdrawButton);
                    bindFloatingCard(dishRow, () => {
                        const recipe = typeof getRecipeByName === 'function' ? getRecipeByName(dish.name) : recipes.find((item) => item.name === dish.name);
                        return {
                            title: dish.name,
                            type: '成品料理',
                            desc: recipe?.desc || '完成的美味料理。',
                            stats: `倉庫現存數量: ${dish.qty}`
                        };
                    });
                    dishList.appendChild(dishRow);
                });
            }
            warehouseBox.appendChild(dishList);
        }
    }

    const recipeContainer = DOM.get('recipes-container');
    if (!recipeContainer) return;
    recipeContainer.innerHTML = '';

    const filterBar = document.createElement('div');
    filterBar.className = 'facility-filter-bar facility-filter-bar--single';
    const recipeSelect = document.createElement('select');
    recipeSelect.className = 'select-game';
    recipeSelect.setAttribute('aria-label', '選擇食譜對應的深淵階層');
    recipeSelect.innerHTML = `
        <option value="1-10">📜 深淵階層 B1F ~ B10F 食譜</option>
        <option value="11-20">📜 深淵階層 B11F ~ B20F 食譜</option>
        <option value="21-30">📜 深淵階層 B21F ~ B30F 食譜</option>
        <option value="31-40">📜 深淵階層 B31F ~ B40F 食譜</option>
        <option value="41-50">📜 深淵階層 B41F ~ B50F 食譜</option>
    `;
    recipeSelect.value = activeCookingRange;
    recipeSelect.addEventListener('change', (event) => changeCookingTab(event.target.value));
    filterBar.appendChild(recipeSelect);
    recipeContainer.appendChild(filterBar);

    const filteredRecipes = recipes.filter((recipe) => recipe.range === activeCookingRange);
    if (!filteredRecipes.length) {
        recipeContainer.insertAdjacentHTML('beforeend', '<div class="facility-empty-state">此樓層區間暫無食譜。</div>');
        return;
    }

    filteredRecipes.forEach((recipe) => {
        const availability = getIngredientAvailability(recipe.ingredients);
        const isBuff = recipe.type === 'village_eat';
        const card = document.createElement('article');
        card.className = 'recipe-card';
        card.innerHTML = `
            <div>
                <h5 class="recipe-card__name">${recipe.name}</h5>
                <div class="facility-compact-meta">
                    <span class="recipe-card__type">${isBuff ? '立即進食 Buff' : '可攜帶戰鬥料理'}</span>
                    ${createAvailabilityChip(availability, '食材齊全')}
                    <span class="facility-detail-hint">⌁ 查看詳情</span>
                </div>
            </div>
        `;
        const cookButton = document.createElement('button');
        cookButton.type = 'button';
        cookButton.className = 'btn-game btn-cook facility-action-button';
        cookButton.textContent = isBuff ? '🍴 立即進食' : '🍳 烹飪入庫';
        cookButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (typeof executeVillageCooking === 'function') executeVillageCooking(recipe);
        });
        card.appendChild(cookButton);
        bindFloatingCard(card, () => ({
            title: recipe.name,
            type: isBuff ? '長效進食 Buff' : '可攜帶戰鬥料理',
            desc: recipe.desc,
            stats: `🌾 配料需求: ${Object.entries(recipe.ingredients || {}).map(([name, qty]) => `${name} ×${qty}`).join('、')}`
        }));
        recipeContainer.appendChild(card);
    });
}

// --------------------------------------------------------------------------
// 🛠️ 魔導加工所渲染
// --------------------------------------------------------------------------

function renderVillageWorkshop() {
    const blueprints = typeof CRAFTING_BLUEPRINTS !== 'undefined' ? CRAFTING_BLUEPRINTS : [];
    const recipes = typeof RECIPES_DATABASE !== 'undefined' ? RECIPES_DATABASE : [];
    const warehouse = accountMeta.warehouse || {};
    const counts = getWarehouseCounts();
    const unlockedBlueprints = accountMeta.unlockedBlueprints || [];
    const visibleBlueprints = blueprints.filter((blueprint) => !blueprint.isLegendary || unlockedBlueprints.includes(blueprint.name));
    const craftableCount = visibleBlueprints.filter((blueprint) => getIngredientAvailability(blueprint.ingredients).isReady).length;

    renderFacilityOverview('workshop-overview', [
        { label: '素材存量', value: `${counts.materialQty} 個`, tone: 'accent' },
        { label: '已製作裝備', value: `${counts.equipmentQty} 件` },
        { label: '可打造藍圖', value: `${craftableCount} 張`, tone: 'ready' },
        { label: '持有金幣', value: `${Math.max(0, Number(currentRun.gold) || 0)} G`, tone: 'gold' }
    ]);

    normalizeWarehouseFilter(['all', 'mat', 'dish', 'equip']);
    const warehouseBox = DOM.get('workshop-warehouse-display');
    if (warehouseBox) {
        warehouseBox.className = 'facility-stock-card';
        warehouseBox.innerHTML = '';
        const summary = document.createElement('div');
        summary.className = 'facility-stock-summary';
        summary.innerHTML = `<span>加工庫存共有 <strong>${counts.totalTypes}</strong> 種物品</span><span>${counts.totalQty} 件</span>`;
        warehouseBox.appendChild(summary);
        renderWarehouseFilterBar(warehouseBox, renderVillageWorkshop, ['all', 'mat', 'dish', 'equip']);

        const blueprintNames = new Set(blueprints.map((blueprint) => blueprint.name));
        const recipeNames = new Set(recipes.map((recipe) => recipe.name));
        const filteredItems = Object.entries(warehouse).reduce((items, [name, rawQty]) => {
            const qty = Math.max(0, Number(rawQty) || 0);
            if (!qty) return items;
            const category = blueprintNames.has(name) ? 'equip' : (recipeNames.has(name) ? 'dish' : 'mat');
            if (activeWarehouseFilter !== 'all' && activeWarehouseFilter !== category) return items;
            items.push({ name, qty, category });
            return items;
        }, []);

        const itemBox = document.createElement('div');
        itemBox.className = 'warehouse-pill-box';
        if (filteredItems.length) filteredItems.forEach((item) => itemBox.appendChild(createWarehousePill(item.name, item.qty)));
        else itemBox.innerHTML = '<div class="facility-empty-state">沒有符合篩選條件的庫存物品。</div>';
        warehouseBox.appendChild(itemBox);
    }

    const blueprintContainer = DOM.get('blueprints-container');
    if (!blueprintContainer) return;
    blueprintContainer.innerHTML = '';

    const filterBar = document.createElement('div');
    filterBar.className = 'facility-filter-bar';
    const categorySelect = document.createElement('select');
    categorySelect.className = 'select-game';
    categorySelect.setAttribute('aria-label', '選擇裝備類別');
    categorySelect.innerHTML = `
        <option value="all">🌐 全部神裝類別</option>
        <option value="weapon">🗡️ 武器裝備</option>
        <option value="armor">👕 防具裝備</option>
        <option value="accessory">💍 飾品裝備</option>
    `;
    categorySelect.value = activeCraftingCategory;
    categorySelect.addEventListener('change', (event) => changeCraftingCat(event.target.value));

    const levelSelect = document.createElement('select');
    levelSelect.className = 'select-game';
    levelSelect.setAttribute('aria-label', '選擇藍圖對應的深淵階層');
    levelSelect.innerHTML = `
        <option value="1-10">📜 階層 B1F ~ B10F</option>
        <option value="11-20">📜 階層 B11F ~ B20F</option>
        <option value="21-30">📜 階層 B21F ~ B30F</option>
        <option value="31-40">📜 階層 B31F ~ B40F</option>
        <option value="41-50">📜 階層 B41F ~ B50F</option>
        <option value="51-60">📜 階層 B51F ~ B60F</option>
        <option value="legendary">🌟 傳說神裝藍圖</option>
    `;
    levelSelect.value = activeCraftingLvlRange;
    levelSelect.addEventListener('change', (event) => changeCraftingLvl(event.target.value));
    filterBar.append(categorySelect, levelSelect);
    blueprintContainer.appendChild(filterBar);

    const filteredBlueprints = blueprints.filter((blueprint) => {
        const matchesCategory = activeCraftingCategory === 'all' || blueprint.type === activeCraftingCategory;
        if (blueprint.isLegendary) {
            if (!unlockedBlueprints.includes(blueprint.name)) return false;
            return matchesCategory && (activeCraftingLvlRange === 'legendary' || blueprint.range === activeCraftingLvlRange || activeCraftingLvlRange === '51-60' || !blueprint.range);
        }
        return matchesCategory && blueprint.range === activeCraftingLvlRange;
    });

    if (!filteredBlueprints.length) {
        const message = activeCraftingLvlRange === 'legendary'
            ? '🔒 尚未解鎖任何傳說藍圖。請前往地下黑市進行尋寶採購！'
            : '📜 該分頁目前暫無可打造裝備。';
        blueprintContainer.insertAdjacentHTML('beforeend', `<div class="facility-empty-state">${message}</div>`);
        return;
    }

    const typeLabelMap = { weapon: '武器', armor: '防具', accessory: '飾品' };
    filteredBlueprints.forEach((blueprint) => {
        const itemRefineLvl = (accountMeta.itemRefines?.[blueprint.name]) || (accountMeta.equipmentStars?.[blueprint.type]) || 0;
        const availability = getIngredientAvailability(blueprint.ingredients);
        const isEquipped = Object.values(accountMeta.equipment || {}).includes(blueprint.name);
        const hasInWarehouse = (Number(accountMeta.warehouse?.[blueprint.name]) || 0) > 0;
        const refineGoldCost = (itemRefineLvl + 1) * 100;
        const playerGold = Math.max(0, Number(currentRun?.gold) || 0);
        const hasEnoughGold = playerGold >= refineGoldCost;
        const statDiffHtml = getEquipmentStatDiff(blueprint);
        const skillTag = blueprint.skill ? `<span class="facility-effect-chip">✨ ${blueprint.skill.name}</span>` : '';
        const stateTag = isEquipped ? '<span class="facility-status-chip facility-status-chip--ready">已穿戴</span>'
            : (hasInWarehouse ? '<span class="facility-status-chip">倉庫持有</span>' : '');

        const card = document.createElement('article');
        card.className = `workshop-blueprint-card${blueprint.isLegendary ? ' workshop-blueprint-card--legendary' : ''}`;
        card.innerHTML = `
            <div class="workshop-blueprint-card__heading">
                <div>
                    <h5 class="workshop-blueprint-card__name${blueprint.isLegendary ? ' workshop-blueprint-card__name--legendary' : ''}">${blueprint.name}${itemRefineLvl > 0 ? ` <span class="text-gold">(+${itemRefineLvl})</span>` : ''}</h5>
                    <div class="facility-compact-meta">
                        <span class="workshop-blueprint-card__type">${typeLabelMap[blueprint.type] || blueprint.type}</span>
                        ${skillTag}
                        ${stateTag}
                        ${createAvailabilityChip(availability, '材料可打造')}
                        <span class="facility-detail-hint">⌁ 查看詳情</span>
                    </div>
                </div>
            </div>
            <div class="workshop-blueprint-card__actions"></div>
        `;

        const actions = card.querySelector('.workshop-blueprint-card__actions');
        const forgeButton = document.createElement('button');
        forgeButton.type = 'button';
        forgeButton.className = 'btn-game btn-explore';
        forgeButton.textContent = '🔨 打造';
        forgeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (typeof executeForgeEquipment === 'function') executeForgeEquipment(blueprint);
        });
        actions.appendChild(forgeButton);

        if (isEquipped || hasInWarehouse) {
            const refineButton = document.createElement('button');
            refineButton.type = 'button';
            refineButton.className = 'btn-game btn-rerun';
            refineButton.textContent = `✨ 強化 +${itemRefineLvl + 1} · ${refineGoldCost}G`;
            if (!hasEnoughGold) {
                refineButton.title = `需要 ${refineGoldCost} G，目前只有 ${playerGold} G`;
                refineButton.setAttribute('aria-label', `強化 ${blueprint.name}；需要 ${refineGoldCost} G，目前只有 ${playerGold} G`);
            }
            refineButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (playerGold < refineGoldCost) {
                    showMaterialAlert([`強化費用: ${refineGoldCost} G (當前持有: ${playerGold} G)`, `缺額: ${refineGoldCost - playerGold} G`], '⚠️ 強化所需金幣不足！');
                    return;
                }
                if (typeof refineSpecificEquipment === 'function') refineSpecificEquipment(blueprint.name);
                else showToast('強化模組載入中...', 'info');
            });
            actions.appendChild(refineButton);
        }

        if (isEquipped) {
            const unequipButton = document.createElement('button');
            unequipButton.type = 'button';
            unequipButton.className = 'btn-game btn-rest';
            unequipButton.textContent = '❌ 卸下';
            unequipButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (typeof executeEquipAction === 'function') executeEquipAction(blueprint.name, 'unequip');
            });
            actions.appendChild(unequipButton);
        } else if (hasInWarehouse) {
            const equipButton = document.createElement('button');
            equipButton.type = 'button';
            equipButton.className = 'btn-game btn-rerun';
            equipButton.textContent = '⚡ 穿戴';
            equipButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (typeof executeEquipAction === 'function') executeEquipAction(blueprint.name, 'equip');
            });
            actions.appendChild(equipButton);
        }

        bindFloatingCard(card, () => ({
            title: blueprint.name,
            type: blueprint.isLegendary ? '🌟 傳說神裝藍圖' : `裝備藍圖 (${(typeLabelMap[blueprint.type] || blueprint.type).toUpperCase()})`,
            desc: `${blueprint.desc || '魔導加工所藍圖。'}<br><br>📊 <strong>穿戴屬性比對:</strong> ${statDiffHtml}`,
            stats: `🔨 打造材料: ${Object.entries(blueprint.ingredients || {}).map(([name, qty]) => `${name} ×${qty}`).join('、')}<br>✨ 強化預計費用 (+${itemRefineLvl + 1}): 🪙 ${refineGoldCost} G`
        }));
        blueprintContainer.appendChild(card);
    });
}

// 📜 日記戰鬥日誌
function addLog(msg, type = "deal") {
    const box = DOM.get('log-box');
    if (!box) return;

    const classMap = {
        take: " log-take-dmg",
        perfect: " log-perfect",
        env: " log-env-tick",
        miss: " log-miss",
        "skill-hit": " log-skill-hit",
        "victory-badge": " log-victory-badge"
    };

    let formattedMsg = msg;
    if (typeof formattedMsg === "string") {
        formattedMsg = formattedMsg.replace(/(?:-\s*|\b)(\d+)\s*(點傷害|點物理傷害|點魔法傷害|傷害|HP(?!\s*\+))/g, (match, num, label) => {
            return `<span class="num-p-dmg">- ${num} HP</span>`;
        });

        formattedMsg = formattedMsg.replace(/\+(\d+)\s*(HP|MP|魔力|點生命)/g, (match, num, label) => {
            const isMp = label.includes("MP") || label.includes("魔力");
            const cls = isMp ? 'num-m-dmg' : 'num-h-heal';
            const icon = isMp ? '🔮' : '💖';
            return `<span class="${cls}">${icon} +${num} ${label}</span>`;
        });

        formattedMsg = formattedMsg.replace(/\+(\d+)\s*(G|EXP|金幣|經驗)/g, (match, num, label) => {
            return `<span class="gold-glint v-badge" style="display: inline-flex; align-items: center; gap: 2px; margin: 0 2px;">🪙 +${num} ${label}</span>`;
        });
    }

    const p = document.createElement('div');
    p.className = `log-row-box${classMap[type] || ""}`;
    p.innerHTML = formattedMsg;
    box.appendChild(p);
    const diaryText = p.textContent || String(formattedMsg).replace(/<[^>]*>/g, " ");
    syncBattleSceneLog(diaryText, type);
    syncMobileLatestLog(diaryText);

    box.scrollTo({
        top: box.scrollHeight,
        behavior: 'smooth'
    });
}

function changeCookingTab(range) {
    activeCookingRange = range;
    renderVillageCookingWorkshop();
}

function changeCraftingCat(cat) {
    activeCraftingCategory = cat;
    renderVillageWorkshop();
}

function changeCraftingLvl(range) {
    activeCraftingLvlRange = range;
    renderVillageWorkshop();
}

// ==========================================================================
// 🔑 360° 轉盤開鎖 QTE 系統
// ==========================================================================

let lockpickState = {
    targetAngle: 0,
    tolerance: 15,
    currentAngle: 0,
    holdProgress: 0,
    isDragging: false,
    holdTimer: null,
    onSuccessCallback: null
};

function openChestInspectionModal(chestName = "遠古石縫寶箱", difficulty = "medium", onSuccess) {
    let overlay = document.getElementById('chest-inspect-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'chest-inspect-overlay';
        overlay.className = 'modal-backdrop';
        overlay.style.display = 'none';
        document.body.appendChild(overlay);
    }

    const cleanChestName = chestName.replace(/[🎴]/g, '🏺');

    overlay.innerHTML = `
        <div class="modal-card">
            <h3 id="chest-inspect-title" class="modal-title-cyan" style="font-size: 16px; color: #00ffcc; margin-bottom: 8px;">
                📦 發現 ${cleanChestName}
            </h3>
            <p id="chest-inspect-desc" class="modal-subtitle" style="font-size: 12px; color: #aaa; margin-bottom: 15px; line-height: 1.4;">
                此寶箱掛有高階鎖芯，需要精細開鎖（難度：<strong style="color:#ffd700;">${difficulty.toUpperCase()}</strong>）。
            </p>
            <div class="chest-action-grid">
                <button class="btn-game btn-explore" style="padding: 10px; font-size: 12px; font-weight: bold;" onclick="confirmStartLockpick()">
                    🔓 嘗試精細開鎖 (QTE)
                </button>
                <button class="btn-game btn-rerun" style="padding: 10px; font-size: 12px; font-weight: bold; background: linear-gradient(135deg, #e67e22, #d35400) !important;" onclick="executeForceOpenChest()">
                    🔨 強行撬開 (50% 毀損率)
                </button>
                <button class="btn-game btn-rest" style="padding: 8px; font-size: 11px;" onclick="closeChestInspectModal()">
                    🏃 暫時離開
                </button>
            </div>
        </div>
    `;

    lockpickState.onSuccessCallback = onSuccess;
    lockpickState.difficulty = difficulty;

    overlay.style.display = 'flex';
}

function closeChestInspectModal() {
    const overlay = document.getElementById('chest-inspect-overlay');
    if (overlay) overlay.style.display = 'none';
}

function confirmStartLockpick() {
    closeChestInspectModal();
    initLockpickQTE(lockpickState.difficulty);
}

function executeForceOpenChest() {
    closeChestInspectModal();
    if (Math.random() < 0.5) {
        showToast("💥 撬鎖成功！但寶箱內部分物品受損。", "warn");
        if (lockpickState.onSuccessCallback) lockpickState.onSuccessCallback(true);
    } else {
        showToast("⚠️ 撬鎖失敗！開鎖器折斷，引爆陷阱！", "warn");
        addLog("⚠️ 強行撬鎖失敗，觸發防盜毒霧，受到微量傷害！", "take");
    }
}

function initLockpickQTE(difficulty = "medium") {
    const overlay = document.getElementById('lockpick-modal-overlay');
    const dial = document.getElementById('lockpick-dial');
    const sweetSpot = document.getElementById('lockpick-sweet-spot');

    if (dial) {
        dial.style.touchAction = 'none';
        dial.style.webkitUserSelect = 'none';
        dial.style.userSelect = 'none';
    }

    lockpickState.tolerance = difficulty === 'hard' ? 8 : (difficulty === 'easy' ? 22 : 14);
    lockpickState.targetAngle = Math.floor(Math.random() * 300) + 30;
    lockpickState.currentAngle = 0;
    lockpickState.holdProgress = 0;
    lockpickState.isDragging = false;

    const tAngle = lockpickState.targetAngle;
    const tol = lockpickState.tolerance;
    const startAngle = (tAngle - tol + 360) % 360;
    const endAngle = (tAngle + tol) % 360;

    if (sweetSpot) {
        sweetSpot.style.background = `conic-gradient(
            from 0deg,
            transparent 0deg ${startAngle}deg,
            rgba(0, 255, 204, 0.6) ${startAngle}deg ${endAngle}deg,
            transparent ${endAngle}deg 360deg
        )`;
    }

    updateLockpickNeedle(0);
    updateProgressFill(0);

    if (overlay) overlay.style.display = 'flex';

    if (dial && !dial.dataset.bound) {
        dial.dataset.bound = "true";

        dial.addEventListener('pointerdown', (e) => {
            dial.setPointerCapture(e.pointerId);
            lockpickState.isDragging = true;
            calculateAngleFromPointer(e, dial);
        });

        dial.addEventListener('pointermove', (e) => {
            if (!lockpickState.isDragging) return;
            calculateAngleFromPointer(e, dial);
        });

        const stopDrag = (e) => {
            if (lockpickState.isDragging) {
                lockpickState.isDragging = false;
                try { dial.releasePointerCapture(e.pointerId); } catch(err) {}
            }
        };

        dial.addEventListener('pointerup', stopDrag);
        dial.addEventListener('pointercancel', stopDrag);
    }

    startHoldProgressLoop();
}

function calculateAngleFromPointer(e, dial) {
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    let rad = Math.atan2(dy, dx);
    let deg = rad * (180 / Math.PI) - 90;
    if (deg < 0) deg += 360;

    lockpickState.currentAngle = Math.round(deg);
    updateLockpickNeedle(lockpickState.currentAngle);
}

function updateLockpickNeedle(deg) {
    const needle = document.getElementById('lockpick-needle');
    const dial = document.getElementById('lockpick-dial');
    const hintText = document.getElementById('lockpick-hint-text');

    if (needle) needle.style.transform = `translate(-50%, 0) rotate(${deg}deg)`;

    const diff = Math.abs(deg - lockpickState.targetAngle);
    const inZone = diff <= lockpickState.tolerance || (360 - diff) <= lockpickState.tolerance;

    if (dial) dial.classList.toggle('in-sweet-spot', inZone);

    if (hintText) {
        if (inZone) {
            hintText.innerHTML = `<span style="color:#00ffcc; font-weight:bold;">✨ 感受到了微弱聲響！保持住角度...</span>`;
            if (navigator.vibrate && Math.random() < 0.3) navigator.vibrate(15);
        } else {
            hintText.innerText = "按住轉盤拖拽旋轉，尋找最佳解鎖感應區";
        }
    }
}

function startHoldProgressLoop() {
    if (lockpickState.holdTimer) clearInterval(lockpickState.holdTimer);

    lockpickState.holdTimer = setInterval(() => {
        const overlay = document.getElementById('lockpick-modal-overlay');
        if (!overlay || overlay.style.display === 'none') {
            clearInterval(lockpickState.holdTimer);
            return;
        }

        const diff = Math.abs(lockpickState.currentAngle - lockpickState.targetAngle);
        const inZone = diff <= lockpickState.tolerance || (360 - diff) <= lockpickState.tolerance;

        if (inZone) {
            lockpickState.holdProgress = Math.min(100, lockpickState.holdProgress + 4);
            if (lockpickState.holdProgress >= 100) {
                clearInterval(lockpickState.holdTimer);
                finishLockpickQTE(true);
            }
        } else {
            lockpickState.holdProgress = Math.max(0, lockpickState.holdProgress - 2);
        }

        updateProgressFill(lockpickState.holdProgress);
    }, 50);
}

function updateProgressFill(pct) {
    const fill = document.getElementById('lockpick-progress-fill');
    if (fill) fill.style.width = `${pct}%`;
}

function checkLockpickSuccess() {
    if (lockpickState.holdProgress >= 80) {
        finishLockpickQTE(true);
    } else {
        showToast("⚠️ 尚未對準解鎖點，強行轉動失敗！", "warn");
    }
}

function finishLockpickQTE(isSuccess) {
    if (lockpickState.holdTimer) clearInterval(lockpickState.holdTimer);
    const overlay = document.getElementById('lockpick-modal-overlay');
    if (overlay) overlay.style.display = 'none';

    if (isSuccess) {
        showToast("🔓 咔噠！鎖芯轉動成功解鎖！", "success");
        addLog("🔓 <strong>轉盤解鎖成功：</strong> 成功破譯遠古機械鎖！", "perfect");
        if (lockpickState.onSuccessCallback) lockpickState.onSuccessCallback(false);
    }
}

// ==========================================================================
// ⚖️ 黑市商人：物品與素材回收變賣系統
// ==========================================================================

function executeSellWarehouseItem(itemName, qty = 1) {
    if (!accountMeta.warehouse || !accountMeta.warehouse[itemName]) {
        showToast("📦 倉庫中無此物品", "warn");
        return;
    }

    const currentQty = accountMeta.warehouse[itemName];
    const sellQty = Math.min(qty, currentQty);

    let unitPrice = 5;
    if (itemName.includes("焦黑") || itemName.includes("垃圾")) unitPrice = 1;
    else if (itemName.includes("黏液") || itemName.includes("苔蘚") || itemName.includes("肉")) unitPrice = 3;
    else if (itemName.includes("料理") || itemName.includes("堡")) unitPrice = 10;

    const totalEarn = unitPrice * sellQty;

    accountMeta.warehouse[itemName] -= sellQty;
    if (accountMeta.warehouse[itemName] <= 0) {
        delete accountMeta.warehouse[itemName];
    }

    currentRun.gold = (currentRun.gold || 0) + totalEarn;

    addLog(`💰【黑市交易】成功變賣 <strong>${itemName} x${sellQty}</strong>，換得 <span style="color:#ffd700; font-weight:bold;">+${totalEarn} G</span>！`, "perfect");
    showToast(`💰 變賣成功 +${totalEarn} G`, "success");

    if (typeof saveGameData === "function") saveGameData();
    updateUI();
    if (currentVillageLocation === "SQUARE") renderVillageSquare();
}

function executeSellAllJunkMaterials() {
    if (!accountMeta.warehouse) return;

    let totalEarn = 0;
    let soldItemsCount = 0;

    for (let itemName in accountMeta.warehouse) {
        if (itemName.includes("焦黑") || itemName.includes("黏液") || itemName.includes("苔蘚")) {
            const qty = accountMeta.warehouse[itemName];
            let unitPrice = itemName.includes("焦黑") ? 1 : 3;
            
            totalEarn += unitPrice * qty;
            soldItemsCount += qty;
            delete accountMeta.warehouse[itemName];
        }
    }

    if (soldItemsCount === 0) {
        showToast("🧹 倉庫內沒有可清理的基礎雜物！", "info");
        return;
    }

    currentRun.gold = (currentRun.gold || 0) + totalEarn;

    addLog(`🧹💰【黑市一鍵大清掃】成功回收 <strong>${soldItemsCount} 件低階雜物</strong>，合共換得 <span style="color:#ffd700; font-weight:bold;">+${totalEarn} G</span>！`, "perfect");
    showToast(`🧹 清理完成，獲得 +${totalEarn} G！`, "success");

    if (typeof saveGameData === "function") saveGameData();
    updateUI();
    if (currentVillageLocation === "SQUARE") renderVillageSquare();
}

// ==========================================================================
// 💬 中央廣場介面與 4 小時動態黑市系統
// ==========================================================================

let activeBlackMarketTab = "buy";
let blackMarketTimerInterval = null;

function getOrRefreshBlackMarketStock() {
    const now = Date.now();
    if (!accountMeta.blackMarketStock || !accountMeta.blackMarketNextRefresh || now >= accountMeta.blackMarketNextRefresh) {
        accountMeta.blackMarketStock = generateBlackMarketStock();
        accountMeta.blackMarketNextRefresh = now + BLACK_MARKET_REFRESH_MS;
        if (typeof saveGameData === "function") saveGameData();
    }
    return accountMeta.blackMarketStock;
}

function generateBlackMarketStock() {
    const stock = [];
    if (typeof MARKET_ITEMS_POOL === "undefined") return stock;

    const consumables = MARKET_ITEMS_POOL.consumables || [];
    const materials = MARKET_ITEMS_POOL.materials || [];
    const legendaries = MARKET_ITEMS_POOL.getLegendaryBlueprints ? MARKET_ITEMS_POOL.getLegendaryBlueprints() : [];

    for (let i = 0; i < 3; i++) {
        const isLegendaryRoll = Math.random() < 0.05 && legendaries.length > 0;
        let item = null;

        if (isLegendaryRoll) {
            const randIdx = Math.floor(Math.random() * legendaries.length);
            item = { ...legendaries[randIdx] };
        } else {
            const isMaterial = Math.random() < 0.5 && materials.length > 0;
            if (isMaterial) {
                const randIdx = Math.floor(Math.random() * materials.length);
                item = { ...materials[randIdx] };
            } else if (consumables.length > 0) {
                const randIdx = Math.floor(Math.random() * consumables.length);
                item = { ...consumables[randIdx] };
            }
        }

        if (item) {
            stock.push({
                idx: i,
                name: item.name,
                blueprintName: item.blueprintName || null,
                price: item.price,
                desc: item.desc,
                type: item.type,
                isLegendary: !!item.isLegendary,
                bought: false
            });
        }
    }
    return stock;
}

function renderVillageSquare() {
    const squareContainer = DOM.get('v-loc-square');
    if (!squareContainer) return;

    squareContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
            
            <div style="
                background: radial-gradient(circle at 0% 0%, rgba(230, 126, 34, 0.2) 0%, rgba(20, 15, 10, 0.95) 100%); 
                border: 1px solid rgba(230, 126, 34, 0.4); border-radius: 12px; padding: 14px; 
                display: flex; justify-content: space-between; align-items: center;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            ">
                <div>
                    <div style="font-size: 14px; font-weight: bold; color: #e67e22; letter-spacing: 0.5px;">⚖️ 地下黑市交易所</div>
                    <div style="font-size: 11px; color: #aaa; margin-top: 3px;">提供稀有素材採購、傳說藍圖與倉庫變賣服務。</div>
                </div>
                <button class="btn-game btn-rerun" style="padding: 6px 14px; font-size: 12px; font-weight: bold; background: linear-gradient(135deg, #e67e22, #d35400) !important;" onclick="openBlackMarketModal('buy')">
                    🛒 進入交易選單
                </button>
            </div>

            <div style="background: rgba(10, 15, 25, 0.85); border: 1px solid rgba(41, 128, 185, 0.3); border-radius: 12px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 13px; font-weight: bold; color: #3498db;">💬 冒險者廣場頻道</span>
                    <span style="font-size: 11px; color: #00ffcc; font-weight: bold; background: rgba(0,255,204,0.1); padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(0,255,204,0.3);">
                        🟢 線上勇者: <span id="square-online-count">${currentOnlineCount}</span> 人
                    </span>
                </div>
                
                <div id="square-chat-box" style="
                    height: 130px; overflow-y: auto; background: rgba(0,0,0,0.4); 
                    border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; 
                    padding: 8px; font-size: 11px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;
                ">
                </div>

                <div style="display: flex; gap: 6px;">
                    <input type="text" id="square-chat-input" placeholder="輸入發言內容..." maxlength="40" style="
                        flex: 1; background: rgba(0,0,0,0.5); border: 1px solid rgba(52, 152, 219, 0.4); 
                        border-radius: 6px; color: #fff; padding: 6px 10px; font-size: 11px; outline: none;
                    " onkeypress="if(event.key === 'Enter') sendSquareChatMessage()">
                    <button class="btn-game btn-explore" style="padding: 6px 12px; font-size: 11px;" onclick="sendSquareChatMessage()">
                        發送
                    </button>
                </div>
            </div>

        </div>
    `;

    renderSquareChatBox();
}

function openBlackMarketModal(tab = "buy") {
    activeBlackMarketTab = tab;
    let overlay = document.getElementById('black-market-modal-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'black-market-modal-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            display: flex; justify-content: center; align-items: center;
            z-index: 9999; padding: 15px; box-sizing: border-box;
        `;
        document.body.appendChild(overlay);
    }

    renderBlackMarketModalContent();
    overlay.style.display = 'flex';
    startBlackMarketCountdown();
}

function closeBlackMarketModal() {
    const overlay = document.getElementById('black-market-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    if (blackMarketTimerInterval) clearInterval(blackMarketTimerInterval);
}

function startBlackMarketCountdown() {
    if (blackMarketTimerInterval) clearInterval(blackMarketTimerInterval);

    blackMarketTimerInterval = setInterval(() => {
        const timerEl = document.getElementById('bm-refresh-timer');
        if (!timerEl) {
            clearInterval(blackMarketTimerInterval);
            return;
        }

        const now = Date.now();
        const diff = (accountMeta.blackMarketNextRefresh || now) - now;

        if (diff <= 0) {
            getOrRefreshBlackMarketStock();
            renderBlackMarketModalContent();
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        timerEl.innerText = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function renderBlackMarketModalContent() {
    const overlay = document.getElementById('black-market-modal-overlay');
    if (!overlay) return;

    const playerGold = currentRun ? currentRun.gold || 0 : 0;
    const stockList = getOrRefreshBlackMarketStock();

    overlay.innerHTML = `
        <div style="
            background: rgba(24, 21, 18, 0.98); border: 2px solid #d35400; border-radius: 16px;
            width: 100%; max-width: 420px; max-height: 85vh; display: flex; flex-direction: column;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(211, 84, 0, 0.3); overflow: hidden;
        ">
            <div style="background: rgba(37, 26, 20, 0.95); padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size: 14px; font-weight: bold; color: #e67e22;">⚖️ 地下黑市交易所</span>
                    <span style="font-size: 10px; color: #888; margin-top: 2px;">⏳ 距離下次補貨: <span id="bm-refresh-timer" style="color:#00ffcc; font-weight:bold;">00:00:00</span></span>
                </div>
                <span style="font-size: 12px; color: #ffd700; font-weight: bold;">🪙 現金: ${playerGold} G</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.05);">
                <button style="
                    padding: 10px; border: none; background: ${activeBlackMarketTab === 'buy' ? 'rgba(230, 126, 34, 0.25)' : 'transparent'};
                    color: ${activeBlackMarketTab === 'buy' ? '#e67e22' : '#888'}; font-weight: bold; font-size: 12px; cursor: pointer;
                    border-bottom: 2px solid ${activeBlackMarketTab === 'buy' ? '#e67e22' : 'transparent'}; transition: all 0.2s;
                " onclick="switchBlackMarketTab('buy')">🛒 採購黑市物資 (限額 3 件)</button>

                <button style="
                    padding: 10px; border: none; background: ${activeBlackMarketTab === 'sell' ? 'rgba(230, 126, 34, 0.25)' : 'transparent'};
                    color: ${activeBlackMarketTab === 'sell' ? '#e67e22' : '#888'}; font-weight: bold; font-size: 12px; cursor: pointer;
                    border-bottom: 2px solid ${activeBlackMarketTab === 'sell' ? '#e67e22' : 'transparent'}; transition: all 0.2s;
                " onclick="switchBlackMarketTab('sell')">💰 變賣倉庫物資</button>
            </div>

            <div id="black-market-modal-list" style="padding: 12px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 220px;">
            </div>

            <div style="padding: 12px; background: rgba(37, 26, 20, 0.95); border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                ${activeBlackMarketTab === 'sell' ? `
                    <button class="btn-game btn-rerun" style="padding: 6px 12px; font-size: 11px; background: #c0392b !important;" onclick="executeSellAllJunkMaterials(); renderBlackMarketModalContent();">
                        🧹 一鍵清掃雜物
                    </button>
                ` : `<span></span>`}
                <button class="btn-game btn-rest" style="padding: 6px 16px; font-size: 11px;" onclick="closeBlackMarketModal()">關閉選單</button>
            </div>
        </div>
    `;

    const listEl = document.getElementById('black-market-modal-list');
    if (!listEl) return;

    if (activeBlackMarketTab === "buy") {
        stockList.forEach((item) => {
            const canAfford = playerGold >= item.price && !item.bought;
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                background: ${item.isLegendary ? 'rgba(230, 126, 34, 0.15)' : 'rgba(255,255,255,0.03)'}; 
                padding: 10px; border-radius: 8px;
                border: 1px solid ${item.isLegendary ? '#e67e22' : 'rgba(255,255,255,0.05)'};
            `;

            const nameColor = item.isLegendary ? "#f39c12" : "#fff";

            row.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div>
                        <strong style="color: ${nameColor}; font-size: 12px;">${item.name}</strong>
                        <span style="font-size: 10px; color: #ff9f43; margin-left: 4px;">[${item.type}]</span>
                    </div>
                    <span style="font-size: 10px; color: #aaa;">${item.desc}</span>
                </div>
                <button class="btn-game ${item.bought ? 'btn-rest' : 'btn-explore'}" 
                    style="padding: 5px 10px; font-size: 11px; white-space: nowrap;" 
                    ${canAfford ? "" : "disabled"} 
                    onclick="executeBuyBlackMarketItem(${item.idx})">
                    ${item.bought ? "❌ 已售罄" : `🪙 ${item.price} G`}
                </button>
            `;
            listEl.appendChild(row);
        });
    } else {
        const warehouseData = accountMeta.warehouse || {};
        let hasItems = false;

        for (let itemName in warehouseData) {
            const qty = warehouseData[itemName];
            if (qty <= 0) continue;
            hasItems = true;

            let unitPrice = 5;
            if (itemName.includes("焦黑") || itemName.includes("垃圾")) unitPrice = 1;
            else if (itemName.includes("黏液") || itemName.includes("苔蘚") || itemName.includes("肉")) unitPrice = 3;
            else if (itemName.includes("料理") || itemName.includes("堡")) unitPrice = 10;

            const row = document.createElement('div');
            row.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.05);
            `;
            row.innerHTML = `
                <div>
                    <span style="font-size: 12px; color: #fff;">${itemName}</span>
                    <span style="font-size: 11px; color: #ffd700; font-weight: bold;"> x${qty}</span>
                    <div style="font-size: 10px; color: #888;">收購單價: ${unitPrice} G</div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="btn-game" style="padding: 4px 8px; font-size: 10px;" onclick="executeSellWarehouseItem('${itemName}', 1); renderBlackMarketModalContent();">賣 1 個</button>
                    <button class="btn-game btn-rest" style="padding: 4px 8px; font-size: 10px;" onclick="executeSellWarehouseItem('${itemName}', ${qty}); renderBlackMarketModalContent();">全賣</button>
                </div>
            `;
            listEl.appendChild(row);
        }

        if (!hasItems) {
            listEl.innerHTML = `<div style="color:#666; font-size:12px; text-align:center; padding: 30px;">📦 倉庫目前空空如也，沒有可賣出的物資。</div>`;
        }
    }
}

function switchBlackMarketTab(tab) {
    activeBlackMarketTab = tab;
    renderBlackMarketModalContent();
}

function executeBuyBlackMarketItem(stockIndex) {
    const stockList = getOrRefreshBlackMarketStock();
    const item = stockList[stockIndex];

    if (!item || item.bought) {
        showToast("⚠️ 該商品已被購買或不存在！", "warn");
        return;
    }

    if (!currentRun.gold || currentRun.gold < item.price) {
        showToast("🪙 金幣不足，無法購買該商品！", "warn");
        return;
    }

    currentRun.gold -= item.price;
    item.bought = true; 

    if (item.isLegendary && item.blueprintName) {
        if (!accountMeta.unlockedBlueprints) accountMeta.unlockedBlueprints = [];
        if (!accountMeta.unlockedBlueprints.includes(item.blueprintName)) {
            accountMeta.unlockedBlueprints.push(item.blueprintName);
        }
        showToast(`📜 成功購買 ${item.name}！已解鎖加工所打造資格`, "success");
        addLog(`🛒【黑市交易】花費 <span style="color:#ffd700;">${item.price} G</span> 購買了 <strong>${item.name}</strong>！解鎖了加工所打造資格。`, "perfect");
    } else {
        if (!accountMeta.warehouse) accountMeta.warehouse = {};
        accountMeta.warehouse[item.name] = (accountMeta.warehouse[item.name] || 0) + 1;
        showToast(`🛒 成功購買 ${item.name}！已存入倉庫`, "success");
        addLog(`🛒【黑市採購】花費 <span style="color:#ffd700;">${item.price} G</span> 購買了 <strong>${item.name}</strong> 並存入倉庫。`, "perfect");
    }

    if (typeof saveGameData === "function") saveGameData();
    updateUI();
    renderBlackMarketModalContent();
}

// --------------------------------------------------------------------------
// 💬 聊天室輔助函式
// --------------------------------------------------------------------------

function sendSquareChatMessage() {
    const inputEl = document.getElementById('square-chat-input');
    if (!inputEl) return;

    const msg = inputEl.value.trim();
    if (!msg) return;

    const senderName = accountMeta.name || "無名勇者";
    
    if (socket && socket.connected) {
        socket.emit("send_square_chat", { name: senderName, msg: msg });
    } else {
        receiveSquareChatMessage(senderName, msg);
    }

    inputEl.value = "";
}

function receiveSquareChatMessage(senderName, msg) {
    localChatHistory.push({ name: senderName, msg: msg });
    if (localChatHistory.length > MAX_CHAT_LOGS) {
        localChatHistory.shift();
    }
    renderSquareChatBox();
}

function renderSquareChatBox() {
    const chatBox = document.getElementById('square-chat-box');
    if (!chatBox) return;

    let html = `<div style="color: #7f8c8d; font-style: italic; margin-bottom: 4px;">[系統] 歡迎來到中央廣場！在此可以與線上勇者交流。</div>`;
    localChatHistory.forEach(item => {
        const safeName = escapeHTML(item.name);
        const safeMsg = escapeHTML(item.msg);
        html += `<div style="line-height: 1.4; margin-bottom: 2px;"><strong style="color:#00ffcc;">[${safeName}]</strong>: <span style="color:#eee;">${safeMsg}</span></div>`;
    });

    chatBox.innerHTML = html;
    chatBox.scrollTop = chatBox.scrollHeight;
}
