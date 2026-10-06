#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

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
        this.listeners = new Map();
        this.hidden = false;
        this.textContent = "";
        this.dataset = {};
        this.classList = {
            contains: (name) => this.className.split(/\s+/).includes(name),
            add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
            remove: (...names) => { this.className = this.className.split(/\s+/).filter((name) => !names.includes(name)).join(" "); },
            toggle: (name, force) => {
                const enabled = force ?? !this.classList.contains(name);
                this.classList[enabled ? "add" : "remove"](name);
                return enabled;
            }
        };
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

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }

    dispatchEvent(event) {
        for (const listener of this.listeners.get(event.type) || []) listener(event);
    }

    appendChild(child) {
        if (child.parentNode) child.remove();
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
        return this.rect || { left: 0, top: 0, width: 0, height: 0 };
    }

    getClientRects() {
        return this.hidden || this.style.display === "none" ? [] : [this.getBoundingClientRect()];
    }
}

function createEnvironment({ reducedMotion = false, source, storedSettings, storageFailure = false, preview = false } = {}) {
    let now = 0;
    let nextTimerId = 1;
    const timers = new Map();
    const listeners = new Map();
    const frames = new Map();
    const storage = new Map();
    let randomDraws = 0;
    if (storedSettings !== undefined) storage.set("abyss.vfx.preferences.v1", storedSettings);
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
        },
        removeEventListener(type, listener) {
            const list = listeners.get(type) || [];
            listeners.set(type, list.filter((entry) => entry !== listener));
        }
    };
    body.ownerDocument = document;

    function setTimeoutMock(callback, delay = 0) {
        const id = nextTimerId++;
        const value = Number(delay);
        timers.set(id, { callback, due: now + (Number.isFinite(value) ? Math.max(0, value) : 0) });
        return id;
    }

    function clearTimeoutMock(id) {
        timers.delete(id);
    }

    function advanceBy(duration) {
        const endTime = now + duration;
        let callbacks = 0;
        while (true) {
            const next = [...timers.entries()]
                .filter(([, timer]) => timer.due <= endTime)
                .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
            if (!next) break;
            assert.ok(++callbacks <= 100000, "timer queue must terminate");
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
        Math: Object.assign(Object.create(Math), { random: () => { randomDraws++; return 0.5; } }),
        Date: class extends Date { static now() { return now; } },
        performance: { now: () => now },
        requestAnimationFrame: (callback) => { const id = nextTimerId++; frames.set(id, callback); return id; },
        cancelAnimationFrame: (id) => frames.delete(id),
        getComputedStyle: (element) => ({ display: element.style.display || "block", visibility: element.style.visibility || "visible" }),
        localStorage: {
            getItem: (key) => { if (storageFailure) throw new Error("storage unavailable"); return storage.get(key) ?? null; },
            setItem: (key, value) => { if (storageFailure) throw new Error("storage unavailable"); storage.set(key, String(value)); },
            removeItem: (key) => storage.delete(key)
        },
        VFX_PREVIEW: preview,
        console
    };
    context.window = context;
    context.innerWidth = 1000;
    context.innerHeight = 500;
    const mediaListeners = new Set();
    const media = {
        matches: reducedMotion,
        addEventListener: (type, listener) => { if (type === "change") mediaListeners.add(listener); },
        removeEventListener: (type, listener) => mediaListeners.delete(listener),
        addListener: (listener) => mediaListeners.add(listener),
        removeListener: (listener) => mediaListeners.delete(listener)
    };
    context.matchMedia = () => media;
    context.addEventListener = (type, listener) => document.addEventListener(type, listener);
    context.removeEventListener = (type, listener) => document.removeEventListener(type, listener);
    vm.createContext(context);
    vm.runInContext(source ?? fs.readFileSync(path.join(repoRoot, "vfx.js"), "utf8"), context, { filename: "vfx.js" });

    return {
        context,
        document,
        timers,
        listeners,
        frames,
        storage,
        randomDraws: () => randomDraws,
        advanceBy,
        frame() {
            now += 16;
            const callbacks = [...frames.values()];
            frames.clear();
            callbacks.forEach((callback) => callback(now));
        },
        setReducedMotion(value) {
            media.matches = value;
            mediaListeners.forEach((listener) => listener({ matches: value }));
        },
        resize(width, height) {
            context.innerWidth = width;
            context.innerHeight = height;
            for (const listener of listeners.get("resize") || []) listener();
        },
        setHidden(hidden) {
            document.visibilityState = hidden ? "hidden" : "visible";
            for (const listener of listeners.get("visibilitychange") || []) listener();
        }
    };
}

function effects(env) {
    return (env.document.getElementById("vfx-layer")?.children || []).filter((node) => node.classList.contains("vfx-effect"));
}

