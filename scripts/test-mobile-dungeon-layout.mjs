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
    await cdp.evaluate("syncMobileShellPlacement(); syncMobileShellUI();");
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

    if (runtimeErrors.length) {
        throw new Error(`Browser runtime exceptions were reported: ${runtimeErrors.join(" | ")}`);
    }
    console.log("Chromium mobile dungeon acceptance passed: route choose/details, event summary/details/choice, fixed manual HUD and scroll menu, desktop route/event/combat restoration.");
    console.log(`Screenshots saved to ${screenshotDir}`);
} finally {
    cdp?.socket?.close();
    browser?.kill("SIGTERM");
    await new Promise((resolve) => server.close(resolve).unref?.());
    await sleep(100);
    fs.rmSync(profileDir, { recursive: true, force: true });
}
