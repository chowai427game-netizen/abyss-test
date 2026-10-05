#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.properties = new Map();
        this.style = {
            pointerEvents: "",
            setProperty: (name, value) => this.properties.set(name, value)
        };
        this.id = "";
        this.className = "";
        this.rect = null;
    }

    get childElementCount() {
        return this.children.length;
    }

    get firstElementChild() {
        return this.children[0] || null;
    }

    get isConnected() {
        let current = this;
        while (current.parentNode) current = current.parentNode;
        return current === this.ownerDocument.body;
    }

    set innerHTML(value) {
        if (value === "") {
            this.children.forEach((child) => { child.parentNode = null; });
            this.children = [];
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    appendChild(child) {
        child.parentNode = this;
        child.ownerDocument = this.ownerDocument;
        this.children.push(child);
        return child;
    }

    remove() {
        if (!this.parentNode) return;
        const siblings = this.parentNode.children;
        siblings.splice(siblings.indexOf(this), 1);
        this.parentNode = null;
    }

    getBoundingClientRect() {
        return this.rect;
    }
}

function createEnvironment({ reducedMotion = false } = {}) {
    let now = 0;
    let nextTimerId = 1;
    const timers = new Map();
    const listeners = new Map();
    const body = new FakeElement("body");
    const document = {
        body,
        visibilityState: "visible",
        createElement(tagName) {
            const element = new FakeElement(tagName);
            element.ownerDocument = document;
            return element;
        },
        getElementById(id) {
            const find = (element) => {
                if (element.id === id) return element;
                for (const child of element.children) {
                    const found = find(child);
                    if (found) return found;
                }
                return null;
            };
            return find(body);
        },
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        }
    };
    body.ownerDocument = document;

    function setTimeoutMock(callback, delay = 0) {
        const id = nextTimerId++;
        timers.set(id, { callback, due: now + Number(delay || 0) });
        return id;
    }

    function clearTimeoutMock(id) {
        timers.delete(id);
    }

    function advanceBy(duration) {
        const endTime = now + duration;
        while (true) {
            const next = [...timers.entries()]
                .filter(([, timer]) => timer.due <= endTime)
                .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
            if (!next) break;
            const [id, timer] = next;
            timers.delete(id);
            now = timer.due;
            timer.callback();
        }
        now = endTime;
    }

    const context = {
        document,
        setTimeout: setTimeoutMock,
        clearTimeout: clearTimeoutMock,
        Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
        console
    };
    context.window = context;
    context.innerWidth = 1000;
    context.innerHeight = 500;
    context.matchMedia = (query) => ({ matches: reducedMotion && query === "(prefers-reduced-motion: reduce)" });
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "vfx.js"), "utf8"), context, { filename: "vfx.js" });

    return {
        context,
        document,
        timers,
        listeners,
        advanceBy,
        setHidden(hidden) {
            document.visibilityState = hidden ? "hidden" : "visible";
            for (const listener of listeners.get("visibilitychange") || []) listener();
        }
    };
}

function effects(env) {
    return env.document.getElementById("vfx-layer")?.children || [];
}

function assertPosition(actual, expected) {
    const position = JSON.parse(JSON.stringify(actual));
    assert.ok(Math.abs(position.x - expected.x) < 1e-9, `x position ${position.x} should be ${expected.x}`);
    assert.ok(Math.abs(position.y - expected.y) < 1e-9, `y position ${position.y} should be ${expected.y}`);
}

