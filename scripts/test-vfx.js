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
        this.dataset = {};
        this.listeners = new Map();
        this.style = {
            pointerEvents: "",
            display: "",
            visibility: "",
            setProperty: (name, value) => this.properties.set(name, value)
        };
        this.id = "";
        this.className = "";
        this.textContent = "";
        this.hidden = false;
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

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }

    dispatchEvent(type) {
        for (const listener of this.listeners.get(type) || []) listener({ target: this });
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

function createEnvironment({ reducedMotion = false, storage = null, preview = false, settingsControls = false } = {}) {
    let systemReducedMotion = reducedMotion;
    let now = 0;
    let nextTimerId = 1;
    const timers = new Map();
    const listeners = new Map();
    const windowListeners = new Map();
    const body = new FakeElement("body");
    const document = {
        body,
        visibilityState: "visible",
        readyState: "complete",
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
            listeners.set(type, (listeners.get(type) || []).filter((item) => item !== listener));
        }
    };
    if (preview) body.setAttribute("data-vfx-preview", "true");
    const controls = {};
    if (settingsControls) {
        for (const [key, tagName, id, value] of [
            ["profile", "select", "vfx-profile-setting", "legacy"],
            ["quality", "select", "vfx-quality-setting", "standard"],
            ["reduceMotion", "input", "vfx-reduce-motion-setting", false]
        ]) {
            const control = new FakeElement(tagName);
            control.id = id;
            if (key === "reduceMotion") control.checked = value;
            else control.value = value;
            body.appendChild(control);
            controls[key] = control;
        }
    }
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
        console,
        localStorage: storage || undefined,
        addEventListener(type, listener) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(listener);
        },
        removeEventListener(type, listener) {
            windowListeners.set(type, (windowListeners.get(type) || []).filter((item) => item !== listener));
        }
    };
    context.window = context;
    context.innerWidth = 1000;
    context.innerHeight = 500;
    context.matchMedia = (query) => ({ matches: systemReducedMotion && query === "(prefers-reduced-motion: reduce)" });
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "vfx.js"), "utf8"), context, { filename: "vfx.js" });

    return {
        context,
        document,
        timers,
        listeners,
        windowListeners,
        controls,
        advanceBy,
        dispatchWindowEvent(type) {
            for (const listener of windowListeners.get(type) || []) listener();
        },
        setSystemReducedMotion(value) {
            systemReducedMotion = value;
        },
        setHidden(hidden) {
            document.visibilityState = hidden ? "hidden" : "visible";
            for (const listener of listeners.get("visibilitychange") || []) listener();
        }
    };
}

function effects(env) {
    return env.document.getElementById("vfx-layer")?.children || [];
}

