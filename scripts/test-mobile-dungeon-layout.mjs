#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserCandidates = [process.env.CHROMIUM_BIN, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].filter(Boolean);
const chromium = browserCandidates.find((candidate) => {
    try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
});
if (!chromium) {
    console.log("SKIP mobile dungeon layout: Chromium was not found (set CHROMIUM_BIN to enable browser acceptance).");
    process.exit(0);
}

const screenshotDir = process.env.QA_SCREENSHOT_DIR || path.join(os.tmpdir(), "abyss-mobile-dungeon-qa");
fs.mkdirSync(screenshotDir, { recursive: true });
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "abyss-mobile-dungeon-chrome-"));
const mimeTypes = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".wav": "audio/wav"
};
const server = http.createServer((request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
    } catch {
        response.writeHead(400).end("Bad request");
        return;
    }
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, "index.html")) {
        response.writeHead(403).end("Forbidden");
        return;
    }
    fs.stat(filePath, (statError, stat) => {
        if (statError || !stat.isFile()) {
            response.writeHead(404).end("Not found");
            return;
        }
        response.writeHead(200, { "content-type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
        fs.createReadStream(filePath).pipe(response);
    });
});

class CDP {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        socket.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            if (message.id && this.pending.has(message.id)) {
                const { resolve, reject } = this.pending.get(message.id);
                this.pending.delete(message.id);
                if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
                else resolve(message.result || {});
            } else if (message.method) {
                for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
            }
        });
    }
    on(method, listener) {
        if (!this.listeners.has(method)) this.listeners.set(method, new Set());
        this.listeners.get(method).add(listener);
    }
    async send(method, params = {}) {
        const id = this.nextId++;
        const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
        this.socket.send(JSON.stringify({ id, method, params }));
        return result;
    }
    async evaluate(expression) {
        const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (response.exceptionDetails) {
            throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Browser evaluation failed");
        }
        return response.result?.value;
    }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let browser;
let cdp;
let serverPort;
const runtimeErrors = [];

async function waitForDevToolsPort(portFile, timeoutMs = 15000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        if (fs.existsSync(portFile)) {
            const [port] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/);
            if (Number(port) > 0) return Number(port);
        }
        if (browser?.exitCode !== null && browser?.exitCode !== undefined) throw new Error(`Chromium exited before DevTools became ready: ${browser.exitCode}`);
        await sleep(100);
    }
    throw new Error("Chromium DevTools did not become ready in time");
}

async function connectPage(debugPort) {
    let target;
    const end = Date.now() + 10000;
    while (Date.now() < end && !target) {
        const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json()).catch(() => []);
        target = targets.find((item) => item.type === "page");
        if (!target) await sleep(100);
    }
    if (!target?.webSocketDebuggerUrl) throw new Error("Chromium did not expose a page target");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out connecting to Chromium DevTools")), 5000);
        socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
        socket.addEventListener("error", (event) => { clearTimeout(timeout); reject(new Error(`DevTools WebSocket error: ${event.message || "unknown"}`)); }, { once: true });
    });
    return new CDP(socket);
}

async function setViewport(width, height, mobile) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width, height, deviceScaleFactor: 1, mobile,
        screenWidth: width, screenHeight: height,
        screenOrientation: { angle: mobile ? 0 : 0, type: "portraitPrimary" }
    });
    await sleep(180);
    await cdp.evaluate("syncMobileShellPlacement(); syncMobileShellUI(); syncVillageSquareTabPresentation();");
}

async function capture(name) {
    const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const outputPath = path.join(screenshotDir, `${name}.png`);
    fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
    return outputPath;
}

async function runtimeJson(expression) {
    const value = await cdp.evaluate(`JSON.stringify((() => { ${expression} })())`);
    return JSON.parse(value);
}