function runLegacyCharacterization() {
    const env = createEnvironment();
    const { window } = env.context;
    for (const api of [
        "spawnVfx", "clearVfxLayer", "ensureVfxLayer", "clampVfxPercent",
        "resolveVfxPosition", "prefersReducedMotion", "triggerProjectileFX",
        "detectProjectileType", "detectSkillCssClass", "scheduleVfx"
    ]) {
        assert.equal(typeof window[api], "function", `${api} remains globally available`);
    }
    assert.equal(window.spawnVfx(), null);
    assert.equal(window.spawnVfx("hit"), true);
    assert.equal(window.ensureVfxLayer().id, "vfx-layer");
    assert.equal(window.ensureVfxLayer().style.pointerEvents, "none");
    assert.equal(window.ensureVfxLayer().getAttribute("aria-hidden"), "true");

    env.advanceBy(0);
    let node = effects(env)[0];
    assert.equal(node.className, "vfx-effect vfx-hit");
    assert.equal(node.getAttribute("aria-hidden"), "true");
    assert.equal(node.getAttribute("data-vfx-text"), null);
    assert.equal(node.properties.get("--vfx-x"), "50%");
    assert.equal(node.properties.get("--vfx-y"), "46%");
    assert.equal(node.properties.get("--vfx-duration"), "460ms");
    assert.equal(node.children.length, 3);
    assert.deepEqual(node.children.map((particle) => particle.properties.get("--particle-angle")), ["0deg", "120deg", "240deg"]);

    window.spawnVfx("heal", {
        anchor: "player", text: "+12 HP", variant: "mana!", count: 2,
        duration: 900, particleCount: 2
    });
    env.advanceBy(0);
    node = effects(env)[1];
    assert.equal(node.className, "vfx-effect vfx-heal vfx-variant-mana-");
    assert.equal(node.getAttribute("data-vfx-text"), "+12 HP");
    assert.equal(node.properties.get("--vfx-duration"), "900ms");
    assert.equal(node.children.length, 2);
    assert.equal(effects(env).length, 2);
    env.advanceBy(55);
    assert.equal(effects(env).length, 3);
    env.advanceBy(934);
    assert.equal(effects(env).length, 2);
    env.advanceBy(1);
    assert.equal(effects(env).length, 1);

    const anchors = {
        "monster-status-card": { left: 100, top: 50, width: 200, height: 100 },
        "status-panel-box": { left: 500, top: 200, width: 100, height: 100 },
        "log-wrapper-box": { left: 300, top: 300, width: 200, height: 100 }
    };
    for (const [id, rect] of Object.entries(anchors)) {
        const element = env.document.createElement("div");
        element.id = id;
        element.rect = rect;
        env.document.body.appendChild(element);
    }
    assertPosition(window.resolveVfxPosition({ anchor: "monster" }), { x: 20, y: 19 });
    assertPosition(window.resolveVfxPosition({ anchor: "player" }), { x: 55, y: 49 });
    assertPosition(window.resolveVfxPosition({ anchor: "log" }), { x: 40, y: 69 });
    assertPosition(window.resolveVfxPosition({ x: 0, y: 100 }), { x: 8, y: 92 });
    assertPosition(window.resolveVfxPosition({ x: 25 }), { x: 25, y: 45 });
    assertPosition(window.resolveVfxPosition({ anchor: "player" }), { x: 55, y: 49 });
    assert.equal(window.clampVfxPercent(Infinity, 46), 46);
    assertPosition(window.resolveVfxPosition({ anchor: "unknown" }), { x: 20, y: 19 });

    const fallback = createEnvironment();
    assertPosition(fallback.context.resolveVfxPosition({ anchor: "player" }), { x: 50, y: 38 });
    assertPosition(fallback.context.resolveVfxPosition({ anchor: "monster" }), { x: 50, y: 46 });
    assertPosition(fallback.context.resolveVfxPosition({ x: NaN, y: 80 }), { x: 50, y: 80 });
    assert.equal(window.detectProjectileType("炎爆術", "mage"), "fire");
    assert.equal(window.detectProjectileType("冰霜箭", "mage"), "ice");
    assert.equal(window.detectProjectileType("雷擊", "mage"), "lightning");
    assert.equal(window.detectProjectileType("聖光", "mage"), "holy");
    assert.equal(window.detectProjectileType("普通攻擊", "archer"), "arrow");
    assert.equal(window.detectProjectileType("", "mage"), "arcane");
    assert.equal(window.detectSkillCssClass("劇毒"), "skill-poison");
    assert.equal(window.detectSkillCssClass(""), "skill-bash");

    const cap = createEnvironment();
    cap.context.spawnVfx("hit", { count: 99, maxActive: 2, particleCount: 0 });
    cap.advanceBy(0);
    cap.advanceBy(55);
    cap.advanceBy(55);
    cap.advanceBy(55);
    assert.equal(effects(cap).length, 2);
    cap.advanceBy(1000);
    assert.equal(cap.timers.size, 0);

    const projectile = createEnvironment();
    projectile.context.triggerProjectileFX("fire", 6);
    projectile.advanceBy(0);
    for (let i = 0; i < 3; i++) {
        projectile.advanceBy(55);
    }
    assert.equal(effects(projectile).length, 4);
    assert.equal(effects(projectile)[0].className, "vfx-effect vfx-hit vfx-variant-projectile-fire");

    const reduced = createEnvironment({ reducedMotion: true });
    assert.equal(reduced.context.prefersReducedMotion(), true);
    reduced.context.spawnVfx("heal", { count: 6, duration: 900, particleCount: 4 });
    reduced.advanceBy(0);
    reduced.advanceBy(55);
    assert.equal(effects(reduced).length, 2);
    assert.equal(effects(reduced)[0].properties.get("--vfx-duration"), "900ms");
    assert.equal(effects(reduced)[0].children.length, 0);
    reduced.context.spawnVfx("hit", { duration: 900 });
    reduced.advanceBy(0);
    assert.equal(effects(reduced).length, 3);

    const css = fs.readFileSync(path.join(repoRoot, "css/04-components.css"), "utf8");
    assert.match(css, /\.vfx-layer\s*\{[^}]*pointer-events:\s*none/s);
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
}