function labels(env) {
    return env.document.getElementById("vfx-label-layer")?.children || [];
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
    assert.equal(node.properties.get("--vfx-x"), "53%");
    assert.equal(node.properties.get("--vfx-y"), "43%");
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
    assert.equal(effects(projectile)[0].className, "vfx-effect vfx-cast vfx-variant-projectile-fire");

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
    assert.equal(labels(newScene).length, 1, "result text remains independently visible after its decoration ends");
    newScene.advanceBy(50);
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

function runRoundTwoVfxTests() {
    const registry = createEnvironment();
    assert.equal(registry.context.getVfxSettings().profile, "legacy");
    assert.equal(registry.context.getVfxSettings().quality, "standard");
    assert.equal(registry.context.VFX_DEFINITIONS.hit.duration, 460);
    assert.equal(registry.context.VFX_DEFINITIONS.hit.priority, 60);
    assert.deepEqual(
        JSON.parse(JSON.stringify(registry.context.resolveSkillVfx({ name: "冰霜箭" }, "magician"))),
        { projectileType: "ice", shape: "ice-shards" }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(registry.context.resolveSkillVfx({
            name: "火箭術",
            vfxMetadata: { projectileType: "ice", shape: "slash" }
        }, "magician"))),
        { projectileType: "ice", shape: "slash" }
    );

    const rng = createEnvironment();
    let randomCalls = 0;
    rng.context.Math.random = () => { randomCalls++; return 0.25; };
    rng.context.spawnVfx("hit");
    rng.advanceBy(0);
    assert.equal(randomCalls, 0, "VFX placement must not consume gameplay Math.random state");
    rng.context.Math.random();
    assert.equal(randomCalls, 1, "the next gameplay roll remains available to gameplay");

    const outcomes = [];
    for (const profile of ["legacy", "enhanced", "disabled"]) {
        const env = createEnvironment();
        let randomDraws = 0;
        env.context.setInterval = () => 1;
        env.context.clearInterval = () => {};
        env.context.Math.random = () => { randomDraws++; return 0.25; };
        vm.runInContext(fs.readFileSync(path.join(repoRoot, "game.js"), "utf8"), env.context, { filename: "game.js" });
        env.context.currentRun = {
            hp: 100, maxHp: 100, mp: 100, maxMp: 100, job: "tester", atk: 20,
            skills: { "測試連擊": 1 }, shield: 0, inventory: []
        };
        env.context.activeMonster = { name: "Test", hp: 100, maxHp: 100, def: 0, mdef: 0, shield: 0 };
        env.context.gameState = "BATTLE";
        env.context.activeTactic = "MANUAL";
        env.context.SKILLS_DATABASE = {
            tester: [{ name: "測試連擊", type: "active", mp: 0, run: () => ({ dmg: 12, hitCount: 3 }) }]
        };
        env.context.calculateDamage = (damage) => ({ damage, isMiss: false, isCrit: false });
        env.context.addLog = () => {};
        env.context.SKILLS_DATABASE.tester[0].vfxMetadata = { projectileType: "fire", shape: "fire-burst" };
        if (profile === "disabled") env.document.visibilityState = "hidden";
        else env.context.setVfxSettings({ profile, quality: profile === "enhanced" ? "high" : "low" });
        env.context.executePlayerActionTick();
        outcomes.push({
            hp: env.context.currentRun.hp,
            mp: env.context.currentRun.mp,
            monsterHp: env.context.activeMonster.hp,
            randomDraws
        });
    }
    assert.deepEqual(outcomes, [
        { hp: 100, mp: 100, monsterHp: 88, randomDraws: 1 },
        { hp: 100, mp: 100, monsterHp: 88, randomDraws: 1 },
        { hp: 100, mp: 100, monsterHp: 88, randomDraws: 1 }
    ], "controlled game action outcomes remain the same across VFX profiles and hidden-renderer mode");

    const castImpact = createEnvironment();
    castImpact.context.triggerProjectileFX("fire", 6);
    castImpact.advanceBy(55 * 3);
    assert.equal(effects(castImpact).length, 4);
    assert.match(effects(castImpact)[0].className, /vfx-cast/);
    assert.doesNotMatch(effects(castImpact)[0].className, /vfx-hit/);
    castImpact.context.spawnVfx("miss", { anchor: "monster", text: "MISS" });
    castImpact.advanceBy(0);
    assert.ok(labels(castImpact).some((label) => label.textContent === "MISS"));
    assert.equal(castImpact.context.getVfxDiagnostics().active, 5, "MISS feedback is separate from cast decoration");

    const resultText = createEnvironment();
    resultText.context.spawnVfx("hit", { text: "-120 ×6 HP", count: 99 });
    resultText.advanceBy(0);
    assert.equal(labels(resultText).length, 1);
    assert.equal(labels(resultText)[0].textContent, "-120 ×6 HP");
    assert.equal(labels(resultText)[0].getAttribute("data-label-kind"), "damage");
    assert.equal(effects(resultText)[0].getAttribute("data-vfx-text"), "-120 ×6 HP");

    const cappedHeal = createEnvironment();
    cappedHeal.context.setInterval = () => 1;
    cappedHeal.context.clearInterval = () => {};
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "game.js"), "utf8"), cappedHeal.context, { filename: "game.js" });
    cappedHeal.context.currentRun = {
        hp: 95, maxHp: 100, mp: 80, maxMp: 100, job: "tester", atk: 20,
        skills: { "測試治癒": 1 }, inventory: []
    };
    cappedHeal.context.activeMonster = { name: "Test", hp: 100, maxHp: 100, def: 0, mdef: 0, shield: 0 };
    cappedHeal.context.gameState = "BATTLE";
    cappedHeal.context.SKILLS_DATABASE = {
        tester: [{ name: "測試治癒", type: "active", mp: 0, run: () => ({ healAmount: 20 }) }]
    };
    cappedHeal.context.Math.random = () => 0.25;
    cappedHeal.context.addLog = () => {};
    cappedHeal.context.executePlayerActionTick();
    assert.equal(cappedHeal.context.currentRun.hp, 100, "the original capped HP calculation is unchanged");
    cappedHeal.advanceBy(0);
    assert.ok(labels(cappedHeal).some((label) => label.textContent === "+5 HP"), "the result reports actual capped healing");

    const cappedMp = createEnvironment();
    cappedMp.context.setInterval = () => 1;
    cappedMp.context.clearInterval = () => {};
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "game.js"), "utf8"), cappedMp.context, { filename: "game.js" });
    cappedMp.context.currentRun = {
        hp: 100, maxHp: 100, mp: 95, maxMp: 100, job: "tester", inventory: ["回魔劑"]
    };
    cappedMp.context.activeMonster = { name: "Test", hp: 100 };
    cappedMp.context.gameState = "BATTLE";
    cappedMp.context.addLog = () => {};
    cappedMp.context.executeUseDungeonItem("回魔劑", 0);
    cappedMp.advanceBy(0);
    assert.equal(cappedMp.context.currentRun.mp, 100);
    assert.ok(labels(cappedMp).some((label) => label.textContent === "+5 MP"));

    const bounded = createEnvironment();
    bounded.context.spawnVfx("hit", { count: Infinity, duration: Infinity, particleCount: Infinity, maxActive: Infinity });
    bounded.advanceBy(0);
    assert.equal(effects(bounded).length, 1, "Infinity burst count falls back to one");
    assert.equal(effects(bounded)[0].properties.get("--vfx-duration"), "460ms");
    assert.equal(effects(bounded)[0].children.length, 3);
    bounded.context.clearVfxLayer();
    bounded.context.spawnVfx("hit", { count: -100, duration: -100, particleCount: -100, maxActive: -100 });
    bounded.advanceBy(0);
    assert.equal(effects(bounded).length, 1);
    assert.equal(effects(bounded)[0].properties.get("--vfx-duration"), "120ms");
    assert.equal(effects(bounded)[0].children.length, 0);

    const low = createEnvironment();
    low.context.setVfxSettings({ quality: "low" });
    low.context.spawnVfx("hit", { count: 99, particleCount: 99 });
    low.advanceBy(55);
    assert.equal(low.context.getVfxDiagnostics().active, 2);
    assert.equal(low.context.getVfxDiagnostics().particles, 0);
    const high = createEnvironment();
    high.context.setVfxSettings({ quality: "high" });
    high.context.spawnVfx("hit", { count: 99, particleCount: 99 });
    high.advanceBy(55 * 3);
    assert.equal(high.context.getVfxDiagnostics().active, 4);
    assert.ok(high.context.getVfxDiagnostics().particles <= 96);

    const systemMotion = createEnvironment();
    systemMotion.context.setVfxSettings({ profile: "enhanced", quality: "high" });
    systemMotion.setSystemReducedMotion(true);
    systemMotion.context.spawnVfx("heal", { count: 99, particleCount: 99 });
    systemMotion.advanceBy(55);
    assert.equal(systemMotion.context.getVfxSettings().effectiveReducedMotion, true);
    assert.equal(systemMotion.context.getVfxDiagnostics().active, 2);
    assert.equal(systemMotion.context.getVfxDiagnostics().particles, 0);
    assert.equal(systemMotion.context.setVfxSettings({ quality: "invalid", profile: "invalid", reduceMotion: "yes" }).quality, "high");
    systemMotion.context.setVfxSettings({ reduceMotion: true });
    systemMotion.setSystemReducedMotion(false);
    assert.equal(systemMotion.context.getVfxSettings().effectiveReducedMotion, true);

    const storageValues = new Map([["abyss-test:vfx-preferences", JSON.stringify({ profile: "enhanced", quality: "low", reduceMotion: true })]]);
    const persistentStorage = {
        getItem: (key) => storageValues.get(key) || null,
        setItem: (key, value) => storageValues.set(key, value)
    };
    const persisted = createEnvironment({ storage: persistentStorage });
    assert.equal(persisted.context.getVfxSettings().profile, "enhanced");
    persisted.context.setVfxSettings({ quality: "high" });
    assert.equal(JSON.parse(storageValues.get("abyss-test:vfx-preferences")).quality, "high");
    const blockedStorage = createEnvironment({
        storage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }
    });
    assert.equal(blockedStorage.context.getVfxSettings().profile, "legacy");
    assert.doesNotThrow(() => blockedStorage.context.setVfxSettings({ profile: "enhanced" }));
    let previewWrites = 0;
    const previewStorage = createEnvironment({
        preview: true,
        storage: { getItem: () => null, setItem() { previewWrites++; } }
    });
    previewStorage.context.setVfxSettings({ profile: "enhanced" });
    assert.equal(previewWrites, 0, "the isolated preview keeps preferences in memory");
    const accessibleControls = createEnvironment({ settingsControls: true });
    assert.equal(accessibleControls.controls.profile.value, "legacy");
    accessibleControls.controls.profile.value = "enhanced";
    accessibleControls.controls.profile.dispatchEvent("change");
    accessibleControls.controls.quality.value = "low";
    accessibleControls.controls.quality.dispatchEvent("change");
    accessibleControls.controls.reduceMotion.checked = true;
    accessibleControls.controls.reduceMotion.dispatchEvent("change");
    assert.deepEqual(
        JSON.parse(JSON.stringify(accessibleControls.context.getVfxSettings())),
        {
            profile: "enhanced", quality: "low", reduceMotion: true,
            systemReducedMotion: false, effectiveReducedMotion: true
        }
    );

    const lanes = createEnvironment();
    for (let i = 0; i < 50; i++) {
        lanes.context.spawnVfx(i % 8 === 0 ? "crit" : "hit", {
            text: `-${i} HP`,
            priority: i % 8 === 0 ? 100 : 40,
            count: 2
        });
    }
    assert.ok(lanes.context.getVfxDiagnostics().queued <= 32);
    assert.ok(lanes.context.getVfxDiagnostics().labels <= 8);
    assert.ok(lanes.context.getVfxDiagnostics().queuedLabels <= 24);
    assert.ok(lanes.context.getVfxDiagnostics().timers <= 160);
    assert.ok(lanes.context.getVfxDiagnostics().dropped > 0);
    assert.equal(new Set(labels(lanes).map((label) => label.properties.get("--vfx-label-lane"))).size, 8);
    lanes.advanceBy(0);
    assert.ok(lanes.context.getVfxDiagnostics().active <= 24);
    assert.ok(lanes.context.getVfxDiagnostics().particles <= 96);
    const stressMetrics = lanes.context.getVfxDiagnostics();
    console.log(`VFX stress (50 spawns × up to 2 decorations): active=${stressMetrics.active}, particles=${stressMetrics.particles}, queued=${stressMetrics.queued}, labels=${stressMetrics.labels}+${stressMetrics.queuedLabels}, dropped=${stressMetrics.dropped}, timers=${stressMetrics.timers}`);
    lanes.context.clearVfxLayer();
    assert.deepEqual(
        JSON.parse(JSON.stringify(lanes.context.getVfxDiagnostics())),
        { active: 0, particles: 0, queued: 0, labels: 0, queuedLabels: 0, dropped: lanes.context.getVfxDiagnostics().dropped, timers: 0, followListeners: 0 }
    );

    const priority = createEnvironment();
    priority.context.spawnVfx("cast", { maxActive: 1, priority: 10 });
    priority.advanceBy(0);
    priority.context.spawnVfx("crit", { maxActive: 1, text: "-4" });
    priority.advanceBy(0);
    assert.equal(effects(priority).length, 1);
    assert.match(effects(priority)[0].className, /vfx-crit/);
    assert.equal(priority.context.getVfxDiagnostics().timers, 2, "evicted effects cancel their own expiration timer");

    const essentialLabels = createEnvironment();
    for (const [type, text] of [["hit", "-1 HP"], ["crit", "-2 HP"], ["miss", "MISS"]]) {
        essentialLabels.context.spawnVfx(type, { maxActive: 1, text });
    }
    essentialLabels.advanceBy(0);
    assert.equal(essentialLabels.context.getVfxDiagnostics().active, 1);
    assert.deepEqual(labels(essentialLabels).map((label) => label.textContent), ["-1 HP", "-2 HP", "MISS"]);
    essentialLabels.context.clearVfxLayer();
    assert.equal(essentialLabels.timers.size, 0);

    const variedLanes = createEnvironment();
    variedLanes.context.spawnVfx("hit", { text: "long", labelDuration: 1800 });
    for (let i = 0; i < 8; i++) variedLanes.context.spawnVfx("hit", { text: `short ${i}`, labelDuration: 400 });
    variedLanes.advanceBy(0);
    assert.equal(new Set(labels(variedLanes).map((label) => label.properties.get("--vfx-label-lane"))).size, 8);
    variedLanes.advanceBy(400);
    assert.equal(labels(variedLanes).length, 2);
    assert.equal(new Set(labels(variedLanes).map((label) => label.properties.get("--vfx-label-lane"))).size, 2);
    variedLanes.context.clearVfxLayer();
    assert.equal(variedLanes.timers.size, 0);

    const positions = createEnvironment();
    const target = positions.document.createElement("div");
    target.id = "moving-target";
    target.rect = { left: 100, top: 50, width: 200, height: 100 };
    positions.document.body.appendChild(target);
    positions.context.spawnVfx("hit", { anchorId: "moving-target", positionMode: "follow-anchor" });
    positions.advanceBy(0);
    const followed = effects(positions)[0];
    assert.equal(followed.properties.get("--vfx-x"), "23%");
    assert.equal(positions.context.getVfxDiagnostics().followListeners, 3);
    target.rect = { left: 300, top: 100, width: 200, height: 100 };
    positions.dispatchWindowEvent("scroll");
    assert.equal(followed.properties.get("--vfx-x"), "40%");
    const capturedY = followed.properties.get("--vfx-y");
    target.style.display = "none";
    target.rect = { left: 600, top: 300, width: 100, height: 60 };
    positions.dispatchWindowEvent("resize");
    assert.equal(followed.properties.get("--vfx-y"), capturedY, "hidden targets preserve the last captured position");
    target.remove();
    positions.dispatchWindowEvent("orientationchange");
    assert.equal(followed.properties.get("--vfx-x"), "40%", "a disconnected target keeps its last captured position");
    assert.equal(positions.context.getVfxDiagnostics().followListeners, 0);
    positions.context.clearVfxLayer();
    assert.equal(positions.timers.size, 0);
    assert.equal(positions.windowListeners.get("scroll").length, 0);
    assert.equal(positions.windowListeners.get("resize").length, 0);
    assert.equal(positions.windowListeners.get("orientationchange").length, 0);

    const snapshot = createEnvironment();
    const snapshotTarget = snapshot.document.createElement("div");
    snapshotTarget.id = "moving-target";
    snapshotTarget.rect = { left: 100, top: 50, width: 200, height: 100 };
    snapshot.document.body.appendChild(snapshotTarget);
    snapshot.context.spawnVfx("hit", { anchorId: "moving-target", positionMode: "snapshot-impact" });
    snapshot.advanceBy(0);
    const snapshotNode = effects(snapshot)[0];
    snapshotTarget.rect = { left: 500, top: 200, width: 100, height: 100 };
    snapshot.dispatchWindowEvent("scroll");
    assert.equal(snapshotNode.properties.get("--vfx-x"), "23%");
    assert.equal(snapshot.context.getVfxDiagnostics().followListeners, 0);
    snapshotTarget.hidden = true;
    assertPosition(snapshot.context.resolveVfxPosition({ anchorId: "moving-target", anchor: "player" }), { x: 50, y: 38 });

    const settingsCss = fs.readFileSync(path.join(repoRoot, "css/04-components.css"), "utf8");
    const game = fs.readFileSync(path.join(repoRoot, "game.js"), "utf8");
    const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
    assert.match(settingsCss, /\.vfx-shape-ice-shards/);
    assert.match(settingsCss, /data-vfx-reduced-motion/);
    assert.match(html, /vfx-profile-setting/);
    assert.match(game, /const hitLabel = `-\$\{totalActualDmg\}\$\{hitCount > 1 \? ` ×\$\{hitCount\}` : ""\} HP`/);
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, "vfx.js"), "utf8"), /Math\.random\s*\(/);
}

require("node:child_process").execFileSync(process.execPath, [
    path.join(repoRoot, "scripts/check-refactor-baseline.js")
], { stdio: "inherit" });
runLegacyCharacterization();
runLifecycleTests();
runSceneTransitionTests();
runStaticIntegrationChecks();
runRoundTwoVfxTests();
console.log("✅ VFX characterization, lifecycle, scene-transition, round-two settings/budget/position, and integration tests passed.");