try {
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    serverPort = server.address().port;
    browser = spawn(chromium, [
        "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking",
        "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${profileDir}`,
        "--window-size=390,844", "about:blank"
    ], { stdio: "ignore" });
    const debugPort = await waitForDevToolsPort(path.join(profileDir, "DevToolsActivePort"));
    cdp = await connectPage(debugPort);
    cdp.on("Runtime.exceptionThrown", (event) => runtimeErrors.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || "runtime exception"));
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs", { urls: ["https://*/*"] });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844, screenOrientation: { angle: 0, type: "portraitPrimary" } });
    const loaded = new Promise((resolve) => cdp.on("Page.loadEventFired", resolve));
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/index.html` });
    await Promise.race([loaded, sleep(12000).then(() => { throw new Error("Application page load timed out"); })]);
    await sleep(700);

    const ready = await runtimeJson("return { game: typeof gameState, route: typeof renderRouteSelectionPanel, event: typeof renderAbyssEventCard, mobileWidth: matchMedia('(max-width: 640px)').matches, errors: [] };");
    assert.equal(ready.game, "string", "the real app state scripts loaded");
    assert.equal(ready.route, "function", "route rendering is available in the app page");
    assert.equal(ready.event, "function", "event rendering is available in the app page");
    assert.equal(ready.mobileWidth, true, "390px viewport activates the mobile breakpoint");

    await cdp.evaluate(`
        document.querySelectorAll('.modal-backdrop').forEach((node) => { node.style.display = 'none'; node.classList.remove('active'); });
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('title-box').style.display = 'none';
        accountMeta = { name: 'QA 冒險者', job: 'swordsman', lv: 8, gold: 120, exp: 12, nextExp: 50, maxFloor: 10, stats: { STR: 10, AGI: 8, VIT: 9, INT: 5, DEX: 7, LUK: 4 }, equipment: {}, warehouse: {}, skills: {}, bossTalentBonuses: {}, claimedBossFloors: [] };
        currentRun = { name: 'QA 冒險者', job: 'swordsman', lv: 8, hp: 80, maxHp: 100, mp: 40, maxMp: 60, atk: 25, def: 10, spd: 16, gold: 120, exp: 12, nextExp: 50, inventory: [], skills: {}, skillCooldowns: {}, currentNodes: [
            { type: 'COMBAT', color: '#d8a84e', title: '廢墟哨站', icon: '⚔️', clue: '微弱火光在斷垣間閃爍。', desc: '一支被深淵腐化的巡邏隊守著古老入口。', danger: 58, reward: 42, riskLabel: '中危', rewardLabel: '普通' },
            { type: 'EVENT', color: '#46cdb0', title: '低語井庭', icon: '✨', clue: '井底傳來似曾相識的歌聲。', desc: '古井裡的低語或許能揭示命運，也可能奪走你的記憶。', danger: 32, reward: 82, riskLabel: '低危', rewardLabel: '豐厚' },
            { type: 'ELITE', color: '#ec8069', title: '裂甲守門者', icon: '👹', clue: '沉重鎖鏈拖過石地。', desc: '精英魔物封鎖了通往下一處深淵的道路。', danger: 86, reward: 94, riskLabel: '極危', rewardLabel: '稀有' }
        ] };
        gameState = 'SELECT_ROUTE'; dungeonFloor = 5; currentEnvironment = 'NORMAL'; activeMonster = null;
        document.getElementById('route-panel-box').style.display = 'block';
        document.getElementById('status-panel-box').style.display = 'grid';
        document.getElementById('action-panel-box').style.display = 'flex';
        document.getElementById('village-panel-box').style.display = 'none';
        document.getElementById('reward-panel-box').style.display = 'none';
        renderRouteSelectionPanel();
        syncMobileShellPlacement(); syncMobileShellUI(); updateActionPanelUI();
        window.__routeSelectionCalls = [];
        selectRouteNode = (index) => window.__routeSelectionCalls.push(index);
        document.getElementById('route-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    const mobileRoute = await runtimeJson(`
        const card = document.querySelector('.route-choice-card');
        const select = card?.querySelector('.route-choice-select');
        const details = card?.querySelector('.route-choice-details');
        return { count: document.querySelectorAll('.route-choice-card').length, title: card?.querySelector('.route-choice-title')?.textContent, clueDisplay: getComputedStyle(card.querySelector('.route-choice-clue')).display, typeDisplay: getComputedStyle(card.querySelector('.route-choice-type')).display, detailsDisplay: getComputedStyle(details).display, selectDisplay: getComputedStyle(select).display, selectHeight: Math.round(select.getBoundingClientRect().height), width: Math.round(card.getBoundingClientRect().width), scrollWidth: document.documentElement.scrollWidth, innerWidth: innerWidth, hudHidden: document.getElementById('mobile-bottom-hud').hidden };
    `);
    assert.equal(mobileRoute.count, 3, "mobile route panel renders all route choices");
    assert.equal(mobileRoute.clueDisplay, "none", "mobile route card hides verbose clue copy in the compact state");
    assert.notEqual(mobileRoute.detailsDisplay, "none", "mobile route details disclosure is visible");
    assert.notEqual(mobileRoute.selectDisplay, "none", "mobile route has a visible explicit choose button");
    assert.ok(mobileRoute.selectHeight >= 44, `route selection touch target is at least 44px (${mobileRoute.selectHeight}px)`);
    assert.ok(mobileRoute.width <= 390, `mobile route card fits the viewport (${mobileRoute.width}px)`);
    assert.ok(mobileRoute.scrollWidth <= mobileRoute.innerWidth + 1, `mobile route view has no horizontal overflow (${mobileRoute.scrollWidth}/${mobileRoute.innerWidth})`);
    assert.equal(mobileRoute.hudHidden, false, "mobile HUD is visible in a playable state");
    await capture("route-mobile");

    const mobileRouteInteraction = await runtimeJson(`
        const summary = document.querySelector('.route-choice-details > summary'); summary.click();
        const afterDetails = { open: summary.parentElement.open, calls: window.__routeSelectionCalls.length };
        summary.click();
        document.querySelector('.route-choice-select').click();
        return { afterDetails, calls: window.__routeSelectionCalls.slice() };
    `);
    assert.equal(mobileRouteInteraction.afterDetails.open, true, "route details expand on tap");
    assert.equal(mobileRouteInteraction.afterDetails.calls, 0, "opening route details does not select a route");
    assert.equal(mobileRouteInteraction.calls.length, 1, "one explicit mobile choose tap triggers exactly one route selection");

    await cdp.evaluate(`
        gameState = 'ENCOUNTER';
        window.__eventChoiceCalls = 0; window.__eventResolutions = 0;
        const oldUpdateUIMobile = updateUI;
        updateUI = () => { syncMobileShellPlacement(); syncMobileShellUI(); updateActionPanelUI(); };
        addLog = () => {}; saveGameData = () => {}; recalculateRunStats = () => {};
        resolveAbyssEvent = () => { window.__eventResolutions += 1; };
        renderAbyssEventCard({ title: '井庭低語', desc: '深淵中響起低語。井水映出一段被遺忘的記憶，等待你作出選擇。', choices: [
            { text: '聆聽低語（測試）', run: () => { window.__eventChoiceCalls += 1; return '低語回應了你。'; } },
            { text: '離開井庭（測試）', run: () => { window.__eventChoiceCalls += 1; return '你離開了井庭。'; } }
        ] });
        updateUI = oldUpdateUIMobile;
        document.getElementById('reward-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    const mobileEvent = await runtimeJson(`
        const card = document.getElementById('reward-panel-box');
        const details = card.querySelector('.abyss-event-details');
        return { scoped: card.classList.contains('is-abyss-event-card'), summary: card.querySelector('.abyss-event-one-line-summary')?.textContent, summaryDisplay: getComputedStyle(card.querySelector('.abyss-event-one-line-summary')).display, detailsOpen: details.open, detailsSummaryDisplay: getComputedStyle(details.querySelector('summary')).display, description: details.querySelector('.abyss-event-full-description')?.textContent, choiceCount: card.querySelectorAll('#reward-choices-container > button').length };
    `);
    assert.equal(mobileEvent.scoped, true, "event card presentation is scoped to the event state");
    assert.equal(mobileEvent.summary, "深淵中響起低語。", "mobile event card shows only the first sentence as its summary");
    assert.equal(mobileEvent.detailsOpen, false, "full event description is collapsed by default on mobile");
    assert.notEqual(mobileEvent.summaryDisplay, "none", "mobile one-line event summary is visible");
    assert.equal(mobileEvent.choiceCount, 2, "event choice buttons are preserved");
    await capture("event-mobile-collapsed");
    await cdp.evaluate("document.querySelector('.abyss-event-details > summary').click(); document.getElementById('reward-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
    assert.equal(await cdp.evaluate("document.querySelector('.abyss-event-details').open"), true, "mobile full event details expand on tap");
    await capture("event-mobile-expanded");
    await cdp.evaluate("document.querySelector('#reward-choices-container > button').click();");
    assert.deepEqual(await runtimeJson("return { choices: window.__eventChoiceCalls, resolutions: window.__eventResolutions, disabled: document.querySelector('#reward-choices-container > button').disabled }"), { choices: 1, resolutions: 1, disabled: true }, "event outcome handler runs once and is not changed by the compact card");

    await cdp.evaluate(`
        gameState = 'BATTLE'; activeTactic = 'MANUAL'; manualTurnPaused = true; combatPaused = true;
        activeMonster = { name: '深淵巡邏者', hp: 130, maxHp: 130, atk: 18, def: 5, mdef: 4, spd: 9, weakness: '火', desc: '測試用敵人', isBoss: false, isElite: false, activeEffects: [] };
        currentRun.job = 'swordsman'; currentRun.skills = {}; currentRun.inventory = []; currentRun.hp = 78; currentRun.mp = 40;
        document.getElementById('reward-panel-box').style.display = 'none';
        updateBattleScene(activeMonster); updateActionPanelUI();
        const scene = document.getElementById('battle-scene-box'); scene.classList.add('is-background-fallback'); scene.style.display = 'block';
        document.getElementById('mobile-bottom-hud').hidden = false;
        syncMobileShellPlacement(); syncMobileShellUI(); syncMobileManualCommandState(true, false);
    `);
    const mobileBattle = await runtimeJson(`
        const panel = document.getElementById('battle-command-panel');
        const hud = document.getElementById('mobile-bottom-hud');
        return { parent: panel.parentElement.id, position: getComputedStyle(panel).position, display: getComputedStyle(panel).display, tactical: Boolean(document.getElementById('mobile-tactics-button')), tacticalExpanded: document.getElementById('mobile-tactics-button')?.getAttribute('aria-expanded'), hudHeight: Math.round(hud.getBoundingClientRect().height), hudBottom: Math.round(hud.getBoundingClientRect().bottom), panelBottom: Math.round(panel.getBoundingClientRect().bottom), reserve: getComputedStyle(document.body).getPropertyValue('--mobile-hud-reserve').trim(), horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
    `);
    assert.equal(mobileBattle.parent, "mobile-hud-action-slot", "manual battle commands are portaled into the fixed mobile HUD");
    assert.equal(mobileBattle.position, "static", "mobile command panel no longer uses its desktop absolute position");
    assert.ok(mobileBattle.tactical, "mobile battle action row exposes the tactics drawer");
    assert.equal(mobileBattle.hudBottom, 844, "fixed mobile HUD is anchored to the viewport bottom");
    assert.ok(mobileBattle.panelBottom <= mobileBattle.hudBottom + 1, "manual command panel is contained within the fixed HUD");
    assert.equal(mobileBattle.horizontalOverflow, false, "battle HUD does not introduce horizontal overflow");
    await cdp.evaluate("document.getElementById('mobile-tactics-button').click();");
    assert.deepEqual(await runtimeJson("return { expanded: document.getElementById('tactics-drawer-box').classList.contains('expanded'), aria: document.getElementById('mobile-tactics-button').getAttribute('aria-expanded') }"), { expanded: true, aria: "true" }, "mobile tactics entry opens its drawer and synchronizes ARIA");
    await cdp.evaluate("document.getElementById('mobile-tactics-button').click();");
    assert.deepEqual(await runtimeJson("return { expanded: document.getElementById('tactics-drawer-box').classList.contains('expanded'), aria: document.getElementById('mobile-tactics-button').getAttribute('aria-expanded') }"), { expanded: false, aria: "false" }, "mobile tactics entry closes its drawer and synchronizes ARIA");
    await capture("battle-mobile-commands");

    await cdp.evaluate("openManualBattleCommandList('skills');");
    await sleep(100);
    const expandedHud = await runtimeJson(`return { visible: document.body.classList.contains('mobile-manual-command-visible'), optionsOpen: document.body.classList.contains('mobile-manual-command-options-open'), optionsDisplay: getComputedStyle(document.getElementById('battle-command-options')).display, skillsExpanded: document.getElementById('battle-command-skills').getAttribute('aria-expanded'), itemsExpanded: document.getElementById('battle-command-items').getAttribute('aria-expanded'), reserve: getComputedStyle(document.body).getPropertyValue('--mobile-hud-reserve').trim(), hudHeight: Math.round(document.getElementById('mobile-bottom-hud').getBoundingClientRect().height), panelBottom: Math.round(document.getElementById('battle-command-panel').getBoundingClientRect().bottom) }`);
    assert.equal(expandedHud.visible, true, "manual input state activates the mobile HUD reserve class");
    assert.equal(expandedHud.optionsOpen, true, "skill list state activates the expanded-menu reserve class");
    assert.equal(expandedHud.optionsDisplay, "flex", "skill options open within the HUD");
    assert.equal(expandedHud.skillsExpanded, "true", "skill menu button announces the open state");
    assert.equal(expandedHud.itemsExpanded, "false", "item menu button announces the closed state");
    assert.match(expandedHud.reserve, /px$/, "skill menu reserve is measured and stored in pixels");
    assert.ok(parseFloat(expandedHud.reserve) > parseFloat(mobileBattle.reserve), `opening the skills list expands the measured HUD reserve (${mobileBattle.reserve} → ${expandedHud.reserve})`);
    assert.ok(expandedHud.panelBottom <= 844, "expanded skill menu remains on-screen");
    await capture("battle-mobile-skills-open");
    await cdp.evaluate("closeManualBattleCommandList();");
    assert.equal(await cdp.evaluate("document.body.classList.contains('mobile-manual-command-options-open')"), false, "closing the command list restores the lower reserve state");
    assert.deepEqual(await runtimeJson("return { skills: document.getElementById('battle-command-skills').getAttribute('aria-expanded'), items: document.getElementById('battle-command-items').getAttribute('aria-expanded') }"), { skills: "false", items: "false" }, "closing the command list resets both ARIA states");

    await setViewport(1280, 900, false);
    await cdp.evaluate("updateActionPanelUI(); updateBattleScene(activeMonster); document.getElementById('battle-scene-box').style.display = 'block';");
    const desktopBattle = await runtimeJson(`return { parent: document.getElementById('battle-command-panel').parentElement.id, position: getComputedStyle(document.getElementById('battle-command-panel')).position, mobileClass: document.body.classList.contains('mobile-shell-active'), mobileTactics: Boolean(document.getElementById('mobile-tactics-button')), viewportWidth: innerWidth }`);
    assert.equal(desktopBattle.parent, "battle-scene-box", "desktop restores the manual panel to its original battle-scene location");
    assert.equal(desktopBattle.position, "absolute", "desktop retains its existing command-panel position");
    assert.equal(desktopBattle.mobileClass, false, "desktop does not retain mobile shell state");
    assert.equal(desktopBattle.mobileTactics, false, "the mobile-only tactics entry is absent on desktop");
    await capture("battle-desktop-commands");

    await cdp.evaluate(`
        gameState = 'SELECT_ROUTE'; document.getElementById('battle-scene-box').style.display = 'none';
        renderRouteSelectionPanel(); syncMobileShellPlacement(); syncMobileShellUI();
        window.__routeSelectionCalls = [];
        document.getElementById('route-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    const desktopRoute = await runtimeJson(`const card=document.querySelector('.route-choice-card'); return { detailsDisplay: getComputedStyle(card.querySelector('.route-choice-details')).display, selectDisplay: getComputedStyle(card.querySelector('.route-choice-select')).display, clueDisplay: getComputedStyle(card.querySelector('.route-choice-clue')).display, metersDisplay: getComputedStyle(card.querySelector('.route-choice-meters')).display, typeDisplay: getComputedStyle(card.querySelector('.route-choice-type')).display }`);
    assert.equal(desktopRoute.detailsDisplay, "none", "desktop route cards do not show the mobile disclosure control");
    assert.equal(desktopRoute.selectDisplay, "none", "desktop retains its whole-card route selection without an extra button");
    assert.notEqual(desktopRoute.clueDisplay, "none", "desktop retains the full route clue");
    assert.notEqual(desktopRoute.metersDisplay, "none", "desktop retains its original danger and reward meters");
    assert.equal(desktopRoute.typeDisplay, "none", "desktop route title remains unchanged without a mobile type pill");
    await capture("route-desktop");
    await cdp.evaluate("document.querySelector('.route-choice-card').click();");
    assert.deepEqual(await cdp.evaluate("window.__routeSelectionCalls"), [0], "desktop whole-card route selection continues to fire once");
    await cdp.evaluate(`
        gameState = 'ENCOUNTER';
        const oldUpdateUIDesktop = updateUI; updateUI = () => {};
        renderAbyssEventCard({ title: '桌面奇遇', desc: '完整桌面事件說明。第二句用於驗證敘述保持完整。', choices: [{ text: '繼續', run: () => '已處理。' }] });
        updateUI = oldUpdateUIDesktop;
        document.getElementById('reward-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    const desktopEvent = await runtimeJson(`const details=document.querySelector('.abyss-event-details'); const description=details.querySelector('.abyss-event-full-description'); const style=getComputedStyle(description); return { detailsOpen: details.open, summaryDisplay: getComputedStyle(document.querySelector('.abyss-event-one-line-summary')).display, detailsSummaryDisplay: getComputedStyle(details.querySelector('summary')).display, fullDescription: description.textContent, descriptionFontSize: style.fontSize, descriptionMarginBottom: style.marginBottom }`);
    assert.equal(desktopEvent.detailsOpen, true, "desktop event description stays expanded");
    assert.equal(desktopEvent.summaryDisplay, "none", "desktop hides the mobile-only one-line summary");
    assert.equal(desktopEvent.detailsSummaryDisplay, "none", "desktop hides the mobile disclosure label");
    assert.ok(desktopEvent.fullDescription.includes("第二句"), "desktop keeps the complete event description");
    assert.equal(desktopEvent.descriptionFontSize, "12px", "desktop event description keeps its original 12px text size");
    assert.equal(desktopEvent.descriptionMarginBottom, "12px", "desktop event description keeps its original bottom spacing");
    await capture("event-desktop");

    await cdp.evaluate(`(() => {
        window.__villageSavedUpdateUI = updateUI;
        window.__villageSavedSquareRenderer = renderVillageSquare;
        updateUI = () => {};
        renderVillageSquare = () => {};
        gameState = 'TOWN';
        document.getElementById('route-panel-box').style.display = 'none';
        document.getElementById('battle-scene-box').style.display = 'none';
        document.getElementById('reward-panel-box').style.display = 'none';
        document.getElementById('village-panel-box').style.display = 'block';
        document.getElementById('mobile-bottom-hud').hidden = false;
        syncMobileShellPlacement(); syncMobileShellUI(); updateActionPanelUI();
        document.querySelector('.village-nav-bar').scrollLeft = 0;
        switchVillageLocation('GATE');
        document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);

    const villageTabs = [
        { id: "btn-tab-gate", location: "GATE", panel: "v-loc-gate", overview: null },
        { id: "btn-tab-guild", location: "GUILD", panel: "v-loc-guild", overview: "guild-overview" },
        { id: "btn-tab-kitchen", location: "KITCHEN", panel: "v-loc-kitchen", overview: "kitchen-overview" },
        { id: "btn-tab-workshop", location: "WORKSHOP", panel: "v-loc-workshop", overview: "workshop-overview" },
        { id: "btn-tab-square", location: "SQUARE", panel: "v-loc-square", overview: null }
    ];
    const villageViewportCases = [
        { width: 360, screenshotTab: "btn-tab-guild", screenshot: "village-guild-360" },
        { width: 393, screenshotTab: "btn-tab-kitchen", screenshot: "village-kitchen-393" },
        { width: 430, screenshotTab: "btn-tab-workshop", screenshot: "village-workshop-430" }
    ];

    for (const viewport of villageViewportCases) {
        await setViewport(viewport.width, 844, true);
        await cdp.evaluate(`(() => {
            document.querySelector('.village-nav-bar').scrollLeft = 0;
            switchVillageLocation('GATE');
            document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
        })()`);

        for (const tab of villageTabs) {
            await cdp.evaluate(`document.getElementById('${tab.id}').click();`);
            await sleep(360);
            const state = await runtimeJson(`
                const nav = document.querySelector('.village-nav-bar');
                const button = document.getElementById('${tab.id}');
                const panel = document.getElementById('${tab.panel}');
                const navRect = nav.getBoundingClientRect();
                const buttonRect = button.getBoundingClientRect();
                const overview = ${tab.overview ? `document.getElementById('${tab.overview}')` : "null"};
                const gridStyle = overview ? getComputedStyle(overview) : null;
                const metricTextOverflows = overview ? Array.from(overview.querySelectorAll('.facility-metric-label, .facility-metric-value')).some((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 2) : false;
                return {
                    current: currentVillageLocation,
                    pressed: button.getAttribute('aria-pressed'),
                    activeClass: button.classList.contains('active'),
                    panelVisible: getComputedStyle(panel).display !== 'none',
                    panelAriaHidden: panel.getAttribute('aria-hidden'),
                    visiblePanels: Array.from(document.querySelectorAll('.v-sub-loc-panel')).filter((node) => getComputedStyle(node).display !== 'none').length,
                    tabCount: nav.querySelectorAll('.btn-nav-tab').length,
                    flexWrap: getComputedStyle(nav).flexWrap,
                    navClientWidth: nav.clientWidth,
                    navScrollWidth: nav.scrollWidth,
                    tabHeight: Math.round(button.getBoundingClientRect().height),
                    selectedTabVisible: buttonRect.left >= navRect.left + nav.clientLeft - 1 && buttonRect.right <= navRect.left + nav.clientLeft + nav.clientWidth + 1,
                    pageScrollWidth: document.documentElement.scrollWidth,
                    viewportWidth: innerWidth,
                    metricCount: overview?.dataset.metricCount || null,
                    metricColumns: gridStyle ? gridStyle.gridTemplateColumns.split(/\\s+/).filter(Boolean).length : 0,
                    metricRows: gridStyle ? gridStyle.gridTemplateRows.split(/\\s+/).filter(Boolean).length : 0,
                    metricTextOverflows,
                    title: overview?.closest('.facility-panel')?.querySelector('.facility-title')?.textContent || null,
                    purpose: overview?.closest('.facility-panel')?.querySelector('.facility-description')?.textContent || null,
                    purposeHeight: Math.round(overview?.closest('.facility-panel')?.querySelector('.facility-description')?.getBoundingClientRect().height || 0)
                };
            `);

            assert.equal(state.current, tab.location, `${viewport.width}px: selecting ${tab.location} updates current location state`);
            assert.equal(state.pressed, "true", `${viewport.width}px: ${tab.location} exposes its selected state to assistive technology`);
            assert.equal(state.activeClass, true, `${viewport.width}px: ${tab.location} receives the active visual state`);
            assert.equal(state.panelVisible, true, `${viewport.width}px: ${tab.location} content panel is visible`);
            assert.equal(state.panelAriaHidden, "false", `${viewport.width}px: ${tab.location} content panel is announced as visible`);
            assert.equal(state.visiblePanels, 1, `${viewport.width}px: only the selected village panel is visible`);
            assert.equal(state.tabCount, 5, `${viewport.width}px: all five village tabs remain available`);
            assert.equal(state.flexWrap, "nowrap", `${viewport.width}px: village navigation remains on one row`);
            assert.ok(state.navScrollWidth > state.navClientWidth, `${viewport.width}px: horizontal overflow is contained by the village nav`);
            assert.ok(state.tabHeight >= 44, `${viewport.width}px: village tab meets the 44px touch target (${state.tabHeight}px)`);
            assert.equal(state.selectedTabVisible, true, `${viewport.width}px: selected tab scrolls fully into view`);
            assert.ok(state.pageScrollWidth <= state.viewportWidth + 1, `${viewport.width}px: village layout does not overflow the page horizontally (${state.pageScrollWidth}/${state.viewportWidth})`);

            if (tab.overview) {
                assert.equal(state.metricCount, "4", `${viewport.width}px: ${tab.location} retains its four original summary metrics`);
                assert.equal(state.metricColumns, 2, `${viewport.width}px: ${tab.location} metrics use two columns`);
                assert.equal(state.metricRows, 2, `${viewport.width}px: ${tab.location} metrics use two rows`);
                assert.equal(state.metricTextOverflows, false, `${viewport.width}px: ${tab.location} metric labels and values are not clipped`);
                assert.ok(state.title, `${viewport.width}px: ${tab.location} retains its facility title`);
                assert.ok(state.purpose, `${viewport.width}px: ${tab.location} retains its purpose description`);
                assert.ok(state.purposeHeight > 0, `${viewport.width}px: ${tab.location} purpose description remains visible`);
            }
        }

        await cdp.evaluate(`document.getElementById('${viewport.screenshotTab}').click();`);
        await sleep(360);
        await capture(viewport.screenshot);
    }

    await setViewport(360, 844, true);
    await cdp.evaluate(`(() => {
        currentRun.gold = 100000;
        currentRun.lv = 90;
        currentRun.skills = {};
        accountMeta.gold = 100000;
        accountMeta.lv = 90;
        accountMeta.skills = {};
        accountMeta.warehouse = {};
        const qaGuildSkills = typeof getAllSkillsForJob === 'function' ? getAllSkillsForJob(currentRun.job) : (SKILLS_DATABASE[currentRun.job] || []);
        qaGuildSkills.forEach((skill) => Object.entries(skill.reqMat || {}).forEach(([name, qty]) => {
            accountMeta.warehouse[name] = Math.max(Number(accountMeta.warehouse[name]) || 0, Number(qty) || 0);
        }));
        const qaDetailsSkill = qaGuildSkills.find((skill) => skill.type !== 'passive' && Object.keys(skill.reqMat || {}).length > 0)
            || qaGuildSkills.find((skill) => skill.type !== 'passive');
        window.__qaGuildDetailsSkillName = qaDetailsSkill?.name || '';
        switchVillageLocation('GUILD');
        document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);

    const guildMobileCollapsed = await runtimeJson(`
        const guildCards = Array.from(document.querySelectorAll('.guild-skill-card'));
        const firstGuildCard = guildCards[0];
        const firstUpgrade = firstGuildCard?.querySelector('.guild-skill-card__upgrade');
        const resetRoot = document.querySelector('.guild-reset-section');
        const resetToggle = resetRoot?.querySelector('.guild-reset-section__toggle');
        const resetContent = resetRoot?.querySelector('.guild-reset-section__content');
        return {
            skillCount: guildCards.length,
            cardColumns: firstGuildCard ? getComputedStyle(firstGuildCard).gridTemplateColumns.split(/\\s+/).filter(Boolean).length : 0,
            cardFocusable: firstGuildCard?.tabIndex === 0,
            firstButtonVisible: !!firstUpgrade && firstUpgrade.getBoundingClientRect().height > 0,
            firstButtonHeight: Math.round(firstUpgrade?.getBoundingClientRect().height || 0),
            firstButtonLabel: firstUpgrade?.getAttribute('aria-label') || '',
            costDisplay: firstUpgrade ? getComputedStyle(firstUpgrade.querySelector('.guild-skill-upgrade-cost')).display : null,
            firstType: firstGuildCard?.querySelector('.guild-skill-card__type')?.textContent || '',
            resetExpanded: resetToggle?.getAttribute('aria-expanded'),
            resetContentDisplay: resetContent ? getComputedStyle(resetContent).display : null
        };
    `);
    assert.ok(guildMobileCollapsed.skillCount > 0, "360px: guild skill cards render");
    assert.equal(guildMobileCollapsed.cardColumns, 2, "360px: guild skill cards use a compact text-plus-action row");
    assert.equal(guildMobileCollapsed.cardFocusable, true, "360px: guild skill details can be reached by keyboard focus");
    assert.equal(guildMobileCollapsed.firstButtonVisible, true, "360px: guild upgrade action remains visible");
    assert.ok(guildMobileCollapsed.firstButtonHeight >= 44, `360px: guild upgrade action meets the 44px touch target (${guildMobileCollapsed.firstButtonHeight}px)`);
    assert.ok(guildMobileCollapsed.firstButtonLabel.includes('升級'), "360px: upgrade action has an accessible skill label");
    assert.equal(guildMobileCollapsed.costDisplay, "none", "360px: row hides the repeated gold-cost suffix");
    assert.ok(!guildMobileCollapsed.firstType.includes('MP'), "360px: MP cost is kept out of the compact skill row");
    assert.equal(guildMobileCollapsed.resetExpanded, "false", "360px: role-reset disclosure starts collapsed and announced");
    assert.equal(guildMobileCollapsed.resetContentDisplay, "none", "360px: reset actions are hidden before expansion");
    await cdp.evaluate("document.querySelector('.guild-skill-card').scrollIntoView({ behavior: 'instant', block: 'center' });");
    await sleep(120);
    await capture("guild-mobile-skills-360");

    const guildDetails = await cdp.evaluate(`(() => {
        const target = Array.from(document.querySelectorAll('.guild-skill-card')).find((card) => card.querySelector('.guild-skill-card__name')?.textContent.includes(window.__qaGuildDetailsSkillName));
        if (!target) return { found: false };
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        target.dispatchEvent(new FocusEvent('focus'));
        const focusVisible = document.getElementById('floating-item-card')?.classList.contains('active') || false;
        hideFloatingCard();
        target.ontouchstart({ touches: [{ clientX: 160, clientY: 310 }] });
        return { found: true, focusVisible, focusHandlerBound: typeof target.onfocus === 'function' };
    })()`);
    assert.equal(guildDetails.found, true, "360px: an active skill with complete detail data is available");
    assert.equal(guildDetails.focusVisible, true, "360px: the skill row focus handler opens its detail card");
    await sleep(260);
    const guildTooltip = await runtimeJson(`
        const tooltip = document.getElementById('floating-item-card');
        return { active: tooltip?.classList.contains('active') || false, text: tooltip?.textContent || '' };
    `);
    assert.equal(guildTooltip.active, true, "360px: long-press opens the skill detail card");
    assert.ok(guildTooltip.text.includes('MP:'), "360px: active skill details retain MP cost");
    assert.ok(guildTooltip.text.includes('當前威力'), "360px: skill details retain current effect values");
    assert.ok(guildTooltip.text.includes('下級突破'), "360px: skill details retain next-level values");
    assert.ok(guildTooltip.text.includes('升級所需'), "360px: skill details retain upgrade cost and material section");
    await cdp.evaluate("hideFloatingCard();");

    await cdp.evaluate("document.querySelector('.guild-reset-section__toggle').scrollIntoView({ behavior: 'instant', block: 'center' });");
    await sleep(120);
    const guildResetCollapsedReachability = await runtimeJson(`
        const toggle = document.querySelector('.guild-reset-section__toggle');
        const rect = toggle.getBoundingClientRect();
        const hudTop = document.getElementById('mobile-bottom-hud')?.getBoundingClientRect().top ?? innerHeight;
        const scrollAncestors = [];
        for (let node = toggle; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (node.scrollHeight > node.clientHeight + 1 || ['auto', 'scroll'].includes(style.overflowY)) scrollAncestors.push({ node: node.id || node.className || node.tagName, scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, overflowY: style.overflowY });
        }
        return { expanded: toggle.getAttribute('aria-expanded'), height: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom), hudTop: Math.round(hudTop), visibleAboveHud: rect.top >= 0 && rect.bottom <= hudTop + 1, document: { scrollTop: document.scrollingElement.scrollTop, scrollHeight: document.scrollingElement.scrollHeight, clientHeight: document.scrollingElement.clientHeight, bodyPaddingBottom: getComputedStyle(document.body).paddingBottom }, scrollAncestors };
    `);
    assert.equal(guildResetCollapsedReachability.expanded, "false", "360px: reset summary remains collapsed when brought into view");
    assert.ok(guildResetCollapsedReachability.height >= 44, "360px: role-reset summary meets the 44px touch target");
    assert.equal(guildResetCollapsedReachability.visibleAboveHud, true, `360px: role-reset summary is reachable above the fixed HUD (${JSON.stringify(guildResetCollapsedReachability)})`);
    await capture("guild-mobile-reset-collapsed");
    await cdp.evaluate("document.querySelector('.guild-reset-section__toggle').click(); document.querySelector('.guild-reset-section__actions').scrollIntoView({ behavior: 'instant', block: 'center' });");
    await sleep(120);
    const guildResetExpanded = await runtimeJson(`
        const root = document.querySelector('.guild-reset-section');
        const toggle = root.querySelector('.guild-reset-section__toggle');
        const content = root.querySelector('.guild-reset-section__content');
        const buttons = Array.from(root.querySelectorAll('.guild-reset-section__actions > button'));
        const hudTop = document.getElementById('mobile-bottom-hud')?.getBoundingClientRect().top ?? innerHeight;
        const buttonRects = buttons.map((button) => button.getBoundingClientRect());
        return { expanded: toggle.getAttribute('aria-expanded'), contentDisplay: getComputedStyle(content).display, buttonTexts: buttons.map((button) => button.textContent), buttonHeights: buttonRects.map((rect) => Math.round(rect.height)), buttonsVisibleAboveHud: buttonRects.every((rect) => rect.top >= 0 && rect.bottom <= hudTop + 1) };
    `);
    assert.equal(guildResetExpanded.expanded, "true", "360px: opening role reset synchronizes aria-expanded");
    assert.notEqual(guildResetExpanded.contentDisplay, "none", "360px: role reset options are visible after expansion");
    assert.equal(guildResetExpanded.buttonTexts.length, 2, "360px: both existing reset actions remain available");
    assert.ok(guildResetExpanded.buttonTexts[0].includes('300G'), "360px: stat reset keeps its 300G cost visible");
    assert.ok(guildResetExpanded.buttonTexts[1].includes('1,000G'), "360px: job reset keeps its 1,000G cost visible");
    assert.ok(guildResetExpanded.buttonHeights.every((height) => height >= 44), "360px: expanded reset actions meet touch target size");
    assert.equal(guildResetExpanded.buttonsVisibleAboveHud, true, "360px: both reset actions are reachable above the fixed HUD");
    await capture("guild-mobile-reset-expanded");

    await cdp.evaluate(`(() => {
        window.__qaGuildResetCalls = { stats: 0, job: 0 };
        window.__qaOriginalExecuteResetStats = executeResetStats;
        window.__qaOriginalTriggerReselectJobUI = triggerReselectJobUI;
        executeResetStats = () => { window.__qaGuildResetCalls.stats += 1; };
        triggerReselectJobUI = () => { window.__qaGuildResetCalls.job += 1; };
        const resetButtons = document.querySelectorAll('.guild-reset-section__actions > button');
        resetButtons[0].click();
        resetButtons[1].click();
        executeResetStats = window.__qaOriginalExecuteResetStats;
        triggerReselectJobUI = window.__qaOriginalTriggerReselectJobUI;
    })()`);
    const guildResetCalls = await runtimeJson("return window.__qaGuildResetCalls;");
    assert.deepEqual(guildResetCalls, { stats: 1, job: 1 }, "360px: reset buttons still dispatch their original actions exactly once");

    await cdp.evaluate(`(() => {
        const chooseRange = (items) => Array.from(new Set(items.map((item) => item.range).filter(Boolean)))
            .map((range) => ({ range, count: items.filter((item) => item.range === range).length }))
            .sort((a, b) => b.count - a.count)[0]?.range;
        activeCookingRange = chooseRange(RECIPES_DATABASE) || '1-10';
        activeCookingUseFilter = 'all';
        activeCookingRecipeFocusIndex = 0;
        activeCraftingCategory = 'all';
        activeCraftingLvlRange = chooseRange(CRAFTING_BLUEPRINTS.filter((blueprint) => !blueprint.isLegendary)) || '1-10';
        activeWorkshopBlueprintFocusIndex = 0;
        activeWarehouseFilter = 'all';
        kitchenWarehouseExpanded = false;
        workshopWarehouseExpanded = false;
        accountMeta.warehouse = {};
        accountMeta.unlockedBlueprints = [];
        accountMeta.equipment = {};
        accountMeta.itemRefines = {};
        currentRun.gold = 100000;
        accountMeta.gold = 100000;

        const kitchenRecipes = RECIPES_DATABASE.filter((recipe) => recipe.range === activeCookingRange);
        kitchenRecipes.forEach((recipe) => Object.entries(recipe.ingredients || {}).forEach(([name, qty]) => {
            accountMeta.warehouse[name] = (Number(accountMeta.warehouse[name]) || 0) + (Number(qty) || 0);
        }));
        if (kitchenRecipes[0]) accountMeta.warehouse[kitchenRecipes[0].name] = 2;
        const recipeUses = ['village_eat', 'battle'].map((use) => ({
            use,
            count: kitchenRecipes.filter((recipe) => (recipe.type === 'village_eat' ? 'village_eat' : 'battle') === use).length
        })).sort((a, b) => b.count - a.count);
        window.__qaRecipeUse = recipeUses[0]?.use || 'all';

        const workshopBlueprints = CRAFTING_BLUEPRINTS.filter((blueprint) => !blueprint.isLegendary && blueprint.range === activeCraftingLvlRange);
        workshopBlueprints.forEach((blueprint) => Object.entries(blueprint.ingredients || {}).forEach(([name, qty]) => {
            accountMeta.warehouse[name] = (Number(accountMeta.warehouse[name]) || 0) + (Number(qty) || 0);
        }));
        if (workshopBlueprints[0]) accountMeta.warehouse[workshopBlueprints[0].name] = 1;
        window.__qaRecipeRange = activeCookingRange;
        window.__qaBlueprintRange = activeCraftingLvlRange;
        switchVillageLocation('KITCHEN');
        document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);

    const kitchenCollapsed = await runtimeJson(`
        const stock = document.getElementById('kitchen-warehouse-display');
        const toggle = stock.querySelector('.facility-warehouse-disclosure__toggle');
        const content = stock.querySelector('.facility-warehouse-disclosure__content');
        const recipeRoot = document.getElementById('recipes-container');
        const cards = Array.from(recipeRoot.querySelectorAll('.recipe-card'));
        const visibleCards = cards.filter((card) => getComputedStyle(card).display !== 'none');
        const filterBar = recipeRoot.querySelector('.facility-filter-bar');
        const nav = recipeRoot.querySelector('.facility-focus-nav');
        const hudTop = document.getElementById('mobile-bottom-hud')?.getBoundingClientRect().top ?? innerHeight;
        return {
            expanded: toggle.getAttribute('aria-expanded'),
            contentDisplay: getComputedStyle(content).display,
            toggleHeight: Math.round(toggle.getBoundingClientRect().height),
            summary: stock.querySelector('.facility-stock-summary--compact')?.textContent || '',
            recipeCount: cards.length,
            visibleRecipeCount: visibleCards.length,
            focusIndex: visibleCards[0]?.dataset.focusIndex || null,
            filterColumns: getComputedStyle(filterBar).gridTemplateColumns.split(/\\s+/).filter(Boolean).length,
            filterCount: filterBar.querySelectorAll('select').length,
            pagerPosition: nav?.querySelector('.facility-focus-nav__position')?.textContent || null,
            pageScrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
            hudTop
        };
    `);
    assert.equal(kitchenCollapsed.expanded, "false", "360px: kitchen warehouse starts collapsed and exposes aria-expanded=false");
    assert.equal(kitchenCollapsed.contentDisplay, "none", "360px: kitchen warehouse list is hidden until requested");
    assert.ok(kitchenCollapsed.toggleHeight >= 44, "360px: kitchen warehouse disclosure meets the 44px touch target");
    assert.ok(kitchenCollapsed.summary.includes('食材') && kitchenCollapsed.summary.includes('料理'), "360px: kitchen summary always shows ingredient and dish counts");
    assert.ok(kitchenCollapsed.recipeCount > 0, "360px: actual recipes render for the selected floor range");
    assert.equal(kitchenCollapsed.visibleRecipeCount, 1, "360px: kitchen presents only one focused recipe card");
    assert.equal(kitchenCollapsed.focusIndex, "0", "360px: first recipe is the initial focus card");
    assert.equal(kitchenCollapsed.filterColumns, 2, "360px: floor and usage filters share a compact row");
    assert.equal(kitchenCollapsed.filterCount, 2, "360px: kitchen exposes both required filters");
    assert.ok(kitchenCollapsed.pagerPosition, "360px: kitchen exposes a current-position indicator");
    assert.ok(kitchenCollapsed.pageScrollWidth <= kitchenCollapsed.viewportWidth + 1, "360px: kitchen does not cause page-level horizontal overflow");
    await cdp.evaluate("document.querySelector('#kitchen-warehouse-display .facility-warehouse-disclosure__toggle').scrollIntoView({ behavior: 'instant', block: 'center' });");
    await sleep(100);
    await capture("kitchen-mobile-warehouse-collapsed-360");

    await cdp.evaluate("document.querySelector('#kitchen-warehouse-display .facility-warehouse-disclosure__toggle').click();");
    const kitchenExpanded = await runtimeJson(`
        const stock = document.getElementById('kitchen-warehouse-display');
        const toggle = stock.querySelector('.facility-warehouse-disclosure__toggle');
        const content = stock.querySelector('.facility-warehouse-disclosure__content');
        const row = content.querySelector('.warehouse-filter-row');
        return { expanded: toggle.getAttribute('aria-expanded'), contentDisplay: getComputedStyle(content).display, filterRole: row?.getAttribute('role'), filterScrollWidth: row?.scrollWidth || 0, filterClientWidth: row?.clientWidth || 0 };
    `);
    assert.equal(kitchenExpanded.expanded, "true", "360px: opening kitchen warehouse synchronizes aria-expanded=true");
    assert.notEqual(kitchenExpanded.contentDisplay, "none", "360px: kitchen inventory and withdrawal actions become visible");
    assert.equal(kitchenExpanded.filterRole, "group", "360px: warehouse filters expose their grouped semantics");
    await cdp.evaluate(`(() => {
        const ingredientFilter = Array.from(document.querySelectorAll('#kitchen-warehouse-content .warehouse-filter-button')).find((button) => button.textContent.includes('食材素材'));
        ingredientFilter?.click();
    })()`);
    const kitchenFilterState = await runtimeJson(`
        const stock = document.getElementById('kitchen-warehouse-display');
        const toggle = stock.querySelector('.facility-warehouse-disclosure__toggle');
        const filter = Array.from(stock.querySelectorAll('.warehouse-filter-button')).find((button) => button.textContent.includes('食材素材'));
        const row = stock.querySelector('.warehouse-filter-row');
        return { expanded: toggle.getAttribute('aria-expanded'), activeFilter: filter?.getAttribute('aria-pressed'), rowWrap: getComputedStyle(row).flexWrap, rowScrollWidth: row.scrollWidth, rowClientWidth: row.clientWidth };
    `);
    assert.equal(kitchenFilterState.expanded, "true", "360px: changing warehouse category preserves its expanded state");
    assert.equal(kitchenFilterState.activeFilter, "true", "360px: kitchen warehouse filter announces the selected category");
    assert.equal(kitchenFilterState.rowWrap, "nowrap", "360px: warehouse categories stay in one horizontal row");

    await cdp.evaluate(`(() => {
        const filter = document.querySelector('#recipes-container select[aria-label="依料理用途篩選食譜"]');
        filter.value = window.__qaRecipeUse;
        filter.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const kitchenUsageFilter = await runtimeJson(`
        const root = document.getElementById('recipes-container');
        const cards = Array.from(root.querySelectorAll('.recipe-card'));
        const visibleCards = cards.filter((card) => getComputedStyle(card).display !== 'none');
        const expected = RECIPES_DATABASE.filter((recipe) => recipe.range === activeCookingRange && (recipe.type === 'village_eat' ? 'village_eat' : 'battle') === activeCookingUseFilter).length;
        const nav = root.querySelector('.facility-focus-nav');
        return { expected, count: cards.length, visibleCount: visibleCards.length, focusIndex: activeCookingRecipeFocusIndex, position: nav?.querySelector('.facility-focus-nav__position')?.textContent || null, nextDisabled: nav?.querySelector('.facility-focus-nav__button--next')?.disabled ?? true };
    `);
    assert.equal(kitchenUsageFilter.count, kitchenUsageFilter.expected, "360px: cooking-use filter returns only matching recipe data");
    assert.equal(kitchenUsageFilter.visibleCount, 1, "360px: filtered recipes still show one focused card");
    assert.equal(kitchenUsageFilter.focusIndex, 0, "360px: changing cooking-use filter resets focus to the first recipe");
    if (!kitchenUsageFilter.nextDisabled) {
        await cdp.evaluate("document.querySelector('#recipes-container .facility-focus-nav__button--next').click();");
    }
    const kitchenPaged = await runtimeJson(`
        const root = document.getElementById('recipes-container');
        const visible = Array.from(root.querySelectorAll('.recipe-card')).find((card) => getComputedStyle(card).display !== 'none');
        return { index: activeCookingRecipeFocusIndex, cardIndex: visible?.dataset.focusIndex || null, position: root.querySelector('.facility-focus-nav__position')?.textContent || null, nextDisabled: root.querySelector('.facility-focus-nav__button--next')?.disabled ?? true };
    `);
    if (kitchenUsageFilter.expected > 1) {
        assert.equal(kitchenPaged.index, 1, "360px: next recipe control advances the focus index");
        assert.equal(kitchenPaged.cardIndex, "1", "360px: next recipe control selects the corresponding card");
        assert.ok(kitchenPaged.position.startsWith('2 / '), "360px: live page counter announces the second recipe");
    } else {
        assert.equal(kitchenPaged.index, 0, "360px: single-result recipe filter keeps the first card selected");
        assert.equal(kitchenPaged.nextDisabled, true, "360px: next recipe control is disabled at the end of a one-item result");
    }
    await cdp.evaluate("document.querySelector('#recipes-container .recipe-card.is-focus-card button').scrollIntoView({ behavior: 'instant', block: 'center' });");
    await sleep(100);
    const kitchenActionReachability = await runtimeJson(`
        const button = document.querySelector('#recipes-container .recipe-card.is-focus-card button');
        const rect = button.getBoundingClientRect();
        const hudTop = document.getElementById('mobile-bottom-hud')?.getBoundingClientRect().top ?? innerHeight;
        return { height: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom), hudTop: Math.round(hudTop), visibleAboveHud: rect.top >= 0 && rect.bottom <= hudTop + 1 };
    `);
    assert.ok(kitchenActionReachability.height >= 44, "360px: cook action meets the minimum touch target");
    assert.equal(kitchenActionReachability.visibleAboveHud, true, `360px: cook action is reachable above the fixed HUD (${JSON.stringify(kitchenActionReachability)})`);
    await capture("kitchen-mobile-recipe-focus-360");
    const kitchenDetails = await cdp.evaluate(`(() => {
        const card = document.querySelector('#recipes-container .recipe-card.is-focus-card');
        card.dispatchEvent(new FocusEvent('focus'));
        const tooltip = document.getElementById('floating-item-card');
        const result = { focusable: card.tabIndex === 0, active: tooltip.classList.contains('active'), text: tooltip.textContent };
        hideFloatingCard();
        return result;
    })()`);
    assert.equal(kitchenDetails.focusable, true, "360px: recipe details can be opened through keyboard focus");
    assert.equal(kitchenDetails.active, true, "360px: recipe focus opens the existing detail card");
    assert.ok(kitchenDetails.text.includes('配料需求'), "360px: recipe details retain complete ingredient requirements");

    await cdp.evaluate(`(() => {
        window.__qaCookCalls = [];
        window.__qaOriginalCook = executeVillageCooking;
        executeVillageCooking = (recipe) => window.__qaCookCalls.push(recipe.name);
        document.querySelector('#recipes-container .recipe-card.is-focus-card button').click();
        executeVillageCooking = window.__qaOriginalCook;
        const dishFilter = Array.from(document.querySelectorAll('#kitchen-warehouse-content .warehouse-filter-button')).find((button) => button.textContent.includes('料理成品'));
        dishFilter?.click();
        window.__qaWithdrawCalls = [];
        window.__qaOriginalWithdraw = executeWithdrawFoodFromWarehouse;
        executeWithdrawFoodFromWarehouse = (name) => window.__qaWithdrawCalls.push(name);
        document.querySelector('#kitchen-warehouse-content .facility-owned-item button')?.click();
        executeWithdrawFoodFromWarehouse = window.__qaOriginalWithdraw;
    })()`);
    const kitchenActions = await runtimeJson("return { cook: window.__qaCookCalls, withdraw: window.__qaWithdrawCalls };");
    assert.equal(kitchenActions.cook.length, 1, "360px: cooking action still dispatches the existing cooking function exactly once");
    assert.equal(kitchenActions.withdraw.length, 1, "360px: kitchen warehouse keeps its existing one-item withdrawal action");

    await cdp.evaluate(`(() => {
        activeWarehouseFilter = 'all';
        workshopWarehouseExpanded = false;
        switchVillageLocation('WORKSHOP');
    })()`);
    const workshopCollapsed = await runtimeJson(`
        const stock = document.getElementById('workshop-warehouse-display');
        const toggle = stock.querySelector('.facility-warehouse-disclosure__toggle');
        const content = stock.querySelector('.facility-warehouse-disclosure__content');
        const root = document.getElementById('blueprints-container');
        const cards = Array.from(root.querySelectorAll('.workshop-blueprint-card'));
        const visibleCards = cards.filter((card) => getComputedStyle(card).display !== 'none');
        const filterBar = root.querySelector('.facility-filter-bar');
        const nav = root.querySelector('.facility-focus-nav');
        return {
            expanded: toggle.getAttribute('aria-expanded'),
            contentDisplay: getComputedStyle(content).display,
            toggleHeight: Math.round(toggle.getBoundingClientRect().height),
            summary: stock.querySelector('.facility-stock-summary--compact')?.textContent || '',
            blueprintCount: cards.length,
            visibleBlueprintCount: visibleCards.length,
            focusIndex: visibleCards[0]?.dataset.focusIndex || null,
            filterColumns: getComputedStyle(filterBar).gridTemplateColumns.split(/\\s+/).filter(Boolean).length,
            filterCount: filterBar.querySelectorAll('select').length,
            pagerPosition: nav?.querySelector('.facility-focus-nav__position')?.textContent || null,
            pageScrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth
        };
    `);
    assert.equal(workshopCollapsed.expanded, "false", "360px: workshop warehouse starts collapsed and exposes aria-expanded=false");
    assert.equal(workshopCollapsed.contentDisplay, "none", "360px: workshop stock list is hidden until requested");
    assert.ok(workshopCollapsed.toggleHeight >= 44, "360px: workshop warehouse disclosure meets the 44px touch target");
    assert.ok(workshopCollapsed.summary.includes('素材') && workshopCollapsed.summary.includes('裝備'), "360px: workshop summary shows material, dish and equipment quantities");
    assert.ok(workshopCollapsed.blueprintCount > 0, "360px: actual workshop blueprints render for the selected range");
    assert.equal(workshopCollapsed.visibleBlueprintCount, 1, "360px: workshop presents only one focused blueprint card");
    assert.equal(workshopCollapsed.focusIndex, "0", "360px: first blueprint is the initial focus card");
    assert.equal(workshopCollapsed.filterColumns, 2, "360px: equipment category and floor filters share one row");
    assert.equal(workshopCollapsed.filterCount, 2, "360px: workshop retains both category and floor filters");
    assert.ok(workshopCollapsed.pagerPosition, "360px: workshop exposes a current-position indicator");
    assert.ok(workshopCollapsed.pageScrollWidth <= workshopCollapsed.viewportWidth + 1, "360px: workshop does not cause page-level horizontal overflow");
    await cdp.evaluate("document.querySelector('#workshop-warehouse-display .facility-warehouse-disclosure__toggle').scrollIntoView({ behavior: 'instant', block: 'center' });");
    await sleep(100);
    await capture("workshop-mobile-warehouse-collapsed-360");
    await cdp.evaluate("document.querySelector('#workshop-warehouse-display .facility-warehouse-disclosure__toggle').click();");
    await cdp.evaluate(`(() => {
        const equipmentFilter = Array.from(document.querySelectorAll('#workshop-warehouse-content .warehouse-filter-button')).find((button) => button.textContent.includes('裝備神裝'));
        equipmentFilter?.click();
    })()`);
    const workshopFilterState = await runtimeJson(`
        const stock = document.getElementById('workshop-warehouse-display');
        const toggle = stock.querySelector('.facility-warehouse-disclosure__toggle');
        const equipmentFilter = Array.from(stock.querySelectorAll('.warehouse-filter-button')).find((button) => button.textContent.includes('裝備神裝'));
        const row = stock.querySelector('.warehouse-filter-row');
        return { expanded: toggle.getAttribute('aria-expanded'), activeFilter: equipmentFilter?.getAttribute('aria-pressed'), rowWrap: getComputedStyle(row).flexWrap, rowScrollWidth: row.scrollWidth, rowClientWidth: row.clientWidth, pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.equal(workshopFilterState.expanded, "true", "360px: changing workshop warehouse category preserves its expanded state");
    assert.equal(workshopFilterState.activeFilter, "true", "360px: equipment filter announces its selected state");
    assert.equal(workshopFilterState.rowWrap, "nowrap", "360px: workshop warehouse categories stay on one row");
    assert.ok(workshopFilterState.rowScrollWidth > workshopFilterState.rowClientWidth, "360px: workshop category row is internally horizontally scrollable");
    assert.ok(workshopFilterState.pageScrollWidth <= workshopFilterState.viewportWidth + 1, "360px: workshop filter overflow stays inside its scroll row");
    await cdp.evaluate("document.querySelector('#blueprints-container .workshop-blueprint-card.is-focus-card .workshop-blueprint-card__actions button:last-child').scrollIntoView({ behavior: 'instant', block: 'center' });");
    await sleep(100);
    const workshopActionReachability = await runtimeJson(`
        const buttons = Array.from(document.querySelectorAll('#blueprints-container .workshop-blueprint-card.is-focus-card .workshop-blueprint-card__actions button'));
        const rects = buttons.map((button) => button.getBoundingClientRect());
        const hudTop = document.getElementById('mobile-bottom-hud')?.getBoundingClientRect().top ?? innerHeight;
        return { heights: rects.map((rect) => Math.round(rect.height)), buttonsVisibleAboveHud: rects.every((rect) => rect.top >= 0 && rect.bottom <= hudTop + 1), hudTop: Math.round(hudTop) };
    `);
    assert.ok(workshopActionReachability.heights.length >= 2, "360px: owned blueprint exposes forge and management actions");
    assert.ok(workshopActionReachability.heights.every((height) => height >= 44), "360px: blueprint actions meet the 44px touch target");
    assert.equal(workshopActionReachability.buttonsVisibleAboveHud, true, `360px: blueprint actions are reachable above the fixed HUD (${JSON.stringify(workshopActionReachability)})`);
    await capture("workshop-mobile-blueprint-focus-360");
    const workshopDetails = await cdp.evaluate(`(() => {
        const card = document.querySelector('#blueprints-container .workshop-blueprint-card.is-focus-card');
        card.dispatchEvent(new FocusEvent('focus'));
        const tooltip = document.getElementById('floating-item-card');
        const actionLabels = Array.from(card.querySelectorAll('.workshop-blueprint-card__actions button')).map((button) => button.textContent);
        const result = { focusable: card.tabIndex === 0, active: tooltip.classList.contains('active'), text: tooltip.textContent, actionLabels };
        hideFloatingCard();
        return result;
    })()`);
    assert.equal(workshopDetails.focusable, true, "360px: blueprint detail card is keyboard-focusable");
    assert.equal(workshopDetails.active, true, "360px: blueprint focus opens the existing detail card");
    assert.ok(workshopDetails.text.includes('打造材料') && workshopDetails.text.includes('強化預計費用'), "360px: blueprint details retain materials and refine-cost information");
    assert.ok(workshopDetails.text.includes('穿戴屬性比對'), "360px: blueprint details retain equipment stat comparison");
    assert.ok(workshopDetails.actionLabels.some((label) => label.includes('打造')), "360px: focused blueprint retains its forge action");
    assert.ok(workshopDetails.actionLabels.some((label) => label.includes('強化')), "360px: owned blueprint retains its refine action");
    assert.ok(workshopDetails.actionLabels.some((label) => label.includes('穿戴')), "360px: warehouse blueprint retains its equip action");
    await cdp.evaluate(`(() => {
        window.__qaForgeCalls = [];
        window.__qaOriginalForge = executeForgeEquipment;
        executeForgeEquipment = (blueprint) => window.__qaForgeCalls.push(blueprint.name);
        document.querySelector('#blueprints-container .workshop-blueprint-card.is-focus-card .workshop-blueprint-card__actions button').click();
        executeForgeEquipment = window.__qaOriginalForge;
    })()`);
    const workshopActions = await runtimeJson("return window.__qaForgeCalls;");
    assert.equal(workshopActions.length, 1, "360px: forge action still dispatches the original handler exactly once");

    await setViewport(360, 844, true);
    await cdp.evaluate(`(() => {
        gameState = 'VILLAGE'; dungeonFloor = 7; currentEnvironment = 'NORMAL'; currentSquareTab = 'chat';
        window.__villageSavedUpdateUI();
        switchVillageLocation('GATE');
        updateActionPanelUI(); syncMobileShellPlacement(); syncMobileShellUI();
        document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    const mobileGate = await runtimeJson(`
        const gate = document.getElementById('v-loc-gate');
        const action = document.getElementById('btn-main-action');
        const context = gate.querySelector('.gate-mobile-context');
        const floor = gate.querySelector('#gate-current-floor');
        const environment = gate.querySelector('#gate-environment-status');
        const expectedEnvironmentText = ENVIRONMENT_DATABASE[currentEnvironment]?.logText || '';
        return { hasGate: Boolean(gate), hasAction: Boolean(action), hasContext: Boolean(context), hasFloor: Boolean(floor), hasEnvironment: Boolean(environment), mobileCopy: getComputedStyle(gate.querySelector('.gate-departure-copy--mobile')).display, desktopCopy: getComputedStyle(gate.querySelector('.gate-departure-copy--desktop')).display, contextDisplay: context ? getComputedStyle(context).display : null, floorText: floor?.textContent || null, environmentText: environment?.textContent || null, expectedEnvironmentText, actionText: action?.textContent || null, actionLabel: action?.getAttribute('aria-label') || null, actionInHud: Boolean(action && document.getElementById('mobile-hud-action-slot').contains(action)), hasCharacterPanel: Boolean(gate.querySelector('#status-panel-box')), hasLogPanel: Boolean(gate.querySelector('#log-wrapper-box')), pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.equal(mobileGate.hasGate && mobileGate.hasAction && mobileGate.hasContext && mobileGate.hasFloor && mobileGate.hasEnvironment, true, `360px: gate exposes every expected element (${JSON.stringify(mobileGate)})`);
    assert.notEqual(mobileGate.mobileCopy, "none", "360px: gate instruction points players to the fixed bottom departure action");
    assert.equal(mobileGate.desktopCopy, "none", "360px: obsolete left-sidebar direction is hidden on mobile");
    assert.notEqual(mobileGate.contextDisplay, "none", "360px: gate exposes its compact target-floor and environment summary");
    assert.ok(mobileGate.floorText.includes("B7F"), "360px: gate summary identifies the current target floor");
    assert.ok(mobileGate.environmentText.includes(mobileGate.expectedEnvironmentText), "360px: gate summary retains the current environment hint");
    assert.ok(mobileGate.actionText.includes("B7F") && mobileGate.actionLabel.includes("B7F"), "360px: fixed departure action identifies the current target floor");
    assert.equal(mobileGate.actionInHud, true, "360px: departure action remains in the fixed mobile HUD");
    assert.equal(mobileGate.hasCharacterPanel, false, "360px: gate content does not duplicate the full character panel");
    assert.equal(mobileGate.hasLogPanel, false, "360px: gate content does not duplicate the full log");
    assert.ok(mobileGate.pageScrollWidth <= mobileGate.viewportWidth + 1, "360px: gate panel does not overflow horizontally");
    await capture("gate-mobile-360");

    await cdp.evaluate("switchVillageLocation('SQUARE'); window.__villageSavedSquareRenderer(); syncVillageSquareTabPresentation(); document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
    const mobileSquare = await runtimeJson(`
        const root = document.getElementById('v-loc-square');
        const tabs = Array.from(root.querySelectorAll('[data-square-tab]'));
        const chat = document.getElementById('square-chat-panel');
        const market = document.getElementById('square-market-panel');
        const chatBox = document.getElementById('square-chat-box');
        const input = document.getElementById('square-chat-input');
        input.value = 'QA draft remains while switching tabs';
        for (let index = 0; index < 32; index += 1) {
            const line = document.createElement('div');
            line.textContent = 'QA message ' + (index + 1) + ' — scroll stays inside the chat panel';
            chatBox.appendChild(line);
        }
        const fixedHeight = Math.round(chatBox.getBoundingClientRect().height);
        const canScrollMessages = chatBox.scrollHeight > chatBox.clientHeight;
        chatBox.scrollTop = chatBox.scrollHeight;
        return { tabCount: tabs.length, tablistDisplay: getComputedStyle(root.querySelector('[role="tablist"]')).display, selected: tabs.map((tab) => tab.getAttribute('aria-selected')), tabIndexes: tabs.map((tab) => tab.tabIndex), controlsMatch: tabs.every((tab) => document.getElementById(tab.getAttribute('aria-controls'))?.getAttribute('aria-labelledby') === tab.id), chatDisplay: getComputedStyle(chat).display, marketDisplay: getComputedStyle(market).display, inactiveAriaHidden: market.getAttribute('aria-hidden'), inactiveInert: market.inert, chatHeight: fixedHeight, chatOverflowY: getComputedStyle(chatBox).overflowY, canScrollMessages, innerScrollTop: chatBox.scrollTop, inputHeight: Math.round(input.getBoundingClientRect().height), pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.equal(mobileSquare.tabCount, 2, "360px: square renders chat and black-market subtabs");
    assert.notEqual(mobileSquare.tablistDisplay, "none", "360px: square subtab navigation is visible");
    assert.deepEqual(mobileSquare.selected, ["true", "false"], "360px: chat is the selected default tab");
    assert.deepEqual(mobileSquare.tabIndexes, [0, -1], "360px: square tabs use roving keyboard focus");
    assert.equal(mobileSquare.controlsMatch, true, "360px: each square tab controls its labeled panel");
    assert.notEqual(mobileSquare.chatDisplay, "none", "360px: active chat panel is visible");
    assert.equal(mobileSquare.marketDisplay, "none", "360px: inactive black-market panel is collapsed");
    assert.equal(mobileSquare.inactiveAriaHidden, "true", "360px: inactive square panel is hidden from assistive technology");
    assert.equal(mobileSquare.inactiveInert, true, "360px: inactive square panel cannot receive focus");
    assert.ok(mobileSquare.chatHeight >= 120 && mobileSquare.chatHeight <= 220, `360px: chat history remains fixed-height (${mobileSquare.chatHeight}px)`);
    assert.equal(mobileSquare.chatOverflowY, "auto", "360px: chat messages scroll within the chat box");
    assert.equal(mobileSquare.canScrollMessages, true, "360px: overflowing chat messages are internally scrollable");
    assert.ok(mobileSquare.innerScrollTop > 0, "360px: chat scroll position moves inside its bounded panel");
    assert.ok(mobileSquare.inputHeight >= 44, "360px: chat input meets the touch target");
    assert.ok(mobileSquare.pageScrollWidth <= mobileSquare.viewportWidth + 1, "360px: chat content does not expand the page horizontally");
    await capture("square-mobile-chat-360");
    await cdp.evaluate("document.querySelector('#square-chat-panel .square-chat-compose').scrollIntoView({ behavior: 'instant', block: 'end' });");
    const squareComposerClearance = await runtimeJson(`
        const composer = document.querySelector('#square-chat-panel .square-chat-compose').getBoundingClientRect();
        const hud = document.getElementById('mobile-bottom-hud').getBoundingClientRect();
        return { composerBottom: Math.round(composer.bottom), hudTop: Math.round(hud.top), composerAboveHud: composer.bottom <= hud.top + 1, pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.equal(squareComposerClearance.composerAboveHud, true, `360px: chat input and send row scroll fully above the fixed HUD (${JSON.stringify(squareComposerClearance)})`);
    assert.ok(squareComposerClearance.pageScrollWidth <= squareComposerClearance.viewportWidth + 1, "360px: scrolling the chat composer does not create horizontal page overflow");
    await capture("square-mobile-chat-compose-360");

    await cdp.evaluate(`(() => {
        const chatTab = document.getElementById('square-tab-chat');
        chatTab.focus();
        chatTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    })()`);
    const mobileMarket = await runtimeJson(`
        const marketTab = document.getElementById('square-tab-market');
        const marketPanel = document.getElementById('square-market-panel');
        const marketButton = marketPanel.querySelector('.square-market-open');
        return { selected: marketTab.getAttribute('aria-selected'), tabIndex: marketTab.tabIndex, focused: document.activeElement === marketTab, marketDisplay: getComputedStyle(marketPanel).display, chatDisplay: getComputedStyle(document.getElementById('square-chat-panel')).display, marketButtonHeight: Math.round(marketButton.getBoundingClientRect().height), marketButtonText: marketButton.textContent };
    `);
    assert.equal(mobileMarket.selected, "true", "360px: ArrowRight selects the next square tab");
    assert.equal(mobileMarket.tabIndex, 0, "360px: keyboard navigation moves the roving tab stop");
    assert.equal(mobileMarket.focused, true, "360px: keyboard navigation moves focus to the new tab");
    assert.notEqual(mobileMarket.marketDisplay, "none", "360px: black-market entry panel opens on selection");
    assert.equal(mobileMarket.chatDisplay, "none", "360px: chat is hidden while the black-market tab is selected");
    assert.ok(mobileMarket.marketButtonHeight >= 44, "360px: black-market modal entry meets the touch target");
    assert.ok(mobileMarket.marketButtonText.includes("交易選單"), "360px: existing black-market transaction entry remains available");
    await capture("square-mobile-market-360");
    await cdp.evaluate("document.querySelector('.square-market-open').click();");
    const marketModalOpen = await runtimeJson("return getComputedStyle(document.getElementById('black-market-modal-overlay')).display;");
    assert.equal(marketModalOpen, "flex", "360px: market tab opens the existing black-market modal");
    await cdp.evaluate("closeBlackMarketModal(); document.getElementById('square-tab-chat').click();");
    const squareDraftAfterSwitch = await runtimeJson("return { draft: document.getElementById('square-chat-input').value, chatSelected: document.getElementById('square-tab-chat').getAttribute('aria-selected'), chatDisplay: getComputedStyle(document.getElementById('square-chat-panel')).display, modalDisplay: getComputedStyle(document.getElementById('black-market-modal-overlay')).display };");
    assert.equal(squareDraftAfterSwitch.draft, "QA draft remains while switching tabs", "360px: switching square tabs preserves the unsent chat draft");
    assert.equal(squareDraftAfterSwitch.chatSelected, "true", "360px: chat can be selected again after closing market");
    assert.notEqual(squareDraftAfterSwitch.chatDisplay, "none", "360px: chat panel returns without being re-rendered");
    assert.equal(squareDraftAfterSwitch.modalDisplay, "none", "360px: existing market close action closes the modal cleanly");

    await setViewport(1280, 900, false);
    await cdp.evaluate("switchVillageLocation('KITCHEN'); document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
    const desktopKitchen = await runtimeJson(`
        const stock = document.getElementById('kitchen-warehouse-display');
        const toggle = stock.querySelector('.facility-warehouse-disclosure__toggle');
        const content = stock.querySelector('.facility-warehouse-disclosure__content');
        const root = document.getElementById('recipes-container');
        const cards = Array.from(root.querySelectorAll('.recipe-card'));
        const visibleCards = cards.filter((card) => getComputedStyle(card).display !== 'none');
        return { toggleDisplay: getComputedStyle(toggle).display, contentDisplay: getComputedStyle(content).display, cardCount: cards.length, visibleCardCount: visibleCards.length, pagerDisplay: getComputedStyle(root.querySelector('.facility-focus-nav')).display, pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.equal(desktopKitchen.toggleDisplay, "none", "desktop: kitchen hides the phone-only warehouse toggle");
    assert.notEqual(desktopKitchen.contentDisplay, "none", "desktop: kitchen warehouse inventory remains fully visible");
    assert.ok(desktopKitchen.cardCount > 1, "desktop: kitchen retains the full recipe list");
    assert.equal(desktopKitchen.visibleCardCount, desktopKitchen.cardCount, "desktop: every recipe card remains visible");
    assert.equal(desktopKitchen.pagerDisplay, "none", "desktop: kitchen does not show phone paging controls");
    assert.ok(desktopKitchen.pageScrollWidth <= desktopKitchen.viewportWidth + 1, "desktop: kitchen page has no horizontal overflow");
    await capture("kitchen-desktop-catalog");

    await cdp.evaluate("switchVillageLocation('WORKSHOP'); document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
    const desktopWorkshop = await runtimeJson(`
        const stock = document.getElementById('workshop-warehouse-display');
        const toggle = stock.querySelector('.facility-warehouse-disclosure__toggle');
        const content = stock.querySelector('.facility-warehouse-disclosure__content');
        const root = document.getElementById('blueprints-container');
        const cards = Array.from(root.querySelectorAll('.workshop-blueprint-card'));
        const visibleCards = cards.filter((card) => getComputedStyle(card).display !== 'none');
        return { toggleDisplay: getComputedStyle(toggle).display, contentDisplay: getComputedStyle(content).display, cardCount: cards.length, visibleCardCount: visibleCards.length, pagerDisplay: getComputedStyle(root.querySelector('.facility-focus-nav')).display, pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.equal(desktopWorkshop.toggleDisplay, "none", "desktop: workshop hides the phone-only warehouse toggle");
    assert.notEqual(desktopWorkshop.contentDisplay, "none", "desktop: workshop stock inventory remains fully visible");
    assert.ok(desktopWorkshop.cardCount > 1, "desktop: workshop retains the full blueprint list");
    assert.equal(desktopWorkshop.visibleCardCount, desktopWorkshop.cardCount, "desktop: every blueprint card remains visible");
    assert.equal(desktopWorkshop.pagerDisplay, "none", "desktop: workshop does not show phone paging controls");
    assert.ok(desktopWorkshop.pageScrollWidth <= desktopWorkshop.viewportWidth + 1, "desktop: workshop page has no horizontal overflow");
    await capture("workshop-desktop-catalog");

    await cdp.evaluate("switchVillageLocation('SQUARE'); window.__villageSavedSquareRenderer(); syncVillageSquareTabPresentation(); document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
    const desktopSquare = await runtimeJson(`
        const root = document.getElementById('v-loc-square');
        const tabs = root.querySelector('[role="tablist"]');
        const chat = document.getElementById('square-chat-panel');
        const market = document.getElementById('square-market-panel');
        const chatBox = document.getElementById('square-chat-box');
        return { tablistDisplay: getComputedStyle(tabs).display, chatDisplay: getComputedStyle(chat).display, marketDisplay: getComputedStyle(market).display, chatAriaHidden: chat.getAttribute('aria-hidden'), marketAriaHidden: market.getAttribute('aria-hidden'), chatBoxHeight: Math.round(chatBox.getBoundingClientRect().height), pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.equal(desktopSquare.tablistDisplay, "none", "1280px: square hides mobile-only subtabs");
    assert.notEqual(desktopSquare.chatDisplay, "none", "1280px: desktop chat panel remains visible");
    assert.notEqual(desktopSquare.marketDisplay, "none", "1280px: desktop black-market entry remains visible alongside chat");
    assert.equal(desktopSquare.chatAriaHidden, "false", "1280px: desktop chat panel is exposed to assistive technology");
    assert.equal(desktopSquare.marketAriaHidden, "false", "1280px: desktop black-market panel is exposed to assistive technology");
    assert.equal(desktopSquare.chatBoxHeight, 130, "1280px: desktop chat retains its original 130px height");
    assert.ok(desktopSquare.pageScrollWidth <= desktopSquare.viewportWidth + 1, "1280px: square panels do not overflow horizontally");
    await capture("square-desktop");

    await cdp.evaluate("switchVillageLocation('GATE'); document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
    const desktopGate = await runtimeJson(`
        const gate = document.getElementById('v-loc-gate');
        const action = document.getElementById('btn-main-action');
        return { desktopCopy: getComputedStyle(gate.querySelector('.gate-departure-copy--desktop')).display, mobileCopy: getComputedStyle(gate.querySelector('.gate-departure-copy--mobile')).display, contextDisplay: getComputedStyle(gate.querySelector('.gate-mobile-context')).display, actionText: action.textContent, actionInPanel: document.getElementById('action-panel-box').contains(action), pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    `);
    assert.notEqual(desktopGate.desktopCopy, "none", "1280px: original desktop gate departure instruction is preserved");
    assert.equal(desktopGate.mobileCopy, "none", "1280px: mobile-only departure copy is hidden");
    assert.equal(desktopGate.contextDisplay, "none", "1280px: phone-only floor/environment card is hidden on desktop");
    assert.ok(desktopGate.actionText.includes("B7F") && desktopGate.actionInPanel, "1280px: current-floor departure action remains in its original desktop panel");
    assert.ok(desktopGate.pageScrollWidth <= desktopGate.viewportWidth + 1, "1280px: gate layout has no horizontal overflow");
    await capture("gate-desktop");

    await cdp.evaluate("switchVillageLocation('GUILD'); document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
    const desktopVillage = await runtimeJson(`
        const nav = document.querySelector('.village-nav-bar');
        const overview = document.getElementById('guild-overview');
        const metricStyle = getComputedStyle(overview);
        const icon = document.querySelector('.facility-panel--guild .facility-hero-icon');
        const guildCard = document.querySelector('.guild-skill-card');
        const resetSection = document.querySelector('.guild-reset-section');
        return { metricCount: overview.dataset.metricCount, metricColumns: metricStyle.gridTemplateColumns.split(/\\s+/).filter(Boolean).length, navClientWidth: nav.clientWidth, navScrollWidth: nav.scrollWidth, iconWidth: Math.round(icon.getBoundingClientRect().width), bodyScrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, skillColumns: guildCard ? getComputedStyle(guildCard).gridTemplateColumns.split(/\\s+/).filter(Boolean).length : 0, upgradeCostDisplay: guildCard ? getComputedStyle(guildCard.querySelector('.guild-skill-upgrade-cost')).display : null, resetToggleDisplay: resetSection ? getComputedStyle(resetSection.querySelector('.guild-reset-section__toggle')).display : null, resetContentDisplay: resetSection ? getComputedStyle(resetSection.querySelector('.guild-reset-section__content')).display : null };
    `);
    assert.equal(desktopVillage.metricCount, "4", "desktop retains the same four source metrics");
    assert.equal(desktopVillage.metricColumns, 4, "desktop overview remains in its original four-column layout");
    assert.ok(desktopVillage.navScrollWidth <= desktopVillage.navClientWidth + 1, "desktop navigation does not become a horizontally scrolling phone strip");
    assert.equal(desktopVillage.iconWidth, 42, "desktop facility icon retains its original size");
    assert.equal(desktopVillage.skillColumns, 2, "desktop guild skill cards retain their original two-part layout");
    assert.notEqual(desktopVillage.upgradeCostDisplay, "none", "desktop upgrade actions retain their gold-cost suffix");
    assert.equal(desktopVillage.resetToggleDisplay, "none", "desktop hides the phone-only role-reset toggle");
    assert.notEqual(desktopVillage.resetContentDisplay, "none", "desktop keeps role-reset actions visible");
    assert.ok(desktopVillage.bodyScrollWidth <= desktopVillage.viewportWidth + 1, "desktop village page has no horizontal overflow");
    await capture("village-desktop-guild");

    // Stage 7: re-run the high-risk phone interactions at each target width,
    // rather than assuming the 360px assertions represent all narrow screens.
    for (const width of [360, 393, 430]) {
        const label = `${width}px`;
        await setViewport(width, 844, true);

        await cdp.evaluate(`(() => {
            gameState = 'SELECT_ROUTE';
            document.getElementById('battle-scene-box').style.display = 'none';
            document.getElementById('reward-panel-box').style.display = 'none';
            document.getElementById('village-panel-box').style.display = 'none';
            document.getElementById('route-panel-box').style.display = 'block';
            window.__routeSelectionCalls = [];
            selectRouteNode = (index) => window.__routeSelectionCalls.push(index);
            renderRouteSelectionPanel(); updateActionPanelUI(); syncMobileShellPlacement(); syncMobileShellUI();
            document.getElementById('route-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
        })()`);
        const routeSweep = await runtimeJson(`
            const card = document.querySelector('.route-choice-card');
            const details = card.querySelector('.route-choice-details > summary');
            const choose = card.querySelector('.route-choice-select');
            return { cardWidth: Math.round(card.getBoundingClientRect().width), detailsHeight: Math.round(details.getBoundingClientRect().height), chooseHeight: Math.round(choose.getBoundingClientRect().height), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        `);
        assert.ok(routeSweep.cardWidth <= width, `${label}: route card fits its viewport (${routeSweep.cardWidth}px)`);
        assert.ok(routeSweep.detailsHeight >= 44, `${label}: route details trigger meets 44px (${routeSweep.detailsHeight}px)`);
        assert.ok(routeSweep.chooseHeight >= 44, `${label}: route selection meets 44px (${routeSweep.chooseHeight}px)`);
        assert.ok(routeSweep.pageWidth <= routeSweep.viewport + 1, `${label}: route view has no horizontal overflow`);
        await capture(`stage7-${width}-route`);
        const routeDisclosure = await cdp.evaluate(`(() => {
            const summary = document.querySelector('.route-choice-details > summary');
            summary.click();
            const result = { open: summary.parentElement.open, choices: window.__routeSelectionCalls.length };
            summary.click(); return result;
        })()`);
        assert.deepEqual(routeDisclosure, { open: true, choices: 0 }, `${label}: opening route details does not select a route`);

        await cdp.evaluate(`(() => {
            gameState = 'ENCOUNTER';
            renderAbyssEventCard({ title: '手機驗收奇遇', desc: '第一句摘要。完整事件內容保持可讀並能展開。', choices: [
                { text: '接受（QA）', run: () => '已接受。' },
                { text: '離開（QA）', run: () => '已離開。' }
            ] });
            syncMobileShellPlacement(); syncMobileShellUI();
            document.getElementById('reward-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });
        })()`);
        const eventSweep = await runtimeJson(`
            const root = document.getElementById('reward-panel-box');
            const summary = root.querySelector('.abyss-event-details > summary');
            const choices = Array.from(root.querySelectorAll('#reward-choices-container > button'));
            return { detailsHeight: Math.round(summary.getBoundingClientRect().height), choiceHeights: choices.map((button) => Math.round(button.getBoundingClientRect().height)), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        `);
        assert.ok(eventSweep.detailsHeight >= 44, `${label}: event details trigger meets 44px (${eventSweep.detailsHeight}px)`);
        assert.ok(eventSweep.choiceHeights.length > 0 && eventSweep.choiceHeights.every((height) => height >= 44), `${label}: event choices meet 44px (${eventSweep.choiceHeights.join(',')}px)`);
        assert.ok(eventSweep.pageWidth <= eventSweep.viewport + 1, `${label}: event card has no horizontal overflow`);
        await capture(`stage7-${width}-event`);
        await cdp.evaluate("document.querySelector('.abyss-event-details > summary').click();");
        assert.equal(await cdp.evaluate("document.querySelector('.abyss-event-details').open"), true, `${label}: event details expand by touch`);

        await cdp.evaluate(`(() => {
            gameState = 'BATTLE'; activeTactic = 'MANUAL'; manualTurnPaused = true; combatPaused = true;
            activeMonster = { name: '手機驗收魔物', hp: 130, maxHp: 130, atk: 18, def: 5, mdef: 4, spd: 9, weakness: '火', desc: 'QA', isBoss: false, isElite: false, activeEffects: [] };
            document.getElementById('route-panel-box').style.display = 'none';
            document.getElementById('reward-panel-box').style.display = 'none';
            document.getElementById('village-panel-box').style.display = 'none';
            updateBattleScene(activeMonster); updateActionPanelUI();
            const scene = document.getElementById('battle-scene-box'); scene.classList.add('is-background-fallback'); scene.style.display = 'block';
            document.getElementById('mobile-bottom-hud').hidden = false;
            syncMobileShellPlacement(); syncMobileShellUI(); syncMobileManualCommandState(true, false);
        })()`);
        const battleSweep = await runtimeJson(`
            const hud = document.getElementById('mobile-bottom-hud').getBoundingClientRect();
            const panel = document.getElementById('battle-command-panel').getBoundingClientRect();
            const categories = Array.from(document.querySelectorAll('#battle-command-categories button'));
            return { hudBottom: Math.round(hud.bottom), viewport: innerHeight, panelBottom: Math.round(panel.bottom), categoryHeights: categories.map((button) => Math.round(button.getBoundingClientRect().height)), pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
        `);
        assert.equal(battleSweep.hudBottom, 844, `${label}: fixed battle HUD is anchored to viewport bottom`);
        assert.ok(battleSweep.panelBottom <= battleSweep.hudBottom + 1, `${label}: command panel remains inside HUD`);
        assert.ok(battleSweep.categoryHeights.length >= 2 && battleSweep.categoryHeights.every((height) => height >= 44), `${label}: battle controls meet 44px (${battleSweep.categoryHeights.join(',')}px)`);
        assert.ok(battleSweep.pageWidth <= battleSweep.viewportWidth + 1, `${label}: battle HUD has no horizontal overflow`);
        await capture(`stage7-${width}-battle`);
        await cdp.evaluate("openManualBattleCommandList('skills');"); await sleep(80);
        const battleDrawer = await runtimeJson("return { open: document.body.classList.contains('mobile-manual-command-options-open'), aria: document.getElementById('battle-command-skills').getAttribute('aria-expanded'), bottom: Math.round(document.getElementById('battle-command-panel').getBoundingClientRect().bottom), viewport: innerHeight, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };");
        assert.equal(battleDrawer.open, true, `${label}: skill drawer opens`);
        assert.equal(battleDrawer.aria, "true", `${label}: skill drawer ARIA state is synchronized`);
        assert.ok(battleDrawer.bottom <= battleDrawer.viewport + 1, `${label}: expanded skill drawer stays on screen`);
        assert.ok(battleDrawer.pageWidth <= battleDrawer.viewportWidth + 1, `${label}: expanded skill drawer has no horizontal overflow`);
        await cdp.evaluate("closeManualBattleCommandList();");

        await cdp.evaluate(`(() => {
            gameState = 'VILLAGE';
            window.__villageSavedUpdateUI();
            document.getElementById('village-panel-box').style.display = 'block';
            document.getElementById('mobile-bottom-hud').hidden = false;
            syncMobileShellPlacement(); syncMobileShellUI();
            switchVillageLocation('GUILD');
        })()`);
        await cdp.evaluate("document.querySelector('.guild-skill-card').scrollIntoView({ behavior: 'instant', block: 'center' });");
        await sleep(180);
        const guildSweep = await runtimeJson(`
            const upgrade = document.querySelector('.guild-skill-card__upgrade');
            const reset = document.querySelector('.guild-reset-section__toggle');
            const hudTop = document.getElementById('mobile-bottom-hud').getBoundingClientRect().top;
            const upgradeRect = upgrade.getBoundingClientRect();
            return { upgradeHeight: Math.round(upgradeRect.height), upgradeVisible: upgradeRect.top >= 0 && upgradeRect.bottom <= hudTop + 1, resetHeight: Math.round(reset.getBoundingClientRect().height), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, drawerOpen: document.body.classList.contains('mobile-drawer-open'), scrimOpacity: getComputedStyle(document.getElementById('mobile-drawer-scrim')).opacity, floatingCardActive: document.getElementById('floating-item-card')?.classList.contains('active') || false, bodyClasses: document.body.className };
        `);
        assert.equal(guildSweep.drawerOpen, false, `${label}: no mobile drawer scrim remains during facility view (${JSON.stringify(guildSweep)})`);
        assert.ok(guildSweep.upgradeHeight >= 44 && guildSweep.resetHeight >= 44, `${label}: guild upgrade/reset actions meet 44px`);
        assert.equal(guildSweep.upgradeVisible, true, `${label}: guild upgrade action is reachable above HUD`);
        assert.ok(guildSweep.pageWidth <= guildSweep.viewport + 1, `${label}: guild page has no horizontal overflow`);
        await capture(`stage7-${width}-guild`);
        await cdp.evaluate("document.querySelector('.guild-reset-section__toggle').click();");
        assert.equal(await cdp.evaluate("document.querySelector('.guild-reset-section__toggle').getAttribute('aria-expanded')"), "true", `${label}: guild reset disclosure opens and updates ARIA`);
        await cdp.evaluate("document.querySelector('.guild-reset-section__toggle').click();");

        await cdp.evaluate(`(() => { kitchenWarehouseExpanded = false; activeCookingRecipeFocusIndex = 0; activeCookingUseFilter = 'all'; switchVillageLocation('KITCHEN'); })()`);
        await cdp.evaluate("document.querySelector('#recipes-container .recipe-card.is-focus-card')?.scrollIntoView({ behavior: 'instant', block: 'center' });");
        const kitchenSweep = await runtimeJson(`
            const root = document.getElementById('recipes-container');
            const card = root.querySelector('.recipe-card.is-focus-card');
            const action = card?.querySelector('button');
            const filters = Array.from(root.querySelectorAll('.facility-filter-bar select'));
            return { card: Boolean(card), actionHeight: Math.round(action?.getBoundingClientRect().height || 0), filterHeights: filters.map((node) => Math.round(node.getBoundingClientRect().height)), visibleCards: Array.from(root.querySelectorAll('.recipe-card')).filter((node) => getComputedStyle(node).display !== 'none').length, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        `);
        assert.equal(kitchenSweep.card, true, `${label}: kitchen has a focused recipe`);
        assert.ok(kitchenSweep.actionHeight >= 44, `${label}: cook action meets 44px`);
        assert.ok(kitchenSweep.filterHeights.every((height) => height >= 44), `${label}: kitchen filters meet 44px`);
        assert.equal(kitchenSweep.visibleCards, 1, `${label}: kitchen shows one focus card`);
        assert.ok(kitchenSweep.pageWidth <= kitchenSweep.viewport + 1, `${label}: kitchen has no horizontal overflow`);
        await sleep(180);
        await capture(`stage7-${width}-kitchen`);

        await cdp.evaluate(`(() => { workshopWarehouseExpanded = false; activeWorkshopBlueprintFocusIndex = 0; switchVillageLocation('WORKSHOP'); })()`);
        await cdp.evaluate("document.querySelector('#blueprints-container .workshop-blueprint-card.is-focus-card')?.scrollIntoView({ behavior: 'instant', block: 'center' });");
        const workshopSweep = await runtimeJson(`
            const root = document.getElementById('blueprints-container');
            const card = root.querySelector('.workshop-blueprint-card.is-focus-card');
            const actions = Array.from(card?.querySelectorAll('.workshop-blueprint-card__actions button') || []);
            const filters = Array.from(root.querySelectorAll('.facility-filter-bar select'));
            return { card: Boolean(card), actionHeights: actions.map((node) => Math.round(node.getBoundingClientRect().height)), filterHeights: filters.map((node) => Math.round(node.getBoundingClientRect().height)), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        `);
        assert.equal(workshopSweep.card, true, `${label}: workshop has a focused blueprint`);
        assert.ok(workshopSweep.actionHeights.length > 0 && workshopSweep.actionHeights.every((height) => height >= 44), `${label}: blueprint actions meet 44px`);
        assert.ok(workshopSweep.filterHeights.every((height) => height >= 44), `${label}: workshop filters meet 44px`);
        assert.ok(workshopSweep.pageWidth <= workshopSweep.viewport + 1, `${label}: workshop has no horizontal overflow`);
        await sleep(180);
        await capture(`stage7-${width}-workshop`);

        await cdp.evaluate(`(() => { currentSquareTab = 'chat'; renderVillageSquare = window.__villageSavedSquareRenderer; switchVillageLocation('SQUARE'); syncVillageSquareTabPresentation(); })()`);
        const squareSweep = await runtimeJson(`
            const input = document.getElementById('square-chat-input');
            const send = document.querySelector('.square-chat-send');
            const tabs = Array.from(document.querySelectorAll('#v-loc-square [data-square-tab]'));
            input.value = 'viewport sweep draft';
            const heights = [input, send, ...tabs].map((node) => Math.round(node.getBoundingClientRect().height));
            return { heights, selected: tabs.map((node) => node.getAttribute('aria-selected')), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        `);
        assert.ok(squareSweep.heights.every((height) => height >= 44), `${label}: chat input/send/tabs meet 44px (${squareSweep.heights.join(',')}px)`);
        assert.deepEqual(squareSweep.selected, ["true", "false"], `${label}: square chat tab is selected`);
        assert.ok(squareSweep.pageWidth <= squareSweep.viewport + 1, `${label}: square has no horizontal overflow`);
        await cdp.evaluate("document.querySelector('.square-chat-compose').scrollIntoView({ behavior: 'instant', block: 'end' });");
        const composerSweep = await runtimeJson("const row=document.querySelector('.square-chat-compose').getBoundingClientRect(); const hud=document.getElementById('mobile-bottom-hud').getBoundingClientRect(); return { visible: row.bottom <= hud.top + 1, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };");
        assert.equal(composerSweep.visible, true, `${label}: chat composer can scroll above the fixed HUD`);
        assert.ok(composerSweep.pageWidth <= composerSweep.viewport + 1, `${label}: composer scrolling does not cause horizontal overflow`);
        await sleep(180);
        await capture(`stage7-${width}-square`);
        const draftAfterTabSwitch = await cdp.evaluate("(() => { document.getElementById('square-tab-market').click(); document.getElementById('square-tab-chat').click(); return document.getElementById('square-chat-input').value; })()");
        assert.equal(draftAfterTabSwitch, 'viewport sweep draft', `${label}: square tab switching preserves the draft`);

        await cdp.evaluate("gameState = 'VILLAGE'; switchVillageLocation('GATE'); syncMobileShellPlacement(); syncMobileShellUI(); updateActionPanelUI(); document.getElementById('village-panel-box').scrollIntoView({ behavior: 'instant', block: 'start' });");
        await sleep(180);
        const gateSweep = await runtimeJson(`
            const gate = document.getElementById('v-loc-gate');
            const contextNode = gate?.querySelector('.gate-mobile-context');
            const actionNode = document.getElementById('btn-main-action');
            const hudNode = document.getElementById('mobile-bottom-hud');
            if (!gate || !contextNode || !actionNode || !hudNode) return { hasGate: Boolean(gate), hasContext: Boolean(contextNode), hasAction: Boolean(actionNode), hasHud: Boolean(hudNode), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
            const context = contextNode.getBoundingClientRect();
            const action = actionNode.getBoundingClientRect();
            const hud = hudNode.getBoundingClientRect();
            return { hasGate: true, hasContext: true, hasAction: true, hasHud: true, contextWidth: Math.round(context.width), actionWidth: Math.round(action.width), actionHeight: Math.round(action.height), actionInsideHud: action.top >= hud.top - 1 && action.bottom <= hud.bottom + 1, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        `);
        assert.equal(gateSweep.hasGate && gateSweep.hasContext && gateSweep.hasAction && gateSweep.hasHud, true, `${label}: gate test DOM exists (${JSON.stringify(gateSweep)})`);
        assert.ok(gateSweep.contextWidth <= width && gateSweep.actionWidth <= width, `${label}: gate context and action fit the viewport`);
        assert.ok(gateSweep.actionHeight >= 44, `${label}: gate departure action meets 44px`);
        assert.equal(gateSweep.actionInsideHud, true, `${label}: gate departure action remains reachable inside HUD`);
        assert.ok(gateSweep.pageWidth <= gateSweep.viewport + 1, `${label}: gate has no horizontal overflow`);
        await capture(`stage7-${width}-gate`);
    }

    await cdp.evaluate("updateUI = window.__villageSavedUpdateUI; renderVillageSquare = window.__villageSavedSquareRenderer;");

    if (runtimeErrors.length) {
        throw new Error(`Browser runtime exceptions were reported: ${runtimeErrors.join(" | ")}`);
    }
    console.log("Chromium mobile UI acceptance passed: route/event behavior, fixed battle HUD, five-location village navigation, full 360/393/430px viewport sweep across route/event/battle/guild/kitchen/workshop/square/gate, and desktop restoration.");
    console.log(`Screenshots saved to ${screenshotDir}`);
} finally {
    cdp?.socket?.close();
    browser?.kill("SIGTERM");
    await new Promise((resolve) => server.close(resolve).unref?.());
    await sleep(100);
    fs.rmSync(profileDir, { recursive: true, force: true });
}