function runLifecycleTests() {
    const clearBetweenBurstTimers = createEnvironment();
    clearBetweenBurstTimers.context.spawnVfx("hit", { count: 4 });
    clearBetweenBurstTimers.advanceBy(0);
    assert.equal(effects(clearBetweenBurstTimers).length, 1);
    clearBetweenBurstTimers.context.clearVfxLayer();
    clearBetweenBurstTimers.advanceBy(1000);
    assert.equal(effects(clearBetweenBurstTimers).length, 0);
    assert.equal(clearBetweenBurstTimers.timers.size, 0);

    const clearBeforeFirstTimer = createEnvironment();
    clearBeforeFirstTimer.context.spawnVfx("hit");
    clearBeforeFirstTimer.context.clearVfxLayer();
    clearBeforeFirstTimer.context.clearVfxLayer();
    clearBeforeFirstTimer.advanceBy(1000);
    assert.equal(effects(clearBeforeFirstTimer).length, 0);
    assert.equal(clearBeforeFirstTimer.timers.size, 0);

    const missingLayer = createEnvironment();
    missingLayer.context.clearVfxLayer();
    missingLayer.context.spawnVfx("hit");
    missingLayer.document.getElementById("vfx-layer").remove();
    missingLayer.context.clearVfxLayer();
    missingLayer.advanceBy(1000);
    assert.equal(missingLayer.timers.size, 0);

    const disconnectedLayer = createEnvironment();
    disconnectedLayer.context.spawnVfx("hit", { count: 3 });
    const layer = disconnectedLayer.document.getElementById("vfx-layer");
    layer.remove();
    disconnectedLayer.context.clearVfxLayer();
    disconnectedLayer.advanceBy(1000);
    assert.equal(disconnectedLayer.timers.size, 0);

    const clearPendingRemoval = createEnvironment();
    clearPendingRemoval.context.spawnVfx("hit", { duration: 1400 });
    clearPendingRemoval.advanceBy(0);
    assert.equal(clearPendingRemoval.timers.size, 1);
    clearPendingRemoval.context.clearVfxLayer();
    clearPendingRemoval.advanceBy(2000);
    assert.equal(clearPendingRemoval.timers.size, 0);
    assert.equal(effects(clearPendingRemoval).length, 0);

    const bossEntry = createEnvironment();
    let oldSceneSpawned = false;
    bossEntry.context.scheduleVfx(() => {
        oldSceneSpawned = true;
        bossEntry.context.spawnVfx("boss-entry");
    });
    bossEntry.context.clearVfxLayer();
    bossEntry.advanceBy(1000);
    assert.equal(oldSceneSpawned, false);
    assert.equal(effects(bossEntry).length, 0);
    assert.equal(bossEntry.timers.size, 0);

    const newScene = createEnvironment();
    newScene.context.spawnVfx("hit", { count: 3 });
    newScene.context.clearVfxLayer();
    newScene.context.spawnVfx("heal", { text: "+5 HP" });
    newScene.advanceBy(0);
    assert.equal(effects(newScene).length, 1);
    assert.equal(effects(newScene)[0].className, "vfx-effect vfx-heal");
    newScene.advanceBy(1000);
    assert.equal(newScene.timers.size, 0);

    const hiddenPage = createEnvironment();
    hiddenPage.context.spawnVfx("hit", { count: 3 });
    hiddenPage.advanceBy(0);
    assert.equal(effects(hiddenPage).length, 1);
    hiddenPage.setHidden(true);
    assert.equal(effects(hiddenPage).length, 0);
    assert.equal(hiddenPage.timers.size, 0);
    hiddenPage.context.spawnVfx("heal");
    hiddenPage.advanceBy(1000);
    assert.equal(effects(hiddenPage).length, 0);
    assert.equal(hiddenPage.timers.size, 0);
    hiddenPage.setHidden(false);
    assert.equal(hiddenPage.context.spawnVfx("shield"), true);
    hiddenPage.advanceBy(0);
    assert.equal(effects(hiddenPage).length, 1);

    const hiddenDuringScheduledCallback = createEnvironment();
    hiddenDuringScheduledCallback.context.scheduleVfx(() => {
        hiddenDuringScheduledCallback.context.spawnVfx("boss-entry");
    });
    hiddenDuringScheduledCallback.document.visibilityState = "hidden";
    hiddenDuringScheduledCallback.advanceBy(0);
    assert.equal(effects(hiddenDuringScheduledCallback).length, 0);
    assert.equal(hiddenDuringScheduledCallback.timers.size, 0);
}

