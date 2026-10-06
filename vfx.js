// Presentation-only state: combat never depends on the renderer or its random stream.
const VFX_LAYER_ID = "vfx-layer";
const VFX_LIMIT_DEFAULT = 24;
let projectileBurstGuardUntil = 0;

(function (global) {
    "use strict";
    const STORAGE_KEY = "abyss.vfx.preferences.v1";
    const defaults = Object.freeze({ style: "legacy", quality: "standard", reduceMotion: false });
    const qualityLimits = Object.freeze({
        low: Object.freeze({ decorations: 12, particles: 24, bursts: 2, perNode: 3 }),
        standard: Object.freeze({ decorations: 24, particles: 96, bursts: 4, perNode: 6 }),
        high: Object.freeze({ decorations: 32, particles: 128, bursts: 4, perNode: 6 })
    });
    const CAPS = Object.freeze({ queuedDecorations: 48, externalSchedules: 32, activeLabels: 12, queuedLabels: 36, lanesPerAnchor: 4 });
    const LABEL_LANE_SPACING = 44;
    const LABEL_RETRY_DELAY = 500;
    const LABEL_RETRY_LIMIT = 4;
    const effectData = {
        hit: ["#ffb347", "slash", 460, 3, 1],
        crit: ["#ffd700", "slash", 460, 3, 3],
        cast: ["#b5a0ff", "projectile", 320, 1, 0],
        heal: ["#57f287", "rise", 460, 3, 2],
        shield: ["#70f0ff", "ring", 460, 3, 2],
        miss: ["#94a3b8", "hollow", 460, 3, 1],
        "boss-entry": ["#c084fc", "ring", 460, 3, 4],
        "boss-defeat": ["#c084fc", "burst", 460, 3, 5]
    };
    const elements = Object.freeze({
        fire: Object.freeze({ color: "#ff7b7b", shape: "fire" }),
        ice: Object.freeze({ color: "#7dd3fc", shape: "ice" }),
        lightning: Object.freeze({ color: "#fde047", shape: "lightning" }),
        holy: Object.freeze({ color: "#fef08a", shape: "rise" }),
        arrow: Object.freeze({ color: "#86efac", shape: "arrow" }),
        arcane: Object.freeze({ color: "#b5a0ff", shape: "ring" }),
        poison: Object.freeze({ color: "#a3e635", shape: "hollow" }),
        slash: Object.freeze({ color: "#ffb347", shape: "slash" })
    });
    const VFX_EFFECTS = Object.freeze(Object.fromEntries(Object.entries(effectData).map(([name, values]) => [
        name, Object.freeze({ color: values[0], shape: values[1], duration: values[2], particles: values[3], priority: values[4] })
    ])));
    const resultKinds = Object.freeze(["HP", "MP", "SHIELD", "HIT", "CRIT", "MISS"]);
    const anchors = Object.freeze({ monster: "monster-status-card", player: "status-panel-box", log: "log-wrapper-box" });
    const timers = new Set();
    const decorationQueue = new Set();
    const queuedDecorationPriorities = new Map();
    const externalSchedules = new Set();
    const decorations = new Set();
    const labels = new Set();
    const labelQueue = [];
    const followers = new Set();
    const counters = {
        spawnedDecorations: 0, spawnedLabels: 0, droppedDecorations: 0,
        droppedLabels: 0, droppedSchedules: 0, evictedDecorations: 0, evictedQueuedDecorations: 0
    };
    let generation = 0;
    let particles = 0;
    let followTimer = null;
    let labelPumpTimer = null;
    let labelRetryTimer = null;
    let labelRetryAttempts = 0;
    let settings = { ...defaults };
    let motionQuery = null;
    let randomState = (Date.now() >>> 0) || 1;
    try {
        if (global.crypto && typeof global.crypto.getRandomValues === "function") {
            randomState = global.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
        }
    } catch (_) { /* Date seed remains usable when crypto is unavailable. */ }
    function random() {
        randomState ^= randomState << 13;
        randomState ^= randomState >>> 17;
        randomState ^= randomState << 5;
        return (randomState >>> 0) / 4294967296;
    }
    function finite(value, fallback, min, max) {
        const number = typeof value === "number" ? value : NaN;
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }
    function ownsString(object, key) {
        return typeof key === "string" && Object.hasOwn(object, key);
    }
    function countEvent(key) {
        counters[key] = Math.min(Number.MAX_SAFE_INTEGER, counters[key] + 1);
    }
    function normalizeSettings(patch, base = settings) {
        patch = patch && typeof patch === "object" ? patch : {};
        return {
            style: ["legacy", "enhanced"].includes(patch.style) ? patch.style : base.style,
            quality: ownsString(qualityLimits, patch.quality) ? patch.quality : base.quality,
            reduceMotion: typeof patch.reduceMotion === "boolean" ? patch.reduceMotion : base.reduceMotion
        };
    }
    if (!global.VFX_PREVIEW) {
        try { settings = normalizeSettings(JSON.parse(global.localStorage.getItem(STORAGE_KEY)), defaults); } catch (_) {}
    }
    try {
        if (typeof global.matchMedia === "function") motionQuery = global.matchMedia("(prefers-reduced-motion: reduce)");
    } catch (_) {}
    function prefersReducedMotion() {
        return settings.reduceMotion || !!(motionQuery && motionQuery.matches);
    }
    function limits() {
        const quality = qualityLimits[settings.quality];
        return prefersReducedMotion()
            ? { decorations: Math.min(12, quality.decorations), particles: 0, bursts: 2, perNode: 0 }
            : quality;
    }
    function isDocumentHidden() {
        return typeof document !== "undefined" && document.visibilityState === "hidden";
    }
    function cancelTimer(id) {
        if (id === null || id === undefined) return;
        clearTimeout(id);
        timers.delete(id);
        decorationQueue.delete(id);
        queuedDecorationPriorities.delete(id);
        externalSchedules.delete(id);
    }
    function schedule(callback, delay, group) {
        if (isDocumentHidden() || typeof setTimeout !== "function") return null;
        const currentGeneration = generation;
        let id = setTimeout(() => {
            timers.delete(id);
            if (group) group.delete(id);
            if (group === decorationQueue) queuedDecorationPriorities.delete(id);
            if (currentGeneration !== generation || isDocumentHidden()) return;
            callback();
        }, delay);
        timers.add(id);
        if (group) group.add(id);
        return id;
    }
    function applyLayerSettings(layer) {
        layer.className = `vfx-layer vfx-style-${settings.style}${prefersReducedMotion() ? " vfx-reduced-motion" : ""}`;
    }
    function ensureVfxLayer() {
        if (typeof document === "undefined" || !document.body) return null;
        let layer = document.getElementById(VFX_LAYER_ID);
        if (!layer) {
            layer = document.createElement("div");
            layer.id = VFX_LAYER_ID;
            layer.setAttribute("aria-hidden", "true");
            layer.style.pointerEvents = "none";
            document.body.appendChild(layer);
        }
        applyLayerSettings(layer);
        return layer;
    }
    function clampVfxPercent(value, fallback) {
        const number = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
        return Number.isFinite(number) ? Math.min(92, Math.max(8, number)) : fallback;
    }
    function anchorPosition(anchor) {
        if (typeof document === "undefined") return null;
        const element = document.getElementById(ownsString(anchors, anchor) ? anchors[anchor] : anchors.monster);
        if (!element || element.isConnected === false || typeof element.getBoundingClientRect !== "function") return null;
        if (element.hidden || (typeof element.getAttribute === "function" && element.getAttribute("aria-hidden") === "true")) return null;
        if (typeof global.getComputedStyle === "function") {
            const style = global.getComputedStyle(element);
            if (style.display === "none" || style.visibility === "hidden") return null;
        }
        const rect = element.getBoundingClientRect();
        if (!rect || ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
        return {
            x: clampVfxPercent((rect.left + rect.width * 0.5) / Math.max(1, global.innerWidth || 1) * 100, 50),
            y: clampVfxPercent((rect.top + rect.height * 0.45) / Math.max(1, global.innerHeight || 1) * 100, 45)
        };
    }
    function resolveVfxPosition(options = {}) {
        options = options && typeof options === "object" ? options : {};
        if (typeof document === "undefined") return { x: 50, y: 45 };
        if (Number.isFinite(options.x) || Number.isFinite(options.y)) {
            return { x: clampVfxPercent(options.x, 50), y: clampVfxPercent(options.y, 45) };
        }
        return anchorPosition(options.anchor) || { x: 50, y: options.anchor === "player" ? 38 : 46 };
    }
    function setPosition(record, position) {
        record.position = position;
        if (record.label) return placeResult(record, position);
        record.node.style.setProperty("--vfx-x", `${clampVfxPercent(position.x + record.dx, position.x)}%`);
        record.node.style.setProperty("--vfx-y", `${clampVfxPercent(position.y + record.dy, position.y)}%`);
        return true;
    }
    function placeResult(record, position) {
        const viewportWidth = Math.max(1, global.innerWidth || 1);
        const viewportHeight = Math.max(1, global.innerHeight || 1);
        if (!record.size) {
            const rect = record.node.getBoundingClientRect();
            const textWidth = record.node.textContent.length * 9 + 20;
            record.size = {
                width: Math.min(viewportWidth * 0.85, 320, (rect && rect.width > 0) ? rect.width : textWidth),
                height: (rect && rect.height > 0) ? rect.height : 32
            };
        }
        const width = Math.min(record.size.width, viewportWidth * 0.85);
        const height = record.size.height;
        const minX = width / 2 + 8;
        const maxX = viewportWidth - width / 2 - 8;
        const minY = height / 2 + 16;
        const maxY = viewportHeight - height / 2 - 8;
        if (minX > maxX || minY > maxY) return false;
        const bound = (value, min, max) => Math.min(max, Math.max(min, value));
        const preferredX = bound(position.x / 100 * viewportWidth, minX, maxX);
        const clusterMinY = Math.min(maxY, minY + (CAPS.lanesPerAnchor - 1) * LABEL_LANE_SPACING);
        const clusterY = bound(position.y / 100 * viewportHeight, clusterMinY, maxY);
        const preferredY = bound(clusterY - record.lane * LABEL_LANE_SPACING, minY, maxY);
        const xCandidates = [preferredX, minX, maxX, viewportWidth / 2];
        const yCandidates = [preferredY];
        for (let offset = 1; offset <= CAPS.activeLabels; offset++) {
            yCandidates.push(
                bound(preferredY + offset * LABEL_LANE_SPACING, minY, maxY),
                bound(preferredY - offset * LABEL_LANE_SPACING, minY, maxY)
            );
        }
        for (const x of xCandidates) {
            for (const y of yCandidates) {
                // Reserve the full upward animation path, not just the resting box.
                const box = { left: x - width / 2 - 2, right: x + width / 2 + 2, top: y - height / 2 - 10, bottom: y + height / 2 + 2 };
                const overlaps = [...labels].some(other => other !== record && other.layout &&
                    box.left < other.layout.right && box.right > other.layout.left &&
                    box.top < other.layout.bottom && box.bottom > other.layout.top);
                if (overlaps) continue;
                record.layout = box;
                record.node.style.setProperty("--vfx-x", `${x / viewportWidth * 100}%`);
                record.node.style.setProperty("--vfx-y", `${(y + record.lane * LABEL_LANE_SPACING) / viewportHeight * 100}%`);
                return true;
            }
        }
        return false;
    }
    function startFollowing() {
        if (followTimer !== null || !followers.size) return;
        followTimer = schedule(() => {
            followTimer = null;
            const cache = new Map();
            for (const record of followers) {
                if (!record.node.isConnected) {
                    removeRecord(record);
                    continue;
                }
                if (!cache.has(record.anchor)) cache.set(record.anchor, anchorPosition(record.anchor));
                const position = cache.get(record.anchor);
                if (position) setPosition(record, position);
            }
            startFollowing();
        }, 50);
    }
    function makeRecord(node, options, position, label = false, lane = 0) {
        const record = {
            node, position, anchor: ownsString(anchors, options.anchor) ? options.anchor : "monster",
            dx: label ? 0 : (random() - 0.5) * 6,
            dy: label ? 0 : (random() - 0.5) * 6,
            timer: null, particles: 0, label, lane, layout: null, size: null
        };
        setPosition(record, position);
        if (options.positionMode === "follow" && !Number.isFinite(options.x) && !Number.isFinite(options.y)) {
            followers.add(record);
            startFollowing();
        }
        return record;
    }
    function removeRecord(record) {
        cancelTimer(record.timer);
        record.timer = null;
        record.node.remove();
        followers.delete(record);
        if (record.label) labels.delete(record);
        else if (decorations.delete(record)) particles -= record.particles;
        if (!followers.size) {
            cancelTimer(followTimer);
            followTimer = null;
        }
    }
    function labelKind(type, options) {
        const explicit = typeof options.kind === "string" ? options.kind.toUpperCase() : "";
        if (resultKinds.includes(explicit)) return explicit;
        if (type === "heal") return options.variant === "mana" ? "MP" : "HP";
        if (type === "shield") return "SHIELD";
        if (type === "crit") return "CRIT";
        if (type === "miss") return "MISS";
        return "HIT";
    }
    function pumpLabels() {
        cancelTimer(labelPumpTimer);
        labelPumpTimer = null;
        const layer = ensureVfxLayer();
        if (!layer || !layer.isConnected || isDocumentHidden()) return;
        for (let index = 0; index < labelQueue.length && labels.size < CAPS.activeLabels;) {
            const item = labelQueue[index];
            const occupied = new Set([...labels].filter(record => record.anchor === item.anchor).map(record => record.lane));
            let lane = 0;
            while (occupied.has(lane)) lane++;
            if (lane >= CAPS.lanesPerAnchor) { index++; continue; }
            const node = document.createElement("div");
            node.className = `vfx-result vfx-result-${item.kind.toLowerCase()}`;
            node.setAttribute("aria-hidden", "true");
            node.setAttribute("data-vfx-kind", item.kind);
            node.setAttribute("data-vfx-text", item.text);
            node.textContent = item.text;
            node.style.setProperty("--vfx-lane", String(lane));
            node.style.setProperty("--vfx-duration", `${item.duration}ms`);
            layer.appendChild(node);
            const record = makeRecord(node, item.options, item.position, true, lane);
            record.anchor = item.anchor;
            if (!record.layout) {
                removeRecord(record);
                index++;
                continue;
            }
            labelQueue.splice(index, 1);
            record.item = item;
            labels.add(record);
            countEvent("spawnedLabels");
            record.timer = schedule(() => { removeRecord(record); pumpLabels(); }, item.duration + 90);
        }
        if (!labels.size && labelQueue.length) {
            if (labelRetryTimer !== null) return;
            if (labelRetryAttempts >= LABEL_RETRY_LIMIT) {
                while (labelQueue.length) {
                    labelQueue.pop();
                    countEvent("droppedLabels");
                }
                labelRetryAttempts = 0;
                return;
            }
            labelRetryAttempts++;
            labelRetryTimer = schedule(() => {
                labelRetryTimer = null;
                pumpLabels();
            }, LABEL_RETRY_DELAY);
        } else {
            cancelTimer(labelRetryTimer);
            labelRetryTimer = null;
            labelRetryAttempts = 0;
        }
    }
    function spawnVfxResult(kind, options = {}) {
        options = options && typeof options === "object" ? options : {};
        if (isDocumentHidden() || !ensureVfxLayer() || labelQueue.length >= CAPS.queuedLabels) {
            countEvent("droppedLabels");
            return null;
        }
        kind = typeof kind === "string" && resultKinds.includes(kind.toUpperCase()) ? kind.toUpperCase() : "HIT";
        const rawText = typeof options.text === "string" || typeof options.text === "number" ? String(options.text).slice(0, 96) : "";
        const count = Math.floor(finite(options.resolvedCount, 1, 1, 999999));
        const hasKind = rawText.toUpperCase().split(/\s+/).includes(kind);
        const text = `${hasKind ? rawText : `${kind}${rawText ? ` ${rawText}` : ""}`}${count > 1 ? ` ×${count}` : ""}`;
        const anchor = ownsString(anchors, options.anchor) ? options.anchor : "monster";
        labelQueue.push({
            kind, text, anchor, options: { ...options, anchor }, position: resolveVfxPosition(options),
            duration: finite(options.labelDuration ?? options.duration, prefersReducedMotion() ? 500 : 700, 500, 1400)
        });
        if (labelPumpTimer === null) labelPumpTimer = schedule(pumpLabels, 0);
        return true;
    }
    function spawnVfx(type, options = {}) {
        options = options && typeof options === "object" ? options : {};
        // Unknown effects are rejected: the immutable registry is the supported type list.
        if (!ownsString(VFX_EFFECTS, type) || isDocumentHidden()) {
            countEvent("droppedDecorations");
            return null;
        }
        const layer = ensureVfxLayer();
        if (!layer) return null;
        const spec = VFX_EFFECTS[type];
        const budget = limits();
        const count = Math.floor(finite(options.count, 1, 1, budget.bursts));
        const duration = finite(options.duration, prefersReducedMotion() ? 180 : spec.duration, 120, 1400);
        const particleCount = Math.floor(finite(options.particleCount, prefersReducedMotion() ? 0 : spec.particles, 0, budget.perNode));
        const maxActive = Math.floor(finite(options.maxActive, budget.decorations, 1, budget.decorations));
        const priority = Math.floor(finite(options.priority, spec.priority, 0, 5));
        const position = resolveVfxPosition(options);
        const variant = typeof options.variant === "string" ? options.variant.slice(0, 64).replace(/[^a-z0-9_-]/gi, "-") : "";
        const elementName = typeof options.element === "string" ? options.element : variant.replace(/^projectile-/, "");
        let accepted = false;
        for (let i = 0; i < count; i++) {
            if (decorationQueue.size >= CAPS.queuedDecorations) {
                let victimId = null;
                let victimPriority = Infinity;
                for (const [id, queuedPriority] of queuedDecorationPriorities) {
                    if (queuedPriority < victimPriority) {
                        victimId = id;
                        victimPriority = queuedPriority;
                    }
                }
                if (victimId === null || victimPriority > priority) {
                    countEvent("droppedDecorations");
                    continue;
                }
                cancelTimer(victimId);
                countEvent("evictedQueuedDecorations");
            }
            accepted = true;
            const timerId = schedule(() => {
                if (!layer.isConnected) {
                    countEvent("droppedDecorations");
                    return;
                }
                while (decorations.size >= maxActive) {
                    let victim = null;
                    for (const record of decorations) {
                        if (!victim || record.priority < victim.priority) victim = record;
                    }
                    if (!victim || victim.priority > priority) {
                        countEvent("droppedDecorations");
                        return;
                    }
                    removeRecord(victim);
                    countEvent("evictedDecorations");
                }
                const node = document.createElement("div");
                node.className = `vfx-effect vfx-${type}${variant ? ` vfx-variant-${variant}` : ""}`;
                node.setAttribute("aria-hidden", "true");
                const element = ownsString(elements, elementName) ? elements[elementName] : null;
                node.setAttribute("data-vfx-shape", type === "cast" ? "projectile" : (element ? element.shape : spec.shape));
                node.style.setProperty("--vfx-color", element ? element.color : spec.color);
                node.style.setProperty("--vfx-duration", `${duration}ms`);
                const actualParticles = Math.min(particleCount, budget.particles - particles);
                for (let p = 0; p < actualParticles; p++) {
                    const particle = document.createElement("span");
                    particle.className = "vfx-particle";
                    particle.style.setProperty("--particle-angle", `${Math.floor(360 / actualParticles * p)}deg`);
                    node.appendChild(particle);
                }
                layer.appendChild(node);
                const record = makeRecord(node, options, position);
                record.priority = priority;
                record.particles = actualParticles;
                decorations.add(record);
                countEvent("spawnedDecorations");
                particles += actualParticles;
                record.timer = schedule(() => removeRecord(record), duration + 90);
            }, i * 55, decorationQueue);
            if (timerId !== null) queuedDecorationPriorities.set(timerId, priority);
        }
        if (options.text !== undefined && options.text !== null && options.text !== "") {
            accepted = spawnVfxResult(labelKind(type, options), options) === true || accepted;
        }
        return accepted ? true : null;
    }
    function clearVfxLayer() {
        generation++;
        timers.forEach(id => clearTimeout(id));
        timers.clear();
        decorationQueue.clear();
        queuedDecorationPriorities.clear();
        externalSchedules.clear();
        decorations.clear();
        labels.clear();
        labelQueue.length = 0;
        followers.clear();
        particles = 0;
        followTimer = null;
        labelPumpTimer = null;
        labelRetryTimer = null;
        labelRetryAttempts = 0;
        projectileBurstGuardUntil = 0;
        const layer = typeof document !== "undefined" ? document.getElementById(VFX_LAYER_ID) : null;
        if (layer) { layer.innerHTML = ""; applyLayerSettings(layer); }
    }
    function getVfxSettings() { return { ...settings }; }
    function setVfxSettings(patch, options = {}) {
        const next = normalizeSettings(patch);
        if (Object.keys(defaults).some(key => settings[key] !== next[key])) {
            settings = next;
            clearVfxLayer();
        }
        if (!global.VFX_PREVIEW && (!options || options.persist !== false)) {
            try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
        }
        return getVfxSettings();
    }
    function getVfxDiagnostics() {
        const boundedSum = (...values) => Math.min(Number.MAX_SAFE_INTEGER, values.reduce((sum, value) => sum + value, 0));
        return {
            generation, settings: getVfxSettings(), reducedMotion: prefersReducedMotion(),
            effectiveReducedMotion: prefersReducedMotion(), activeDecorations: decorations.size,
            totalParticles: particles, queuedDecorations: decorationQueue.size,
            externalSchedules: externalSchedules.size, activeLabels: labels.size, queuedLabels: labelQueue.length,
            pendingTimers: timers.size, followingNodes: followers.size, followUpdaterActive: followTimer !== null,
            labelRetryActive: labelRetryTimer !== null,
            counters: {
                ...counters,
                spawned: boundedSum(counters.spawnedDecorations, counters.spawnedLabels),
                dropped: boundedSum(counters.droppedDecorations, counters.droppedLabels, counters.droppedSchedules),
                evicted: boundedSum(counters.evictedDecorations, counters.evictedQueuedDecorations)
            },
            caps: { ...CAPS, ...limits(), burstSpacing: 55, labelRetryDelay: LABEL_RETRY_DELAY, labelRetryLimit: LABEL_RETRY_LIMIT }
        };
    }
    function scheduleVfx(callback, delay = 0) {
        if (typeof callback !== "function" || externalSchedules.size >= CAPS.externalSchedules) {
            countEvent("droppedSchedules");
            return false;
        }
        const accepted = schedule(callback, finite(delay, 0, 0, 10000), externalSchedules) !== null;
        if (!accepted) countEvent("droppedSchedules");
        return accepted;
    }
    function triggerProjectileFX(type = "arcane", count = 1) {
        const now = Date.now();
        if (now < projectileBurstGuardUntil) return;
        projectileBurstGuardUntil = now + 90;
        return spawnVfx("cast", {
            anchor: "monster", count, duration: prefersReducedMotion() ? 160 : 320,
            particleCount: prefersReducedMotion() ? 0 : 1,
            variant: `projectile-${ownsString(elements, type) ? type : "arcane"}`
        });
    }
    function skillElement(skill, job, css = false) {
        if (skill && typeof skill === "object" && skill.vfx && ownsString(elements, skill.vfx.element)) return skill.vfx.element;
        const name = typeof skill === "string" ? skill : (skill && typeof skill.name === "string" ? skill.name : "");
        if (!name) return css ? "bash" : "arcane";
        if (/[火炎爆隕]/.test(name)) return "fire";
        if (/[冰霜凍雪]/.test(name)) return "ice";
        if (/[雷電震]/.test(name)) return "lightning";
        if (/[聖光]/.test(name) || /治癒/.test(name) || (css ? /頌歌/.test(name) : /驅魔/.test(name))) return "holy";
        if (css && /毒/.test(name)) return "poison";
        if (!css && ["archer", "hunter", "bard_dancer"].includes(job)) return "arrow";
        return css ? "bash" : "arcane";
    }
    function detectProjectileType(skill, job) { return skillElement(skill, job); }
    function detectSkillCssClass(skill, job) { return `skill-${skillElement(skill, job, true)}`; }
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", () => { if (isDocumentHidden()) clearVfxLayer(); });
    }
    if (motionQuery) {
        if (typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", clearVfxLayer);
        else if (typeof motionQuery.addListener === "function") motionQuery.addListener(clearVfxLayer);
    }
    if (typeof global.addEventListener === "function") {
        global.addEventListener("resize", () => {
            for (const record of labels) {
                record.layout = null;
                record.size = null;
            }
            for (const record of [...labels]) {
                if (setPosition(record, record.position)) continue;
                removeRecord(record);
                if (labelQueue.length < CAPS.queuedLabels) labelQueue.push({ ...record.item, position: record.position });
                else countEvent("droppedLabels");
            }
            if (labelQueue.length && !isDocumentHidden()) pumpLabels();
        });
    }
    Object.assign(global, {
        VFX_EFFECTS, prefersReducedMotion, ensureVfxLayer, clampVfxPercent, resolveVfxPosition,
        spawnVfx, spawnVfxResult, spawnResultLabel: spawnVfxResult, clearVfxLayer, scheduleVfx,
        triggerProjectileFX, detectProjectileType, detectSkillCssClass,
        getVfxSettings, setVfxSettings, getVfxDiagnostics
    });
    global.spawnVfx = spawnVfx;
})(typeof window !== "undefined" ? window : globalThis);