function resultLabels(env) {
    return (env.document.getElementById("vfx-layer")?.children || []).filter((node) => node.classList.contains("vfx-result"));
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
    // Jitter keeps its legacy ±3% range but now uses the renderer's private stream,
    // not gameplay Math.random. The virtual Date seeds xorshift32 with 1.
    assert.equal(node.properties.get("--vfx-x"), `${50 - 2.9996222988702357}%`);
    assert.equal(node.properties.get("--vfx-y"), `${46 - 2.9055154309608042}%`);
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
    // ROUND TWO deliberately separates one aggregate label from burst decorations.
    // The legacy decoration class, duration, particles and burst timing stay exact.
    assert.equal(node.getAttribute("data-vfx-text"), null);
    assert.equal(resultLabels(env).length, 1);
    assert.equal(resultLabels(env)[0].getAttribute("data-vfx-text"), "+12 HP");
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
    // A projectile announces a cast, not a damage result; no hit/miss is invented.
    assert.equal(effects(projectile)[0].className, "vfx-effect vfx-cast vfx-variant-projectile-fire");
    assert.equal(resultLabels(projectile).length, 0);

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
    const preview = fs.readFileSync(path.join(repoRoot, "scripts/vfx-preview.html"), "utf8");
    assert.ok(html.indexOf('src="vfx.js"') < html.indexOf('src="ui.js"'));
    assert.ok(html.indexOf('src="vfx.js"') < html.indexOf('src="game.js"'));
    assert.match(game, /scheduleVfx\(\(\) => \{\s*spawnVfx\("boss-entry"/);
    assert.doesNotMatch(game, /setTimeout\(\(\) => \{\s*spawnVfx\("boss-entry"/);
    assert.match(styles, /\.vfx-layer\s*\{[^}]*z-index:\s*120/s);
    assert.match(styles, /\.vfx-variant-projectile-fire/);
    for (const id of ["vfx-style", "vfx-quality", "vfx-reduce-motion"]) {
        assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} has one real HTML control`);
    }
    assert.ok(preview.indexOf("window.VFX_PREVIEW = true") < preview.indexOf('src="../vfx.js"'), "preview isolation flag precedes renderer evaluation");
    assert.doesNotMatch(preview, /<script[^>]+src=["'][^"']*(?:game|state|ui|statengine)\.js/);
    assert.doesNotMatch(preview, /\b(?:fetch|saveGameData|initOrLoadPlayer)\s*\(/);
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function assertClean(env) {
    const diagnostics = env.context.getVfxDiagnostics();
    for (const key of ["activeDecorations", "totalParticles", "queuedDecorations", "externalSchedules", "activeLabels", "queuedLabels", "pendingTimers", "followingNodes"]) {
        assert.equal(diagnostics[key], 0, `${key} returns to zero`);
    }
    assert.equal(diagnostics.followUpdaterActive, false);
    assert.equal(diagnostics.labelRetryActive ?? false, false);
    assert.equal(env.timers.size, 0);
    assert.equal(env.frames.size, 0);
}

function assertBounded(env) {
    const d = env.context.getVfxDiagnostics();
    for (const [key, limit] of [
        ["activeDecorations", "decorations"], ["totalParticles", "particles"],
        ["queuedDecorations", "queuedDecorations"], ["externalSchedules", "externalSchedules"],
        ["activeLabels", "activeLabels"], ["queuedLabels", "queuedLabels"]
    ]) {
        assert.ok(Number.isFinite(d[key]) && d[key] >= 0 && d[key] <= d.caps[limit], `${key} ${d[key]} exceeds ${limit} ${d.caps[limit]}`);
    }
    assert.equal(effects(env).length, d.activeDecorations, "diagnostics match decoration DOM");
    assert.equal(resultLabels(env).length, d.activeLabels, "diagnostics match label DOM");
    assert.equal(effects(env).reduce((count, node) => count + node.children.length, 0), d.totalParticles, "particle accounting matches DOM");
    assert.equal(env.timers.size, d.pendingTimers, "tracked timer accounting matches actual scheduler");
    assert.ok(d.pendingTimers <= d.caps.queuedDecorations + d.caps.externalSchedules + d.caps.decorations + d.caps.activeLabels + 2, "all timer classes have a finite combined budget");
    for (const [key, value] of Object.entries(d.counters)) {
        assert.ok(Number.isSafeInteger(value) && value >= 0, `${key} cumulative diagnostics remain finite`);
    }
}

function runSettingsAndRegistryTests() {
    const env = createEnvironment();
    const c = env.context;
    for (const api of ["getVfxSettings", "setVfxSettings", "getVfxDiagnostics", "spawnVfxResult"]) assert.equal(typeof c[api], "function");
    const defaults = { style: "legacy", quality: "standard", reduceMotion: false };
    assert.deepEqual(plain(c.getVfxSettings()), defaults);
    const copy = c.getVfxSettings();
    copy.quality = "high";
    assert.equal(c.getVfxSettings().quality, "standard", "settings are returned by value");
    for (const patch of [null, 3, "enhanced", {}, { style: "bad", quality: "ultra", reduceMotion: "false" }, { style: NaN, quality: null, reduceMotion: 1 }]) {
        assert.deepEqual(plain(c.setVfxSettings(patch, { persist: false })), defaults, "invalid preferences do not change valid defaults");
    }
    const nonStringKeys = [Object.create(null), { toString() { throw new Error("must not coerce registry keys"); } }];
    for (const quality of nonStringKeys) {
        assert.deepEqual(plain(c.setVfxSettings({ quality }, { persist: false })), defaults, "registry preferences never coerce malformed keys");
    }
    assert.equal(env.storage.size, 0, "persist:false never writes preferences");
    c.setVfxSettings({ style: "enhanced", quality: "high", reduceMotion: true });
    assert.deepEqual(JSON.parse(env.storage.get("abyss.vfx.preferences.v1")), { style: "enhanced", quality: "high", reduceMotion: true });
    c.setVfxSettings({ quality: "low" }, { persist: false });
    assert.equal(JSON.parse(env.storage.get("abyss.vfx.preferences.v1")).quality, "high");
    const restored = createEnvironment({ storedSettings: env.storage.get("abyss.vfx.preferences.v1") });
    assert.deepEqual(plain(restored.context.getVfxSettings()), { style: "enhanced", quality: "high", reduceMotion: true });
    for (const storedSettings of ["invalid JSON", "null", "[]", "17", '{"style":"bogus","quality":"bogus","reduceMotion":"true"}']) {
        assert.deepEqual(plain(createEnvironment({ storedSettings }).context.getVfxSettings()), defaults);
    }
    const partial = createEnvironment({ storedSettings: '{"style":"enhanced","quality":"invalid","reduceMotion":true}' });
    assert.deepEqual(plain(partial.context.getVfxSettings()), { style: "enhanced", quality: "standard", reduceMotion: true });
    const failedStorage = createEnvironment({ storageFailure: true });
    assert.deepEqual(plain(failedStorage.context.getVfxSettings()), defaults);
    assert.doesNotThrow(() => failedStorage.context.setVfxSettings({ quality: "low" }));
    assert.equal(failedStorage.context.getVfxSettings().quality, "low", "storage errors must not disable settings");
    const preview = createEnvironment({ preview: true, storedSettings: '{"style":"enhanced","quality":"high","reduceMotion":true}' });
    assert.deepEqual(plain(preview.context.getVfxSettings()), defaults, "preview never inherits gameplay preferences");
    const saved = [...preview.storage.entries()];
    preview.context.setVfxSettings({ style: "enhanced", quality: "low" });
    assert.deepEqual([...preview.storage.entries()], saved, "preview never overwrites gameplay preferences");
    assert.equal(env.context.currentRun, undefined, "renderer has no gameplay state");
    assert.equal(preview.context.currentRun, undefined, "preview has no gameplay state");

    assert.ok(Object.isFrozen(c.VFX_EFFECTS));
    for (const type of ["hit", "crit", "cast", "heal", "shield", "miss", "boss-entry", "boss-defeat"]) {
        const spec = c.VFX_EFFECTS[type];
        assert.ok(Object.isFrozen(spec), `${type} registry entry is immutable`);
        assert.ok(Number.isFinite(spec.duration) && spec.duration >= 120 && spec.duration <= 1400);
        assert.ok(Number.isFinite(spec.priority) && spec.priority >= 0 && spec.priority <= 5);
        assert.equal(typeof spec.color, "string");
        assert.equal(typeof spec.shape, "string");
    }
    assert.equal(c.spawnVfx("unknown-type", { text: "-10" }), null);
    assert.equal(c.spawnVfx("__proto__"), null);
    for (const key of nonStringKeys) {
        assert.equal(c.spawnVfx(key), null, "effect registry rejects non-string keys without coercion");
        assert.equal(c.detectProjectileType({ name: "冰霜箭", vfx: { element: key } }), "ice");
        assert.equal(c.detectSkillCssClass({ name: "劇毒", vfx: { element: key } }), "skill-poison");
        assertPosition(c.resolveVfxPosition({ anchor: key }), { x: 50, y: 46 });
        assert.equal(c.spawnVfxResult(key, { anchor: key, text: "-1" }), true, "invalid result kind safely falls back without coercion");
        env.advanceBy(0);
        assert.equal(resultLabels(env)[0].getAttribute("data-vfx-kind"), "HIT");
        c.clearVfxLayer();
        assertClean(env);
    }
    const skill = { name: "火炎雷冰", vfx: { element: "ice" } };
    assert.equal(c.detectProjectileType(skill, "archer"), "ice", "metadata precedes name/job heuristics");
    assert.equal(c.detectSkillCssClass(skill, "archer"), "skill-ice");
    for (const element of ["fire", "ice", "lightning", "holy", "poison", "slash", "arrow", "arcane"]) {
        const meta = { name: "neutral", vfx: { element } };
        assert.equal(c.detectProjectileType(meta), element);
        assert.equal(c.detectSkillCssClass(meta), `skill-${element}`);
    }
    assert.equal(c.detectProjectileType({ name: "冰霜箭", vfx: { element: "invalid" } }), "ice");
    assert.equal(c.detectSkillCssClass({ name: "劇毒", vfx: { element: "invalid" } }), "skill-poison");
    assert.equal(c.detectProjectileType({ name: "普通攻擊" }, "hunter"), "arrow");
    for (const [name, projectile, cssClass] of [
        ["劇毒", "arcane", "skill-poison"],
        ["斬擊", "arcane", "skill-bash"],
        ["頌歌", "arcane", "skill-holy"],
        ["驅魔", "holy", "skill-bash"]
    ]) {
        assert.equal(c.detectProjectileType(name), projectile, `${name}: exact asymmetric legacy projectile fallback`);
        assert.equal(c.detectSkillCssClass(name), cssClass, `${name}: exact asymmetric legacy CSS fallback`);
    }
    assert.equal(c.detectSkillCssClass("普通攻擊", "archer"), "skill-bash", "archer job fallback remains projectile-only");
    for (const malformed of [null, undefined, 10, {}, { name: 10 }, { vfx: null }]) {
        assert.doesNotThrow(() => c.detectProjectileType(malformed));
        assert.doesNotThrow(() => c.detectSkillCssClass(malformed));
    }
    assertClean(env);
    c.setVfxSettings({ style: "enhanced" }, { persist: false });
    const shapes = { fire: "fire", ice: "ice", lightning: "lightning", holy: "rise", poison: "hollow", slash: "slash", arrow: "arrow", arcane: "ring" };
    for (const [element, shape] of Object.entries(shapes)) {
        c.spawnVfx("hit", { element });
        env.advanceBy(0);
        assert.equal(effects(env)[0].getAttribute("data-vfx-shape"), shape, `${element} chooses its registered visual shape`);
        assert.match(effects(env)[0].properties.get("--vfx-color"), /^#[0-9a-f]{6}$/i);
        c.clearVfxLayer();
        assertClean(env);
    }
}

function runSettingsUiTests() {
    const env = createEnvironment({ storedSettings: '{"style":"enhanced","quality":"high","reduceMotion":true}' });
    const controls = {};
    for (const id of ["vfx-style", "vfx-quality", "vfx-reduce-motion"]) {
        controls[id] = env.document.createElement(id === "vfx-reduce-motion" ? "input" : "select");
        controls[id].id = id;
        env.document.body.appendChild(controls[id]);
    }
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "ui.js"), "utf8"), env.context, { filename: "ui.js" });
    assert.equal(controls["vfx-style"].value, "enhanced");
    assert.equal(controls["vfx-quality"].value, "high");
    assert.equal(controls["vfx-reduce-motion"].checked, true);
    for (const [id, property, value, setting] of [
        ["vfx-style", "value", "legacy", "style"],
        ["vfx-quality", "value", "low", "quality"],
        ["vfx-reduce-motion", "checked", false, "reduceMotion"]
    ]) {
        controls[id][property] = value;
        controls[id].dispatchEvent({ type: "change" });
        assert.equal(env.context.getVfxSettings()[setting], value, "actual UI change listener updates settings");
        assert.equal(JSON.parse(env.storage.get("abyss.vfx.preferences.v1"))[setting], value, "actual UI setting persists");
    }
    assert.equal(env.context.currentRun, undefined, "settings UI never initializes or mutates gameplay");
    assertClean(env);
}

function runBoundedRendererTests() {
    for (const quality of ["low", "standard", "high"]) {
        for (const reducedMotion of [false, true]) {
            const env = createEnvironment({ reducedMotion });
            const c = env.context;
            c.setVfxSettings({ style: "enhanced", quality }, { persist: false });
            for (const value of [NaN, Infinity, -Infinity, -1, 0, 1e12, "999999999", null, {}, 1.7]) {
                c.spawnVfx("hit", { maxActive: value, count: value, particleCount: value, duration: value, text: "-5", resolvedCount: 6 });
                assertBounded(env);
                env.advanceBy(200);
                assertBounded(env);
                for (const node of [...effects(env), ...resultLabels(env)]) {
                    const duration = Number.parseFloat(node.properties.get("--vfx-duration"));
                    assert.ok(Number.isFinite(duration) && duration >= 120 && duration <= 1400, "invalid input cannot escape duration bounds");
                    assert.ok(!node.properties.get("--vfx-x").includes("NaN"));
                    assert.ok(node.children.length <= c.getVfxDiagnostics().caps.perNode);
                }
                c.clearVfxLayer();
                assertClean(env);
            }
            for (let i = 0; i < 500; i++) {
                c.spawnVfx(i % 2 ? "hit" : "crit", { count: 1000000, particleCount: 1000000, duration: 1000000, maxActive: 1000000, text: `-${i}`, anchor: ["player", "monster", "log"][i % 3], resolvedCount: 6 });
                c.scheduleVfx(() => c.spawnVfx("boss-entry"), 1000);
                assertBounded(env);
            }
            const queued = c.getVfxDiagnostics();
            assert.equal(queued.queuedDecorations, queued.caps.queuedDecorations, "stress fills but cannot exceed the decorative queue");
            assert.equal(queued.externalSchedules, queued.caps.externalSchedules, "external callback queue has independent hard budget");
            assert.equal(c.scheduleVfx(() => {}, 1000), false, "saturated external queue rejects work");
            env.advanceBy(200);
            assertBounded(env);
            const active = c.getVfxDiagnostics();
            assert.equal(active.activeDecorations, active.caps.decorations, "stress still renders up to the bounded decoration budget");
            assert.equal(active.activeLabels, active.caps.activeLabels, "stress preserves separate label admission");
            env.advanceBy(20000);
            assertClean(env);
            assert.equal(env.randomDraws(), 0, "renderer uses a private RNG stream");
        }
    }
    const priority = createEnvironment();
    const c = priority.context;
    c.spawnVfx("boss-defeat", { maxActive: 1, text: "VICTORY", duration: 1400 });
    priority.advanceBy(0);
    const boss = effects(priority)[0];
    const label = resultLabels(priority)[0];
    c.spawnVfx("cast", { maxActive: 1 });
    priority.advanceBy(0);
    assert.deepEqual(effects(priority), [boss], "low-priority cast cannot evict boss defeat");
    assert.equal(label.isConnected, true, "decoration admission cannot erase an authoritative label");
    assert.equal(c.getVfxDiagnostics().counters.droppedDecorations, 1, "blocked low-priority admission is diagnosed");
    c.spawnVfx("hit", { maxActive: 1, text: "-4" });
    priority.advanceBy(0);
    assert.deepEqual(effects(priority), [boss]);
    assert.ok(resultLabels(priority).some((node) => node.textContent === "HIT -4"), "authoritative label is admitted even when its decoration is rejected");
    c.spawnVfx("crit", { maxActive: 1, priority: 5 });
    priority.advanceBy(0);
    assert.equal(boss.isConnected, false, "equal-priority admission evicts oldest decoration");
    assert.equal(effects(priority)[0].className, "vfx-effect vfx-crit");
    assert.equal(label.isConnected, true);
    assert.equal(c.getVfxDiagnostics().counters.evictedDecorations, 1, "active decoration eviction is diagnosed");
    assert.equal(c.getVfxDiagnostics().counters.spawnedDecorations, 2);
    assert.equal(c.getVfxDiagnostics().counters.spawnedLabels, 2);
    assertBounded(priority);
    priority.advanceBy(3000);
    assertClean(priority);
    for (const delay of [NaN, Infinity, -Infinity, -100, 1e12]) {
        assert.equal(c.scheduleVfx(() => {}, delay), true);
        assert.ok([...priority.timers.values()].every((timer) => timer.due <= 13000), "external delays are hard-bounded to ten seconds");
    }
    assert.equal(c.scheduleVfx(null), false);
    c.clearVfxLayer();
    assertClean(priority);
    for (const malformed of [null, undefined, 17, "options"]) {
        assert.doesNotThrow(() => c.spawnVfx("hit", malformed));
        c.clearVfxLayer();
        assertClean(priority);
    }
    const queuedPriority = createEnvironment();
    const q = queuedPriority.context;
    for (let i = 0; i < 48; i++) q.spawnVfx("cast");
    q.spawnVfx("boss-defeat");
    assert.equal(q.getVfxDiagnostics().counters.evictedQueuedDecorations, 1, "high-priority event replaces a queued low-priority cast");
    for (let i = 0; i < 48; i++) q.spawnVfx("boss-defeat");
    const before = q.getVfxDiagnostics();
    assert.equal(q.spawnVfx("cast"), null, "low-priority work cannot displace a full high-priority queue");
    assert.equal(q.getVfxDiagnostics().counters.droppedDecorations, before.counters.droppedDecorations + 1);
    queuedPriority.advanceBy(0);
    assert.ok(effects(queuedPriority).every((node) => node.classList.contains("vfx-boss-defeat")));
    assertBounded(queuedPriority);
    const copy = q.getVfxDiagnostics();
    copy.caps.decorations = 9999;
    copy.counters.evictedDecorations = -1;
    assert.equal(q.getVfxDiagnostics().caps.decorations, 24, "diagnostic copies cannot change budgets");
    assert.ok(q.getVfxDiagnostics().counters.evictedDecorations >= 0);
    q.clearVfxLayer();
    assertClean(queuedPriority);
    assert.ok(q.getVfxDiagnostics().counters.evictedQueuedDecorations > 0, "lifetime counters survive scene teardown");
}

function runResultLabelTests() {
    const env = createEnvironment();
    const c = env.context;
    c.spawnVfx("hit", { text: "-120", count: 999, resolvedCount: 6, maxActive: 1 });
    env.advanceBy(200);
    assert.equal(effects(env).length, 1, "decoration budget can evict burst decoration");
    assert.equal(resultLabels(env).length, 1, "a burst generates exactly one aggregate label");
    const hit = resultLabels(env)[0];
    assert.equal(hit.textContent, "HIT -120 ×6", "display reports actual resolved hits, not visual burst count");
    assert.equal(hit.getAttribute("data-vfx-kind"), "HIT");
    assert.equal(hit.getAttribute("aria-hidden"), "true");
    assert.ok(effects(env).every((node) => node.getAttribute("data-vfx-text") === null));
    for (let i = 0; i < 20; i++) {
        c.spawnVfx("cast", { maxActive: 1 });
        env.advanceBy(0);
    }
    assert.equal(hit.isConnected, true, "decorative floods do not evict result labels");
    c.clearVfxLayer();
    for (const [type, options, kind] of [
        ["heal", { text: "+7 HP" }, "HP"], ["heal", { text: "+3 MP", variant: "mana" }, "MP"],
        ["shield", { text: "+15" }, "SHIELD"], ["crit", { text: "-30" }, "CRIT"],
        ["miss", { text: "MISS" }, "MISS"]
    ]) {
        c.clearVfxLayer();
        c.spawnVfx(type, { ...options, anchor: "player" });
        env.advanceBy(0);
        assert.equal(resultLabels(env).length, 1);
        assert.equal(resultLabels(env)[0].getAttribute("data-vfx-kind"), kind);
    }
    c.clearVfxLayer();
    for (let i = 0; i < 50; i++) c.spawnVfxResult("HIT", { anchor: "monster", text: `-${i}`, duration: 120 });
    env.advanceBy(0);
    assert.equal(resultLabels(env).length, 4);
    assert.ok(c.getVfxDiagnostics().counters.droppedLabels > 0, "bounded label queue overflow is diagnosed");
    assert.deepEqual(resultLabels(env).map((node) => node.properties.get("--vfx-lane")), ["0", "1", "2", "3"], "deterministic per-anchor lanes");
    assert.equal(new Set(resultLabels(env).map((node) => node.properties.get("--vfx-lane"))).size, 4, "labels cannot overlap a lane");
    assertBounded(env);
    const laneLifetime = Number.parseFloat(resultLabels(env)[0].properties.get("--vfx-duration")) + 90;
    env.advanceBy(laneLifetime);
    assert.deepEqual(resultLabels(env).map((node) => node.textContent), ["HIT -4", "HIT -5", "HIT -6", "HIT -7"], "bounded label queue drains in FIFO order");
    env.advanceBy(5000);
    assertClean(env);
    for (const anchor of ["monster", "player", "log"]) {
        for (let i = 0; i < 4; i++) c.spawnVfxResult("SHIELD", { anchor, text: `+${i}` });
    }
    env.advanceBy(0);
    assert.equal(resultLabels(env).length, 12, "anchors have independent lanes within global cap");
    assertBounded(env);
    c.clearVfxLayer();
    assertClean(env);
    c.spawnVfx("miss", { text: "MISS", resolvedCount: 1 });
    env.advanceBy(0);
    assert.equal(resultLabels(env)[0].textContent, "MISS");
    assert.doesNotMatch(resultLabels(env)[0].textContent, /×/);
    c.clearVfxLayer();
    assertClean(env);
    c.spawnVfx("crit", { text: "-42", count: 4, resolvedCount: 3 });
    env.advanceBy(200);
    assert.equal(resultLabels(env).length, 1);
    assert.equal(resultLabels(env)[0].textContent, "CRIT -42 ×3", "label count follows resolution, not requested hits or decorations");
    c.clearVfxLayer();
    assertClean(env);
    c.spawnVfx("hit", { text: "-60", count: 999, resolvedCount: 6 });
    env.advanceBy(200);
    assert.equal(effects(env).length, 4, "explicit decoration count remains capped independently of logical hit count");
    assert.equal(resultLabels(env).length, 1);
    assert.equal(resultLabels(env)[0].textContent, "HIT -60 ×6");
    c.clearVfxLayer();
    assertClean(env);
    c.spawnVfx("hit", { text: "-60", resolvedCount: 6 });
    env.advanceBy(200);
    assert.equal(effects(env).length, 1, "aggregate resolvedCount does not change the legacy single-decoration default");
    assert.equal(resultLabels(env).length, 1);
    assert.equal(resultLabels(env)[0].textContent, "HIT -60 ×6");
    c.clearVfxLayer();
    assertClean(env);
    for (const reducedMotion of [false, true]) {
        env.setReducedMotion(reducedMotion);
        c.spawnVfx("hit", { text: "-1" });
        env.advanceBy(0);
        assert.equal(resultLabels(env)[0].properties.get("--vfx-duration"), reducedMotion ? "500ms" : "700ms", "default result lifetime stays independent of decoration default");
        c.clearVfxLayer();
        for (const duration of [120, -1, 0, NaN, Infinity]) {
            c.spawnVfx("hit", { text: "-1", duration });
            env.advanceBy(0);
            const decorationDuration = Number.parseFloat(effects(env)[0].properties.get("--vfx-duration"));
            const resultDuration = Number.parseFloat(resultLabels(env)[0].properties.get("--vfx-duration"));
            assert.ok(decorationDuration >= 120 && decorationDuration <= 460);
            assert.ok(resultDuration >= 500 && resultDuration <= 1400, "short/negative/invalid decoration lifetime cannot shorten its essential result below 500ms");
            if (Number.isFinite(duration)) {
                assert.equal(decorationDuration, 120);
                assert.equal(resultDuration, 500);
            }
            c.clearVfxLayer();
            assertClean(env);
        }
        for (const labelDuration of [-100, 1, 900, 1e12]) {
            c.spawnVfx("hit", { text: "-1", duration: 120, labelDuration });
            env.advanceBy(0);
            assert.equal(effects(env)[0].properties.get("--vfx-duration"), "120ms");
            assert.equal(Number.parseFloat(resultLabels(env)[0].properties.get("--vfx-duration")), Math.min(1400, Math.max(500, labelDuration)), "labelDuration overrides decoration lifetime with independent readability caps");
            c.clearVfxLayer();
            assertClean(env);
        }
    }
}

function runAnchorAndMotionTests() {
    const env = createEnvironment();
    const c = env.context;
    const anchor = env.document.createElement("div");
    anchor.id = "monster-status-card";
    anchor.rect = { left: 100, top: 50, width: 200, height: 100 };
    env.document.body.appendChild(anchor);
    c.spawnVfx("hit", { anchor: "monster", positionMode: "snapshot", duration: 1400 });
    c.spawnVfx("shield", { anchor: "monster", positionMode: "follow", duration: 1400 });
    c.spawnVfxResult("HP", { anchor: "monster", positionMode: "follow", text: "+5", duration: 1400 });
    env.advanceBy(0);
    const snapshot = effects(env)[0];
    const follow = effects(env)[1];
    const label = resultLabels(env)[0];
    const snapshotX = `${20 - 2.9996222988702357}%`;
    const followDx = 0.6984246145002544;
    const followDy = -2.570288190152496;
    assert.equal(snapshot.properties.get("--vfx-x"), snapshotX);
    assert.equal(follow.properties.get("--vfx-x"), `${20 + followDx}%`);
    anchor.rect = { left: 400, top: 200, width: 200, height: 100 };
    env.advanceBy(50);
    assert.equal(snapshot.properties.get("--vfx-x"), snapshotX, "snapshot remains at impact coordinates");
    assert.equal(follow.properties.get("--vfx-x"), `${50 + followDx}%`, "follow tracks moving anchors while preserving jitter");
    assert.equal(label.properties.get("--vfx-x"), "50%", "result labels may follow too");
    assert.equal(c.getVfxDiagnostics().followingNodes, 2);
    for (const visibility of ["hidden", "display", "visibility", "aria", "dead", "missing"]) {
        const previous = follow.properties.get("--vfx-x");
        anchor.rect.left = 600;
        if (visibility === "hidden") anchor.hidden = true;
        if (visibility === "display") anchor.style.display = "none";
        if (visibility === "visibility") anchor.style.visibility = "hidden";
        if (visibility === "aria") anchor.setAttribute("aria-hidden", "true");
        if (visibility === "dead") anchor.rect.width = 0;
        if (visibility === "missing") anchor.remove();
        env.advanceBy(50);
        assert.equal(follow.properties.get("--vfx-x"), previous, `${visibility} anchor freezes last valid position`);
        assert.ok(Number.isFinite(Number.parseFloat(c.resolveVfxPosition({ anchor: "monster" }).x)));
        anchor.hidden = false;
        anchor.style.display = "";
        anchor.style.visibility = "";
        anchor.removeAttribute("aria-hidden");
        anchor.rect.width = 200;
        anchor.rect.left = 400;
        if (!anchor.isConnected) env.document.body.appendChild(anchor);
    }
    c.innerWidth = 2000;
    c.innerHeight = 1000;
    env.advanceBy(50);
    assert.equal(follow.properties.get("--vfx-x"), `${25 + followDx}%`, "follow recalculates on viewport resize");
    assert.equal(follow.properties.get("--vfx-y"), `${24.5 + followDy}%`);
    assert.equal(snapshot.properties.get("--vfx-x"), snapshotX, "snapshot survives viewport resize");
    follow.remove();
    label.remove();
    env.advanceBy(50);
    assert.equal(c.getVfxDiagnostics().followingNodes, 0, "disconnected follow nodes release their updater");
    assert.equal(c.getVfxDiagnostics().followUpdaterActive, false);
    c.clearVfxLayer();
    assertClean(env);
    c.spawnVfx("hit", { anchor: "player", positionMode: "follow" });
    env.advanceBy(0);
    assert.equal(effects(env)[0].properties.get("--vfx-y"), `${38 - 1.9585548117756844}%`, "missing anchor uses safe fallback plus deterministic private jitter");
    env.advanceBy(2000);
    assertClean(env);

    c.spawnVfx("hit", { count: 4, duration: 1400, text: "-5" });
    env.advanceBy(0);
    env.setReducedMotion(true);
    assert.equal(c.prefersReducedMotion(), true);
    assertClean(env);
    assert.ok(c.ensureVfxLayer().classList.contains("vfx-reduced-motion"));
    c.spawnVfx("hit", { count: 99, particleCount: 99, duration: 900, text: "-5" });
    env.advanceBy(100);
    assert.equal(effects(env).length, 2);
    assert.ok(effects(env).every((node) => node.children.length === 0), "system reduced motion suppresses all particles");
    assert.equal(resultLabels(env).length, 1, "reduced motion retains authoritative result labels");
    c.setVfxSettings({ reduceMotion: true }, { persist: false });
    env.setReducedMotion(false);
    assert.equal(c.prefersReducedMotion(), true, "user reduced motion OR system preference");
    c.setVfxSettings({ reduceMotion: false }, { persist: false });
    assert.equal(c.prefersReducedMotion(), false);
    assertClean(env);
    c.spawnVfx("hit", { count: 4, positionMode: "follow", text: "-7" });
    env.advanceBy(0);
    c.setVfxSettings({ quality: "low" }, { persist: false });
    assertClean(env);
    env.advanceBy(5000);
    assertClean(env);
    c.spawnVfx("hit", { text: "-5" });
    env.advanceBy(0);
    env.setHidden(true);
    assertClean(env);
    env.setHidden(false);
    c.spawnVfx("hit");
    env.advanceBy(0);
    assert.equal(effects(env).length, 1, "visible scene can resume rendering");
    c.clearVfxLayer();
    assertClean(env);
}

function runLabelLayoutTests() {
    const env = createEnvironment();
    const c = env.context;
    const css = fs.readFileSync(path.join(repoRoot, "css/04-components.css"), "utf8");
    assert.match(css, /\.vfx-result\s*\{[^}]*box-sizing:\s*border-box/s, "measured label outer width includes borders and padding at the production max-width");
    assert.match(css, /\.vfx-result\s*\{[^}]*width:\s*max-content\s*;/s, "label width stays intrinsic as pixel clamping changes left, avoiding stale shrink-to-fit extents");
    assert.match(css, /\.vfx-result\s*\{[^}]*max-width:\s*min\(85vw,\s*320px\)/s, "intrinsic label width retains its production viewport cap");
    const laneSpacing = Number(/var\(--vfx-lane,\s*0\)\s*\*\s*([0-9.]+)px/.exec(css)?.[1]);
    assert.ok(Number.isFinite(laneSpacing) && laneSpacing > 0, "layout uses actual production CSS lane spacing");
    function assertLayout() {
        const boxes = resultLabels(env).map((node) => {
            const width = Math.min(c.innerWidth * 0.85, 320, node.textContent.length * 9 + 20);
            const x = Number.parseFloat(node.properties.get("--vfx-x")) / 100 * c.innerWidth;
            const lane = Number(node.properties.get("--vfx-lane"));
            const y = Number.parseFloat(node.properties.get("--vfx-y")) / 100 * c.innerHeight - lane * laneSpacing;
            const box = { left: x - width / 2 - 2, right: x + width / 2 + 2, top: y - 26, bottom: y + 18 };
            assert.ok(box.left >= -1e-9 && box.right <= c.innerWidth + 1e-9, "label stays inside viewport horizontally");
            assert.ok(box.top >= -1e-9 && box.bottom <= c.innerHeight + 1e-9, "full label rise path stays inside viewport vertically");
            assert.ok(Number.parseFloat(node.properties.get("--vfx-duration")) >= 500, "authoritative labels retain readable lifetime");
            return box;
        });
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i];
                const b = boxes[j];
                assert.ok(!(a.left < b.right - 1e-9 && a.right > b.left + 1e-9 && a.top < b.bottom - 1e-9 && a.bottom > b.top + 1e-9), `coincident anchor label paths overlap: ${JSON.stringify([a, b])}`);
            }
        }
    }
    env.resize(320, 480);
    for (let i = 0; i < 12; i++) {
        c.spawnVfxResult("HIT", {
            text: `-${i}`, anchor: ["player", "monster", "log"][i % 3],
            x: 95, y: 95, duration: 120
        });
    }
    env.advanceBy(0);
    assert.equal(resultLabels(env).length, 12);
    assertLayout();
    env.resize(280, 360);
    assertLayout();
    assertBounded(env);
    env.resize(10, 10);
    assert.equal(resultLabels(env).length, 0, "impossible viewport defers labels rather than clipping them");
    assert.equal(c.getVfxDiagnostics().queuedLabels, 12);
    assert.equal(c.getVfxDiagnostics().pendingTimers, 1, "deferred layout uses only one bounded retry timer");
    env.resize(1000, 500);
    assert.equal(resultLabels(env).length, 12, "viewport recovery drains deferred labels");
    assertLayout();
    env.advanceBy(5000);
    assertClean(env);
    env.resize(10, 10);
    const droppedBefore = c.getVfxDiagnostics().counters.droppedLabels;
    for (let i = 0; i < 12; i++) c.spawnVfxResult("HIT", { text: `-${i}` });
    env.advanceBy(0);
    const { labelRetryDelay, labelRetryLimit } = c.getVfxDiagnostics().caps;
    assert.ok(Number.isFinite(labelRetryDelay) && labelRetryDelay > 0);
    assert.ok(Number.isSafeInteger(labelRetryLimit) && labelRetryLimit > 0 && labelRetryLimit <= 10);
    for (let i = 0; i < labelRetryLimit - 1; i++) {
        env.advanceBy(labelRetryDelay);
        assertBounded(env);
        assert.ok(c.getVfxDiagnostics().pendingTimers <= 1, "layout retries never fan out");
    }
    env.advanceBy(labelRetryDelay - 1);
    assert.equal(c.getVfxDiagnostics().queuedLabels, 12, "unplaceable labels remain bounded until the final retry deadline");
    assert.equal(c.getVfxDiagnostics().pendingTimers, 1);
    env.advanceBy(1);
    assert.equal(c.getVfxDiagnostics().counters.droppedLabels, droppedBefore + 12, "permanently impossible layout expires queued labels diagnostically");
    assertClean(env);
    env.resize(320, 480);
    for (let i = 0; i < 12; i++) {
        c.spawnVfxResult("HP", {
            text: `+${i}`, anchor: ["monster", "player", "log"][i % 3], x: 8, y: 8
        });
    }
    env.advanceBy(0);
    assert.equal(resultLabels(env).length, 12, "four lanes across three coincident near-top anchor groups remain readable");
    assert.deepEqual([...new Set(resultLabels(env).map((node) => Number(node.properties.get("--vfx-lane"))))].sort(), [0, 1, 2, 3]);
    assertLayout();
    env.advanceBy(5000);
    assertClean(env);
    for (const style of ["legacy", "enhanced"]) {
        c.setVfxSettings({ style }, { persist: false });
        for (const edge of [8, 92]) {
            for (let i = 0; i < 4; i++) {
                c.spawnVfxResult("HP", { text: `+${i} ${"9".repeat(120)}`, anchor: "player", x: edge, y: edge });
            }
            env.advanceBy(0);
            assert.equal(resultLabels(env).length, 4, `${style}: long edge-${edge} labels retain all four lanes`);
            assert.deepEqual(resultLabels(env).map((node) => Number(node.properties.get("--vfx-lane"))), [0, 1, 2, 3]);
            assertLayout();
            env.resize(280, 360);
            assertLayout();
            for (let resize = 0; resize < 3; resize++) {
                env.resize(375, 667);
                assertLayout();
                env.resize(280, 360);
                assertLayout();
            }
            env.resize(320, 480);
            assertLayout();
            env.advanceBy(5000);
            assertClean(env);
        }
    }
    env.resize(10, 10);
    c.spawnVfxResult("MP", { text: "+1 MP" });
    env.advanceBy(0);
    assert.equal(c.getVfxDiagnostics().pendingTimers, 1);
    assert.equal(c.getVfxDiagnostics().queuedLabels, 1);
    c.clearVfxLayer();
    assertClean(env);
    env.advanceBy(5000);
    assertClean(env);
}

function runProductionReducedMotionCssTests() {
    const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
    assert.ok(html.indexOf('href="css/04-components.css"') < html.indexOf('href="css/11-accessibility.css"'), "accessibility overrides retain their production load order");
    const rules = [];
    function readBlocks(source, systemMotionOnly = false) {
        const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
        let cursor = 0;
        while (cursor < css.length) {
            const open = css.indexOf("{", cursor);
            if (open < 0) break;
            const selector = css.slice(cursor, open).trim();
            let close = open + 1;
            let depth = 1;
            while (close < css.length && depth) {
                if (css[close] === "{") depth++;
                if (css[close] === "}") depth--;
                close++;
            }
            assert.equal(depth, 0, "production CSS blocks are balanced");
            const body = css.slice(open + 1, close - 1);
            if (selector.startsWith("@media") && selector.includes("prefers-reduced-motion: reduce")) {
                readBlocks(body, true);
            } else if (!selector.startsWith("@")) {
                for (const part of selector.split(",").map((value) => value.trim())) {
                    if (!["*", ".vfx-result", ".vfx-layer.vfx-reduced-motion .vfx-result"].includes(part)) continue;
                    for (const declaration of body.matchAll(/(?:^|;)\s*(animation-duration|animation)\s*:\s*([^;]+)/g)) {
                        rules.push({
                            selector: part, value: declaration[2].trim(),
                            important: /!important\s*$/.test(declaration[2]),
                            specificity: (part.match(/\.[a-z0-9_-]+/gi) || []).length,
                            systemMotionOnly, order: rules.length
                        });
                    }
                }
            }
            cursor = close;
        }
    }
    // Evaluate the actual competing declarations, not an isolated component snippet.
    for (const file of ["css/04-components.css", "css/11-accessibility.css"]) {
        readBlocks(fs.readFileSync(path.join(repoRoot, file), "utf8"));
    }
    const globalOverride = rules.find((rule) => rule.selector === "*" && rule.systemMotionOnly && rule.important);
    assert.ok(globalOverride && globalOverride.value.includes("0.01ms"), "exercise the actual later universal accessibility override");
    for (const style of ["legacy", "enhanced"]) {
        for (const [systemMotion, userMotion] of [[false, false], [true, false], [false, true], [true, true]]) {
            const env = createEnvironment({ reducedMotion: systemMotion });
            const c = env.context;
            c.setVfxSettings({ style, reduceMotion: userMotion }, { persist: false });
            c.spawnVfxResult("HP", { text: "+7 HP", duration: 900 });
            env.advanceBy(0);
            const node = resultLabels(env)[0];
            const layer = c.ensureVfxLayer();
            const applicable = rules.filter((rule) => {
                if (rule.systemMotionOnly && !systemMotion) return false;
                if (rule.selector.includes(".vfx-reduced-motion")) return layer.classList.contains("vfx-reduced-motion");
                return true;
            });
            applicable.sort((a, b) => Number(a.important) - Number(b.important) || a.specificity - b.specificity || a.order - b.order);
            const winner = applicable[applicable.length - 1];
            assert.ok(winner, "production result animation has a duration declaration");
            const variable = /var\(\s*--vfx-duration\s*,\s*([0-9.]+)ms\s*\)/.exec(winner.value);
            const computedDuration = variable
                ? Number.parseFloat(node.properties.get("--vfx-duration") || variable[1])
                : Number.parseFloat(winner.value);
            assert.equal(computedDuration, 900, `${style}, system=${systemMotion}, user=${userMotion}: full production CSS cascade retains requested readable result lifetime`);
            if (systemMotion || userMotion) {
                assert.equal(winner.important, true);
                assert.ok(winner.specificity > globalOverride.specificity, "result override wins over later universal !important by specificity");
            }
            env.advanceBy(computedDuration - 1);
            assert.equal(node.isConnected, true, "result remains present throughout its readable animation lifetime");
            env.advanceBy(91);
            assertClean(env);
        }
    }
}

function runDiagnosticBenchmark() {
    let historicalSource;
    try {
        historicalSource = execFileSync("git", ["show", "6bfef00:vfx.js"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
        throw new Error(`Historical renderer benchmark unavailable: ${error.message}`);
    }
    const runs = [
        { name: "round-one", source: historicalSource },
        { name: "round-two-legacy", settings: { style: "legacy", quality: "standard" } },
        { name: "round-two-enhanced", settings: { style: "enhanced", quality: "standard" } }
    ];
    const samples = [];
    for (const run of runs) {
        const env = createEnvironment({ source: run.source });
        if (run.settings) env.context.setVfxSettings(run.settings, { persist: false });
        let peakNodes = 0;
        let peakParticles = 0;
        let peakTimers = 0;
        const sample = () => {
            const nodes = env.document.getElementById("vfx-layer")?.children || [];
            peakNodes = Math.max(peakNodes, nodes.length);
            peakParticles = Math.max(peakParticles, nodes.reduce((sum, node) => sum + node.children.length, 0));
            peakTimers = Math.max(peakTimers, env.timers.size);
        };
        const start = process.hrtime.bigint();
        for (let i = 0; i < 400; i++) {
            env.context.spawnVfx(i % 20 === 0 ? "boss-defeat" : "hit", {
                count: 4, particleCount: 6, duration: 1400, text: `-${i}`,
                anchor: ["monster", "player", "log"][i % 3], resolvedCount: 6
            });
            sample();
        }
        for (let i = 0; i < 60; i++) { env.advanceBy(55); sample(); }
        env.advanceBy(20000);
        sample();
        const milliseconds = Number(process.hrtime.bigint() - start) / 1e6;
        if (run.settings) {
            assertBounded(env);
            const { caps } = env.context.getVfxDiagnostics();
            assert.ok(peakNodes <= caps.decorations + caps.activeLabels);
            assert.ok(peakParticles <= caps.particles);
            assert.ok(peakTimers <= caps.queuedDecorations + caps.externalSchedules + caps.decorations + caps.activeLabels + 2);
        }
        env.context.clearVfxLayer();
        assert.equal(env.timers.size, 0);
        if (run.settings) assertClean(env);
        samples.push(`${run.name}: ${milliseconds.toFixed(2)}ms, peak nodes=${peakNodes}, particles=${peakParticles}, timers=${peakTimers}, global RNG draws=${env.randomDraws()}`);
    }
    // CPU timings are diagnostic, not an FPS promise or a flaky relative-speed gate.
    const cpu = require("node:os").cpus()[0]?.model || "unknown CPU";
    console.log(`ℹ️ Diagnostic benchmark: Node ${process.version}, ${process.platform}/${process.arch}, ${cpu}; fake DOM + virtual timers; 400 synchronous events × 4 bursts, 6 particles, 1400ms, 3 anchors; monotonic process.hrtime.`);
    samples.forEach((sample) => console.log(`   ${sample}`));
}

function runGameplayTests() {
    const settingsMatrix = [
        { style: "legacy", quality: "standard", reduceMotion: false },
        ...["low", "high"].map((quality) => ({ style: "legacy", quality, reduceMotion: false })),
        ...["low", "standard", "high"].map((quality) => ({ style: "enhanced", quality, reduceMotion: false })),
        ...["legacy", "enhanced"].flatMap((style) => [
            { style, quality: "high", reduceMotion: true },
            { style, quality: "high", reduceMotion: false, systemMotion: true }
        ]),
        { style: "enhanced", quality: "high", reduceMotion: false, disabled: true }
    ];
    const scenarios = [
        "physical-hit", "physical-crit", "physical-miss", "full-shield", "magic-metadata-multi",
        "physical-multi", "skill-miss",
        "skill-heal", "skill-shield", "poison-explosion", "status-ticks",
        "monster-hit", "monster-miss", "monster-frozen", "monster-stunned",
        "ai-heal", "ai-food", "ai-offensive", "food", "small-heal", "large-heal",
        "mana", "food-full", "mana-full", "generic-food", "victory",
        "sanctum", "rest-choice", "rest-fallback", "unknown-zero", "unknown-clamped", "unknown-poison"
    ];
    function execute(settings, scenario, { gameSource, historical = false } = {}) {
        const env = createEnvironment({ reducedMotion: settings.systemMotion });
        const c = env.context;
        c.setVfxSettings(settings, { persist: false });
        c.setInterval = () => 1;
        c.clearInterval = () => {};
        for (const file of ["statengine.js", "game.js"]) {
            vm.runInContext(file === "game.js" && gameSource ? gameSource : fs.readFileSync(path.join(repoRoot, file), "utf8"), c, { filename: file });
        }
        const logs = [];
        const calls = [];
        const casts = [];
        const damageEvents = [];
        const applyDamage = c.applyDamageWithShield;
        c.applyDamageWithShield = (target, rawDamage) => {
            damageEvents.push({ target: target === c.currentRun ? "player" : "monster", rawDamage });
            return applyDamage(target, rawDamage);
        };
        const render = settings.disabled ? () => null : c.spawnVfx;
        const cast = c.triggerProjectileFX;
        c.triggerProjectileFX = (type, count) => {
            casts.push({ type, count });
            return settings.disabled ? null : cast(type, count);
        };
        if (settings.disabled) {
            c.spawnVfxResult = () => null;
        }
        c.spawnVfx = (type, options = {}) => { calls.push({ type, ...options }); return render(type, options); };
        c.addLog = (...args) => logs.push(args);
        c.updateUI = () => {};
        c.saveGameData = () => {};
        c.accountMeta = { name: "Tester", exp: 0, nextExp: 10000, warehouse: {} };
        c.currentRun = {
            job: "swordsman", hp: 93, maxHp: 100, mp: 97, maxMp: 100,
            atk: 90, matk: 90, def: 12, hit: 95, flee: 10, perfectDodge: 0,
            critChance: 0, shield: 17, skills: {}, inventory: [], gold: 0, exp: 0
        };
        c.activeMonster = {
            name: "Test monster", hp: 2000, maxHp: 2000, atk: 80, def: 10, mdef: 15,
            shield: 23, flee: 5, hit: 90, perfectDodge: 0,
            poisonStacks: 0, burnStacks: 0, freezeTurns: 0, stunTurns: 0
        };
        c.dungeonFloor = 2;
        c.gameState = "BATTLE";
        c.currentEnvironment = "NORMAL";
        c.SKILLS_DATABASE = { swordsman: [] };
        vm.runInContext('activeTactic = "MANUAL"', c);
        let draws = 0;
        c.Math.random = () => { draws++; return scenario === "skill-miss" && draws === 1 ? 0.25 : scenario.includes("miss") ? 0.99 : 0.25; };
        if (scenario === "physical-crit") c.currentRun.critChance = 100;
        if (scenario === "full-shield") c.activeMonster.shield = 500;
        if (["magic-metadata-multi", "physical-multi", "skill-miss", "skill-heal", "skill-shield", "poison-explosion", "ai-offensive"].includes(scenario)) {
            const eff = scenario === "skill-heal" ? { healAmount: 80 }
                : scenario === "skill-shield" ? { shieldGain: 35 }
                    : scenario === "poison-explosion" ? { dmg: 50, explodePoison: true }
                        : { dmg: 120, hitCount: 6, isMagic: !["physical-multi", "skill-miss"].includes(scenario), burnStacks: 2, freezeChance: 100 };
            c.SKILLS_DATABASE.swordsman = [{
                name: "Metadata attack", type: "active", mp: 10, vfx: { element: "ice" }, run: () => eff
            }];
            c.currentRun.skills["Metadata attack"] = 1;
            if (scenario === "poison-explosion") c.activeMonster.poisonStacks = 2;
        }
        if (scenario === "status-ticks") Object.assign(c.activeMonster, { poisonStacks: 2, burnStacks: 2 });
        if (scenario === "monster-frozen") c.activeMonster.freezeTurns = 2;
        if (scenario === "monster-stunned") c.activeMonster.stunTurns = 2;
        if (scenario === "sanctum" || scenario.startsWith("rest-")) {
            if (scenario === "sanctum") {
                assert.equal(c.applyRouteNodeSpecialEffects({ variant: "sanctum" }), true);
            } else {
                let choices;
                if (scenario === "rest-choice") {
                    choices = env.document.createElement("div");
                    choices.id = "reward-choices-container";
                    env.document.body.appendChild(choices);
                }
                c.executeRestShopNode();
                if (choices) {
                    assert.equal(choices.children.length, 2);
                    choices.firstElementChild.onclick();
                }
                assert.equal(c.gameState, "ENCOUNTER_RESOLVED", "actual rest flow resolves after recovery");
            }
            assert.equal(c.currentRun.hp, 100);
            assert.equal(c.currentRun.mp, 100);
            if (!historical) {
                assert.ok(calls.some((call) => call.type === "heal" && call.text === "+7 HP"));
                assert.ok(calls.some((call) => call.type === "heal" && call.text === "+3 MP"));
                assert.ok(logs.some(([text]) => /(?:\+7 HP|HP \+7)/.test(text) && /(?:\+3 MP|MP \+3)/.test(text)), "actual route/rest log reports capped deltas");
            }
        } else if (scenario.startsWith("unknown-")) {
            c.currentRun.hp = scenario === "unknown-zero" ? 1 : 5;
            if (scenario === "unknown-poison") c.currentEnvironment = "POISON";
            c.currentRun.inventory = ["未知物體"];
            c.executeUseDungeonItem("未知物體", 0);
            const lostHp = scenario === "unknown-zero" ? 0 : 4;
            assert.equal(c.currentRun.hp, 1, "unknown-item damage respects its historical floor");
            assert.equal(c.currentRun.inventory.length, 0);
            if (!historical) {
                assert.ok(calls.some((call) => call.type === "hit" && call.text === `-${lostHp}`), "unknown-item label reflects actual clamped loss");
                assert.ok(logs.some(([text]) => text.includes(`扣減 ${lostHp} HP`)), "unknown-item log reflects actual clamped loss");
            }
        } else if (scenario.startsWith("monster-")) {
            c.executeMonsterActionTick();
        } else if (scenario.startsWith("ai-")) {
            vm.runInContext(`activeTactic = "${scenario === "ai-offensive" ? "OFFENSIVE" : "BALANCED"}"`, c);
            if (scenario === "ai-heal") {
                c.currentRun.hp = 59;
                c.currentRun.skills["治癒術"] = 10;
            }
            if (scenario === "ai-food") {
                c.currentRun.hp = 20;
                c.currentRun.inventory = ["厚牛巨堡"];
            }
            assert.equal(c.executeAutoBattleAiTurn(), true);
        } else if (["food", "small-heal", "large-heal", "mana", "food-full", "mana-full", "generic-food"].includes(scenario)) {
            const item = { food: "料理", "small-heal": "初級治癒", "large-heal": "強效魔藥", mana: "回魔劑", "food-full": "料理", "mana-full": "回魔劑", "generic-food": "飯糰" }[scenario];
            if (scenario.endsWith("-full")) {
                c.currentRun.hp = c.currentRun.maxHp;
                c.currentRun.mp = c.currentRun.maxMp;
            }
            c.currentRun.inventory = [item];
            c.executeUseDungeonItem(item, 0);
            assert.equal(c.currentRun.inventory.length, 0, `${scenario}: actual inventory consumption`);
            const expected = scenario === "mana-full" ? "+0 MP" : scenario === "food-full" ? "+0 HP" : scenario === "mana" ? "+3 MP" : "+7 HP";
            if (!historical) {
                assert.ok(calls.some((call) => call.type === "heal" && call.text === expected), `${scenario}: actual capped recovery label`);
                assert.ok(logs.some(([text]) => text.includes(expected)), `${scenario}: actual capped recovery log`);
            }
        } else {
            if (scenario === "victory") {
                Object.assign(c.activeMonster, { hp: 1, shield: 0, fixedDrop: "Test loot" });
                const anchor = env.document.createElement("div");
                anchor.id = "monster-status-card";
                anchor.rect = { left: 100, top: 50, width: 200, height: 100 };
                env.document.body.appendChild(anchor);
            }
            c.executePlayerActionTick();
        }
        if (!historical && scenario === "skill-heal") assert.ok(calls.some((call) => call.text === "+7 HP"));
        if (!historical && scenario === "ai-heal") assert.ok(calls.some((call) => call.text === "+41 HP"));
        if (["magic-metadata-multi", "physical-multi"].includes(scenario)) {
            assert.equal(damageEvents.length, 6, "actual combat loop applies damage six times, independent of renderer burst count");
        }
        if (!historical && ["magic-metadata-multi", "physical-multi"].includes(scenario)) {
            const impact = calls.find((call) => call.type === "hit" && call.anchor === "monster");
            assert.equal(impact.resolvedCount, 6, "game passes actual resolved count to aggregate label");
            assert.equal(impact.variant, "ice", "game passes explicit metadata element to impact decoration");
            assert.ok(logs.some(([text]) => text.includes("skill-ice")), "game passes metadata to skill class detection");
            assert.ok(casts.some((call) => call.type === "ice" && call.count === 6), "actual game cast uses explicit skill metadata and logical hit count");
        }
        if (scenario.includes("miss")) {
            assert.ok(calls.some((call) => call.type === "miss" && call.text === "MISS"), "actual failed damage resolution emits MISS");
            assert.ok(!calls.some((call) => call.type === "hit" || call.type === "crit"), "miss cannot invent impact damage");
        }
        if (scenario === "full-shield") {
            assert.equal(c.activeMonster.hp, 2000);
            assert.equal(c.activeMonster.shield, 429, "real damage calculation and shield absorption");
            assert.ok(calls.some((call) => call.type === "shield"));
            assert.ok(calls.some((call) => call.type === "hit" && call.text === "-0"));
        }
        if (scenario === "physical-hit") {
            assert.equal(c.activeMonster.hp, 1952, "real physical damage after shield");
            assert.equal(c.activeMonster.shield, 0);
            assert.equal(draws, 4, "perfect dodge, accuracy, variance and critical draws");
        }
        if (scenario === "physical-crit") assert.equal(c.activeMonster.hp, 1917);
        if (scenario === "physical-miss") {
            assert.equal(c.activeMonster.hp, 2000);
            assert.equal(c.activeMonster.shield, 23);
            assert.equal(draws, 2, "miss exits before variance and critical RNG");
        }
        if (scenario === "monster-hit") {
            assert.equal(c.currentRun.hp, 49, "real monster damage after player shield");
            assert.equal(c.currentRun.shield, 0);
            assert.equal(draws, 3);
        }
        if (scenario === "victory") {
            assert.equal(c.gameState, "ENCOUNTER_RESOLVED");
            assert.ok(c.currentRun.inventory.includes("Test loot"));
            assert.ok(c.currentRun.gold > 0);
            assert.ok(c.accountMeta.exp > 0);
            const defeat = calls.find((call) => call.variant === "defeat");
            assertPosition(defeat, { x: 20, y: 19 });
            assert.equal(defeat.anchor, undefined, "actual victory effect captures coordinates before monster UI teardown");
            env.document.getElementById("monster-status-card").remove();
        }
        const gameplayDraws = draws;
        const before = JSON.stringify({ run: c.currentRun, monster: c.activeMonster, account: c.accountMeta, state: c.gameState, logs });
        env.advanceBy(5000);
        for (let i = 0; i < 4 && env.frames.size; i++) env.frame();
        assert.equal(draws, gameplayDraws, `${scenario}: VFX flush consumes no gameplay RNG`);
        assert.equal(JSON.stringify({ run: c.currentRun, monster: c.activeMonster, account: c.accountMeta, state: c.gameState, logs }), before, `${scenario}: VFX timers cannot mutate gameplay`);
        assertClean(env);
        c.clearVfxLayer();
        assert.equal(env.timers.size, 0);
        assert.equal(env.frames.size, 0);
        return { state: before, gameplayDraws, damageEvents: plain(damageEvents) };
    }
    for (const scenario of scenarios) {
        const baseline = execute(settingsMatrix[0], scenario);
        for (const settings of settingsMatrix.slice(1)) {
            assert.deepEqual(execute(settings, scenario), baseline, `${scenario}: rendering settings preserve gameplay and RNG draws`);
        }
    }
    // Historical visual jitter consumed Math.random; draw-count equivalence with the
    // historical renderer enabled is NOT asserted. This matrix compares current modes.
    console.log(`✅ Gameplay isolation: ${scenarios.length} actual-action scenarios × ${settingsMatrix.length} rendering configurations.`);
    const historicalSource = execFileSync("git", ["show", "6bfef005:game.js"], {
        cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    });
    const renderingDisabled = settingsMatrix[settingsMatrix.length - 1];
    for (const scenario of scenarios) {
        const old = execute(renderingDisabled, scenario, { gameSource: historicalSource, historical: true });
        const current = execute(renderingDisabled, scenario);
        function gameplayState(result) {
            const state = JSON.parse(result.state);
            // Corrected recovery/damage descriptions and metadata classes are intentional
            // presentation changes; compare durable gameplay, not historical log markup.
            delete state.logs;
            return { ...state, gameplayDraws: result.gameplayDraws, damageEvents: result.damageEvents };
        }
        assert.deepEqual(gameplayState(current), gameplayState(old), `${scenario}: original game.js and current game.js preserve gameplay math with rendering disabled`);
    }
    console.log(`✅ Historical gameplay guardrail: 6bfef005:game.js vs current game.js, ${scenarios.length} controlled real-action scenarios, rendering disabled in both; state and gameplay RNG draw counts identical.`);
}

require("node:child_process").execFileSync(process.execPath, [
    path.join(repoRoot, "scripts/check-refactor-baseline.js")
], { stdio: "inherit" });
runLegacyCharacterization();
runLifecycleTests();
runSceneTransitionTests();
runStaticIntegrationChecks();
runSettingsAndRegistryTests();
runSettingsUiTests();
runBoundedRendererTests();
runResultLabelTests();
runAnchorAndMotionTests();
runLabelLayoutTests();
runProductionReducedMotionCssTests();
runDiagnosticBenchmark();
runGameplayTests();
console.log("✅ ROUND TWO VFX characterization, lifecycle, scene-transition, settings/UI, bounded renderer, labels, anchors/motion, benchmark, and gameplay integration tests passed.");