function runSceneTransitionTests() {
    const env = createEnvironment();
    env.context.setInterval = () => 1;
    env.context.clearInterval = () => {};
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "game.js"), "utf8"), env.context, { filename: "game.js" });
    env.context.currentRun = { hp: 80, mp: 25, inventory: [], currentNodes: [] };
    env.context.accountMeta = { exp: 20, maxFloor: 1, warehouse: {} };
    env.context.dungeonFloor = 2;
    env.context.combatTickerTimer = null;
    env.context.updateUI = () => {};
    env.context.renderRouteSelectionPanel = () => {};
    env.context.addLog = () => {};

    env.context.gameState = "BATTLE";
    env.context.dungeonFloor = 10;
    env.context.currentRun = { gold: 0, exp: 0, inventory: [] };
    env.context.accountMeta = { exp: 0, nextExp: 1000, name: "Tester" };
    env.context.activeMonster = { name: "Test boss", hp: 0, isBoss: true };
    env.context.executeDungeonVictorySequence();
    env.advanceBy(0);
    assert.equal(effects(env)[0].className, "vfx-effect vfx-boss-defeat");
    assert.equal(env.context.gameState, "ENCOUNTER_RESOLVED");
    env.context.clearVfxLayer();

    env.context.gameState = "BATTLE";
    env.context.dungeonFloor = 10;
    vm.runInContext('startNodeCombat("BOSS")', env.context);
    assert.equal(env.timers.size, 1);
    env.context.handleMainAction();
    env.advanceBy(1000);
    assert.equal(env.context.gameState, "SELECT_ROUTE");
    assert.equal(effects(env).length, 0);
    assert.equal(env.timers.size, 0);

    env.context.gameState = "BATTLE";
    vm.runInContext('startNodeCombat("BOSS")', env.context);
    env.advanceBy(0);
    assert.equal(effects(env)[0].className, "vfx-effect vfx-boss-entry");
    env.context.handleMainAction();
    env.advanceBy(2000);
    assert.equal(effects(env).length, 0);
    assert.equal(env.timers.size, 0);

    env.context.gameState = "BATTLE";
    env.context.dungeonFloor = 2;
    env.context.spawnVfx("boss-defeat");
    env.advanceBy(0);
    assert.equal(effects(env).length, 1);
    const runBeforeTransition = JSON.stringify(env.context.currentRun);
    const accountBeforeTransition = JSON.stringify(env.context.accountMeta);
    env.context.handleMainAction();
    assert.equal(env.context.gameState, "SELECT_ROUTE");
    assert.equal(env.context.dungeonFloor, 3);
    assert.equal(JSON.stringify(env.context.currentRun), runBeforeTransition);
    assert.equal(JSON.stringify(env.context.accountMeta), accountBeforeTransition);
    env.advanceBy(2000);
    assert.equal(effects(env).length, 0);
    assert.equal(env.timers.size, 0);

    env.context.spawnVfx("hit");
    env.advanceBy(0);
    env.context.handleRerunAction();
    env.advanceBy(2000);
    assert.equal(env.context.gameState, "SELECT_ROUTE");
    assert.equal(effects(env).length, 0);
    assert.equal(env.timers.size, 0);

    env.context.accountMeta = { exp: 100, maxFloor: 1, warehouse: {} };
    env.context.currentRun = {
        hp: 10, mp: 2, maxHp: 10, maxMp: 2, inventory: [], currentNodes: [],
        shield: 0, poisonStacks: 0, burnStacks: 0
    };
    env.context.resetCurrentRunData = () => {};
    env.context.saveGameData = () => {};
    env.context.switchVillageLocation = () => {};
    env.context.spawnVfx("hit");
    env.advanceBy(0);
    env.context.handleSecondaryAction();
    env.advanceBy(2000);
    assert.equal(env.context.gameState, "VILLAGE");
    assert.equal(effects(env).length, 0);
    assert.equal(env.timers.size, 0);

    env.context.currentRun.exp = 70;
    env.context.spawnVfx("hit");
    env.advanceBy(0);
    env.context.executeDungeonDefeatSequence();
    env.advanceBy(2000);
    assert.equal(env.context.gameState, "VILLAGE");
    assert.equal(effects(env).length, 0);
    assert.equal(env.timers.size, 0);
}

function runStaticIntegrationChecks() {
    const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
    const game = fs.readFileSync(path.join(repoRoot, "game.js"), "utf8");
    const styles = fs.readFileSync(path.join(repoRoot, "css/04-components.css"), "utf8");
    assert.ok(html.indexOf('src="vfx.js"') < html.indexOf('src="ui.js"'));
    assert.ok(html.indexOf('src="vfx.js"') < html.indexOf('src="game.js"'));
    assert.match(game, /scheduleVfx\(\(\) => \{\s*spawnVfx\("boss-entry"/);
    assert.doesNotMatch(game, /setTimeout\(\(\) => \{\s*spawnVfx\("boss-entry"/);
    assert.match(styles, /\.vfx-layer\s*\{[^}]*z-index:\s*120/s);
    assert.match(styles, /\.vfx-variant-projectile-fire/);
}

require("node:child_process").execFileSync(process.execPath, [
    path.join(repoRoot, "scripts/check-refactor-baseline.js")
], { stdio: "inherit" });
runLegacyCharacterization();
runLifecycleTests();
runSceneTransitionTests();
runStaticIntegrationChecks();
console.log("✅ VFX characterization, lifecycle, scene-transition, and integration tests passed.");
