// --------------------------------------------------------------------------
// 💥 戰場特效與多投射物連發機制
// --------------------------------------------------------------------------
const VFX_LAYER_ID = "vfx-layer";
const VFX_LIMIT_DEFAULT = 24;
let projectileBurstGuardUntil = 0;

(function (global) {
    const MAX_ACTIVE_EFFECTS = 40;
    const MAX_ACTIVE_PARTICLES = 96;
    const MAX_QUEUED_SPAWNS = 32;
    const MAX_PENDING_TIMERS = 160;
    const MAX_ACTIVE_LABELS = 8;
    const MAX_QUEUED_LABELS = 24;
    const ANCHOR_IDS = {
        monster: "monster-status-card",
        player: "status-panel-box",
        log: "log-wrapper-box"
    };
    const VFX_DEFINITIONS = Object.freeze({
        cast: { duration: 320, shape: "slash", color: "#cbd5e1", priority: 20, particleCount: 1 },
        hit: { duration: 460, shape: "fire-burst", color: "var(--vfx-hit-color)", priority: 60, particleCount: 3, labelKind: "damage" },
        crit: { duration: 460, shape: "fire-burst", color: "var(--vfx-crit-color)", priority: 100, particleCount: 3, labelKind: "crit" },
        heal: { duration: 460, shape: "heal-points", color: "var(--vfx-heal-color)", priority: 90, particleCount: 3, labelKind: "heal" },
        shield: { duration: 460, shape: "shield-ring", color: "var(--vfx-shield-color)", priority: 90, particleCount: 3, labelKind: "shield" },
        miss: { duration: 460, shape: "lightning-zigzag", color: "var(--vfx-miss-color)", priority: 100, particleCount: 2, labelKind: "miss" },
        "boss-entry": { duration: 900, shape: "fire-burst", color: "var(--vfx-boss-color)", priority: 70, particleCount: 4 },
        "boss-defeat": { duration: 1200, shape: "fire-burst", color: "var(--vfx-boss-color)", priority: 80, particleCount: 5 }
    });
    const projectileShapes = {
        fire: "fire-burst",
        ice: "ice-shards",
        lightning: "lightning-zigzag",
        holy: "heal-points",
        arrow: "slash",
        arcane: "fire-burst"
    };
    const projectileColors = {
        fire: "#ff7b7b",
        ice: "#7dd3fc",
        lightning: "#fde047",
        holy: "#fef08a",
        arrow: "#86efac"
    };
    const pendingVfxTimers = new Set();
    const queuedSpawns = new Map();
    const activeVfxNodes = new Map();
    const activeLabels = new Map();
    const queuedLabels = [];
    const followingNodes = new Map();
    let vfxGeneration = 0;
    let sequence = 0;
    let labelSequence = 0;
    let activeParticleCount = 0;
    let droppedEffects = 0;
    let droppedLabels = 0;
    let followListenersAttached = false;
    let settings = readStoredSettings();

    function isDocumentHidden() {
        return typeof document !== "undefined" && document.visibilityState === "hidden";
    }

    function boundedInteger(value, fallback, minimum, maximum) {
        if (value === null || value === undefined) return fallback;
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(maximum, Math.max(minimum, Math.floor(number)));
    }

    function getVfxSettings() {
        return {
            profile: settings.profile,
            quality: settings.quality,
            reduceMotion: settings.reduceMotion,
            systemReducedMotion: prefersReducedMotion(),
            effectiveReducedMotion: settings.reduceMotion || prefersReducedMotion()
        };
    }

    function readStoredSettings() {
        const defaults = { profile: "legacy", quality: "standard", reduceMotion: false };
        try {
            if (typeof localStorage === "undefined" || (typeof document !== "undefined" && document.body?.getAttribute("data-vfx-preview") === "true")) return defaults;
            const stored = JSON.parse(localStorage.getItem("abyss-test:vfx-preferences") || "{}");
            return {
                profile: stored.profile === "enhanced" ? "enhanced" : "legacy",
                quality: ["low", "standard", "high"].includes(stored.quality) ? stored.quality : "standard",
                reduceMotion: stored.reduceMotion === true
            };
        } catch {
            return defaults;
        }
    }

    function persistSettings() {
        try {
            if (typeof localStorage === "undefined" || (typeof document !== "undefined" && document.body?.getAttribute("data-vfx-preview") === "true")) return;
            localStorage.setItem("abyss-test:vfx-preferences", JSON.stringify(settings));
        } catch {
            return;
        }
    }

    function reflectMotionPreference() {
        const body = typeof document !== "undefined" ? document.body : null;
        if (body?.setAttribute) {
            body.setAttribute("data-vfx-reduced-motion", settings.reduceMotion || prefersReducedMotion() ? "true" : "false");
        }
    }

    function syncSettingsControls() {
        if (typeof document === "undefined") return;
        const profile = document.getElementById("vfx-profile-setting");
        const quality = document.getElementById("vfx-quality-setting");
        const reduceMotion = document.getElementById("vfx-reduce-motion-setting");
        if (profile) profile.value = settings.profile;
        if (quality) quality.value = settings.quality;
        if (reduceMotion) reduceMotion.checked = settings.reduceMotion;
    }

    function setVfxSettings(updates = {}) {
        if (!updates || typeof updates !== "object") return getVfxSettings();
        settings = {
            profile: updates.profile === "enhanced" ? "enhanced" : (updates.profile === "legacy" ? "legacy" : settings.profile),
            quality: ["low", "standard", "high"].includes(updates.quality) ? updates.quality : settings.quality,
            reduceMotion: typeof updates.reduceMotion === "boolean" ? updates.reduceMotion : settings.reduceMotion
        };
        reflectMotionPreference();
        persistSettings();
        syncSettingsControls();
        return getVfxSettings();
    }

    function bindSettingsControls() {
        if (typeof document === "undefined") return;
        const profile = document.getElementById("vfx-profile-setting");
        const quality = document.getElementById("vfx-quality-setting");
        const reduceMotion = document.getElementById("vfx-reduce-motion-setting");
        if (profile && !profile.dataset.vfxBound) {
            profile.dataset.vfxBound = "true";
            profile.addEventListener("change", () => setVfxSettings({ profile: profile.value }));
        }
        if (quality && !quality.dataset.vfxBound) {
            quality.dataset.vfxBound = "true";
            quality.addEventListener("change", () => setVfxSettings({ quality: quality.value }));
        }
        if (reduceMotion && !reduceMotion.dataset.vfxBound) {
            reduceMotion.dataset.vfxBound = "true";
            reduceMotion.addEventListener("change", () => setVfxSettings({ reduceMotion: reduceMotion.checked }));
        }
        reflectMotionPreference();
        syncSettingsControls();
    }

    function scheduleTrackedVfx(callback, delay = 0) {
        if (isDocumentHidden() || typeof setTimeout !== "function" || pendingVfxTimers.size >= MAX_PENDING_TIMERS) return null;
        const generation = vfxGeneration;
        let timerId;
        timerId = setTimeout(() => {
            pendingVfxTimers.delete(timerId);
            if (generation !== vfxGeneration) return;
            if (isDocumentHidden()) {
                clearVfxLayer();
                return;
            }
            callback();
        }, delay);
        pendingVfxTimers.add(timerId);
        return timerId;
    }

    function cancelTrackedTimer(timerId) {
        if (timerId === null || timerId === undefined) return;
        clearTimeout(timerId);
        pendingVfxTimers.delete(timerId);
    }

    function prefersReducedMotion() {
        try {
            return !!(typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        } catch {
            return false;
        }
    }

    function motionReduced() {
        return settings.reduceMotion || prefersReducedMotion();
    }

    function ensureVfxLayer() {
        if (typeof document === "undefined" || !document.body) return null;
        let layer = document.getElementById(VFX_LAYER_ID);
        if (!layer) {
            layer = document.createElement("div");
            layer.id = VFX_LAYER_ID;
            layer.className = "vfx-layer";
            layer.setAttribute("aria-hidden", "true");
            layer.style.pointerEvents = "none";
            document.body.appendChild(layer);
        }
        let labelLayer = document.getElementById("vfx-label-layer");
        if (!labelLayer) {
            labelLayer = document.createElement("div");
            labelLayer.id = "vfx-label-layer";
            labelLayer.className = "vfx-label-layer";
            labelLayer.setAttribute("aria-hidden", "true");
            document.body.appendChild(labelLayer);
        }
        return layer;
    }

    function ensureLabelLayer() {
        ensureVfxLayer();
        return typeof document !== "undefined" ? document.getElementById("vfx-label-layer") : null;
    }

    function clampVfxPercent(value, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.min(92, Math.max(8, num));
    }

    function resolveVfxPosition(options = {}) {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return { x: 50, y: 45 };
        }
        if (Number.isFinite(options.x) || Number.isFinite(options.y)) {
            return {
                x: clampVfxPercent(options.x, 50),
                y: clampVfxPercent(options.y, 45)
            };
        }

        const targetId = (options.anchorId && /^[a-zA-Z][\w:-]{0,63}$/.test(options.anchorId) ? options.anchorId : null) ||
            ANCHOR_IDS[options.anchor] || ANCHOR_IDS.monster;
        const anchorEl = document.getElementById(targetId);
        const fallbackPosition = { x: 50, y: options.anchor === "player" ? 38 : 46 };
        if (!anchorEl || typeof anchorEl.getBoundingClientRect !== "function" || anchorEl.hidden ||
            anchorEl.style?.display === "none" || anchorEl.style?.visibility === "hidden") {
            return fallbackPosition;
        }

        const rect = anchorEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return fallbackPosition;
        const width = Math.max(1, window.innerWidth || 1);
        const height = Math.max(1, window.innerHeight || 1);
        return {
            x: clampVfxPercent((rect.left + rect.width * 0.5) / width * 100, 50),
            y: clampVfxPercent((rect.top + rect.height * 0.45) / height * 100, 45)
        };
    }

    function anchorIdFor(options) {
        if (options.anchorId && /^[a-zA-Z][\w:-]{0,63}$/.test(options.anchorId)) return options.anchorId;
        return ANCHOR_IDS[options.anchor] || ANCHOR_IDS.monster;
    }

    function updateFollowingPositions() {
        for (const [node, targetId] of followingNodes) {
            const target = document.getElementById(targetId);
            if (!target) {
                followingNodes.delete(node);
                continue;
            }
            if (target.hidden || target.style?.display === "none" || target.style?.visibility === "hidden") continue;
            if (typeof target.getBoundingClientRect !== "function") continue;
            const rect = target.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) continue;
            const position = resolveVfxPosition({ anchorId: targetId });
            node.style.setProperty("--vfx-x", `${position.x}%`);
            node.style.setProperty("--vfx-y", `${position.y}%`);
        }
        if (followingNodes.size === 0) detachFollowListeners();
    }

    function attachFollowListeners() {
        if (followListenersAttached || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
        window.addEventListener("scroll", updateFollowingPositions, { passive: true });
        window.addEventListener("resize", updateFollowingPositions, { passive: true });
        window.addEventListener("orientationchange", updateFollowingPositions, { passive: true });
        followListenersAttached = true;
    }

    function detachFollowListeners() {
        if (!followListenersAttached || typeof window === "undefined" || typeof window.removeEventListener !== "function") return;
        window.removeEventListener("scroll", updateFollowingPositions);
        window.removeEventListener("resize", updateFollowingPositions);
        window.removeEventListener("orientationchange", updateFollowingPositions);
        followListenersAttached = false;
    }

    function qualityConfig() {
        const reduced = motionReduced();
        if (reduced) return { maxActive: 12, maxBurst: 2, particles: 0 };
        if (settings.quality === "low") return { maxActive: 12, maxBurst: 2, particles: 0 };
        if (settings.quality === "high") return { maxActive: VFX_LIMIT_DEFAULT, maxBurst: 4, particles: 6 };
        return { maxActive: VFX_LIMIT_DEFAULT, maxBurst: 4, particles: 3 };
    }

    function normalizedType(type) {
        const value = String(type || "").replace(/[^a-z0-9-]/gi, "").slice(0, 32);
        return value || "effect";
    }

    function normalizedLabelKind(kind, fallback) {
        return ["damage", "crit", "heal", "mana", "shield", "miss", "overheal"].includes(kind) ? kind : fallback;
    }

    function effectColor(type, options) {
        if (options.variant === "mana") return "#60a5fa";
        if (options.variant === "damage") return "#fb7185";
        return projectileColors[options.projectileType] || VFX_DEFINITIONS[type]?.color || "#cbd5e1";
    }

    function removeVfxNode(node) {
        const record = activeVfxNodes.get(node);
        if (!record) return;
        cancelTrackedTimer(record.timerId);
        activeParticleCount = Math.max(0, activeParticleCount - record.particles);
        activeVfxNodes.delete(node);
        followingNodes.delete(node);
        if (node.parentNode) node.remove();
        if (followingNodes.size === 0) detachFollowListeners();
    }

    function removeLowestPriorityEffect() {
        let candidate = null;
        for (const [node, record] of activeVfxNodes) {
            if (!candidate || record.priority < candidate.priority ||
                (record.priority === candidate.priority && record.sequence < candidate.sequence)) {
                candidate = { node, ...record };
            }
        }
        if (!candidate) return false;
        removeVfxNode(candidate.node);
        droppedEffects++;
        return true;
    }

    function addResultLabel(text, type, position, options, priority, generation) {
        const layer = ensureLabelLayer();
        if (!layer || !text) return;
        const label = {
            text: String(text).slice(0, 80),
            type,
            position,
            kind: normalizedLabelKind(options.labelKind, options.variant === "mana" ? "mana" : (VFX_DEFINITIONS[type]?.labelKind || "damage")),
            priority,
            sequence: labelSequence++,
            duration: boundedInteger(options.labelDuration, 1050, 400, 1800),
            generation
        };
        if (activeLabels.size < MAX_ACTIVE_LABELS) {
            mountResultLabel(layer, label);
            return;
        }
        if (queuedLabels.length >= MAX_QUEUED_LABELS) {
            let lowestIndex = 0;
            for (let i = 1; i < queuedLabels.length; i++) {
                if (queuedLabels[i].priority < queuedLabels[lowestIndex].priority) lowestIndex = i;
            }
            if (queuedLabels[lowestIndex].priority >= priority) {
                droppedLabels++;
                return;
            }
            queuedLabels.splice(lowestIndex, 1);
            droppedLabels++;
        }
        queuedLabels.push(label);
        queuedLabels.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    }

    function mountResultLabel(layer, label) {
        if (label.generation !== vfxGeneration || isDocumentHidden() || !layer.isConnected) return;
        const node = document.createElement("div");
        const viewportHeight = Math.max(1, window.innerHeight || 1);
        const laneSpacing = Math.max(16, Math.min(32, (viewportHeight - 48) / 7));
        const firstLane = label.sequence % MAX_ACTIVE_LABELS;
        let laneIndex = firstLane;
        for (let offset = 0; offset < MAX_ACTIVE_LABELS; offset++) {
            const candidate = (firstLane + offset) % MAX_ACTIVE_LABELS;
            if (![...activeLabels.values()].some((record) => record.laneIndex === candidate)) {
                laneIndex = candidate;
                break;
            }
        }
        const lane = (laneIndex - 3.5) * laneSpacing;
        const maxOffset = laneSpacing * 3.5;
        const safeTop = Math.min(maxOffset + 24, viewportHeight / 2 - 12);
        const labelY = Math.min(viewportHeight - safeTop, Math.max(safeTop, label.position.y / 100 * viewportHeight));
        node.className = `vfx-result-label vfx-label-${label.kind}`;
        node.setAttribute("aria-hidden", "true");
        node.setAttribute("data-label-kind", label.kind);
        node.textContent = label.text;
        node.style.setProperty("--vfx-label-x", `${label.position.x}%`);
        node.style.setProperty("--vfx-label-y", `${labelY}px`);
        node.style.setProperty("--vfx-label-lane", `${lane}px`);
        layer.appendChild(node);
        const record = { node, priority: label.priority, sequence: label.sequence, laneIndex, timerId: null };
        activeLabels.set(node, record);
        record.timerId = scheduleTrackedVfx(() => {
            if (node.parentNode) node.remove();
            activeLabels.delete(node);
            flushLabelQueue();
        }, label.duration);
        if (record.timerId === null) {
            activeLabels.delete(node);
            if (node.parentNode) node.remove();
        }
    }

    function flushLabelQueue() {
        const layer = typeof document !== "undefined" ? document.getElementById("vfx-label-layer") : null;
        while (layer && queuedLabels.length && activeLabels.size < MAX_ACTIVE_LABELS) {
            mountResultLabel(layer, queuedLabels.shift());
        }
    }

    function scheduleVisualSpawn(callback, delay, priority) {
        if (queuedSpawns.size >= MAX_QUEUED_SPAWNS) {
            let victim = null;
            for (const entry of queuedSpawns.values()) {
                if (!victim || entry.priority < victim.priority ||
                    (entry.priority === victim.priority && entry.sequence > victim.sequence)) victim = entry;
            }
            if (!victim || victim.priority >= priority) {
                droppedEffects++;
                return null;
            }
            cancelTrackedTimer(victim.timerId);
            queuedSpawns.delete(victim.timerId);
            droppedEffects++;
        }
        const entry = { priority, sequence: sequence++, timerId: null };
        const timerId = scheduleTrackedVfx(() => {
            queuedSpawns.delete(timerId);
            callback();
        }, delay);
        if (timerId === null) {
            droppedEffects++;
            return null;
        }
        entry.timerId = timerId;
        queuedSpawns.set(timerId, entry);
        return timerId;
    }

    function spawnVfx(type, options = {}) {
        if (!type || isDocumentHidden()) return null;
        const layer = ensureVfxLayer();
        if (!layer) return null;

        const vfxType = normalizedType(type);
        const definition = VFX_DEFINITIONS[vfxType] || {};
        const quality = qualityConfig();
        const configuredMaxActive = boundedInteger(options.maxActive, quality.maxActive, 1, MAX_ACTIVE_EFFECTS);
        const maxActive = Math.min(configuredMaxActive, quality.maxActive);
        const effectCount = boundedInteger(options.count, 1, 1, quality.maxBurst);
        const duration = boundedInteger(options.duration, definition.duration || 460, 120, 1400);
        const defaultParticles = (definition.particleCount ?? 3) * (settings.quality === "high" ? 2 : 1);
        const particleCount = boundedInteger(options.particleCount, Math.min(defaultParticles, quality.particles), 0, quality.particles);
        const priority = boundedInteger(options.priority, definition.priority || 50, 0, 120);
        const pos = resolveVfxPosition(options);
        const labelText = options.text === null || options.text === undefined ? "" : String(options.text).trim().slice(0, 80);
        const variant = options.variant ? ` vfx-variant-${String(options.variant).replace(/[^a-z0-9_-]/gi, "-").slice(0, 32)}` : "";
        const metadataShape = options.shape || (options.projectileType && projectileShapes[options.projectileType]);
        const shape = ["slash", "fire-burst", "ice-shards", "lightning-zigzag", "heal-points", "shield-ring"].includes(metadataShape)
            ? metadataShape : definition.shape;
        const generation = vfxGeneration;
        if (labelText) addResultLabel(labelText, vfxType, pos, options, priority, generation);

        let accepted = false;
        for (let i = 0; i < effectCount; i++) {
            if (queuedSpawns.size >= MAX_QUEUED_SPAWNS && priority <= Math.min(...[...queuedSpawns.values()].map(entry => entry.priority))) {
                droppedEffects++;
                continue;
            }
            const timerId = scheduleVisualSpawn(() => {
                if (typeof document === "undefined" || !document.body || !layer.isConnected || generation !== vfxGeneration) return;
                const activeLimit = Math.min(maxActive, qualityConfig().maxActive);
                while (activeVfxNodes.size >= activeLimit) {
                    let weakest = Infinity;
                    for (const record of activeVfxNodes.values()) weakest = Math.min(weakest, record.priority);
                    if (priority <= weakest || !removeLowestPriorityEffect()) {
                        droppedEffects++;
                        return;
                    }
                }

                const node = document.createElement("div");
                const enhanced = settings.profile === "enhanced";
                const activeParticles = Math.min(particleCount, Math.max(0, MAX_ACTIVE_PARTICLES - activeParticleCount));
                node.className = `vfx-effect vfx-${vfxType}${variant}${enhanced ? " vfx-profile-enhanced" : ""}${enhanced && shape ? ` vfx-shape-${shape}` : ""}`;
                node.setAttribute("aria-hidden", "true");
                node.setAttribute("data-vfx-priority", String(priority));
                if (labelText) node.setAttribute("data-vfx-text", labelText);
                if (shape) node.setAttribute("data-vfx-shape", shape);
                node.style.setProperty("--vfx-x", `${clampVfxPercent(pos.x + ((sequence++ * 7) % 9 - 4), pos.x)}%`);
                node.style.setProperty("--vfx-y", `${clampVfxPercent(pos.y + ((sequence++ * 5) % 9 - 4), pos.y)}%`);
                node.style.setProperty("--vfx-duration", `${duration}ms`);
                node.style.setProperty("--vfx-effect-color", effectColor(vfxType, options));

                for (let p = 0; p < activeParticles; p++) {
                    const particle = document.createElement("span");
                    particle.className = "vfx-particle";
                    particle.style.setProperty("--particle-angle", `${Math.floor((360 / Math.max(1, activeParticles)) * p)}deg`);
                    node.appendChild(particle);
                }

                layer.appendChild(node);
                activeParticleCount += activeParticles;
                const record = { timerId: null, particles: activeParticles, priority, sequence: sequence++ };
                activeVfxNodes.set(node, record);
                if (options.positionMode === "follow-anchor" && !Number.isFinite(options.x) && !Number.isFinite(options.y)) {
                    followingNodes.set(node, anchorIdFor(options));
                    attachFollowListeners();
                }
                record.timerId = scheduleTrackedVfx(() => removeVfxNode(node), duration + 90);
                if (record.timerId === null) removeVfxNode(node);
            }, i * 55, priority);
            if (timerId !== null) accepted = true;
        }
        return accepted || Boolean(labelText);
    }

    function clearVfxLayer() {
        vfxGeneration++;
        pendingVfxTimers.forEach((timerId) => clearTimeout(timerId));
        pendingVfxTimers.clear();
        queuedSpawns.clear();
        activeVfxNodes.clear();
        activeLabels.clear();
        queuedLabels.length = 0;
        labelSequence = 0;
        followingNodes.clear();
        activeParticleCount = 0;
        detachFollowListeners();

        const layer = typeof document !== "undefined" ? document.getElementById(VFX_LAYER_ID) : null;
        if (layer) layer.innerHTML = "";
        const labelLayer = typeof document !== "undefined" ? document.getElementById("vfx-label-layer") : null;
        if (labelLayer) labelLayer.innerHTML = "";
    }

    function scheduleVfx(callback, delay = 0) {
        if (typeof callback !== "function") return false;
        const boundedDelay = Number(delay);
        return scheduleTrackedVfx(callback, Number.isFinite(boundedDelay) ? Math.min(60000, Math.max(0, boundedDelay)) : 0) !== null;
    }

    function detectProjectileType(skillName, job, metadata) {
        const explicit = metadata && typeof metadata === "object"
            ? metadata.projectileType || metadata.element
            : typeof metadata === "string" ? metadata : null;
        if (Object.prototype.hasOwnProperty.call(projectileShapes, explicit)) return explicit;
        if (!skillName) return "arcane";
        if (skillName.includes("火") || skillName.includes("炎") || skillName.includes("爆") || skillName.includes("隕")) return "fire";
        if (skillName.includes("冰") || skillName.includes("霜") || skillName.includes("凍") || skillName.includes("雪")) return "ice";
        if (skillName.includes("雷") || skillName.includes("電") || skillName.includes("震")) return "lightning";
        if (skillName.includes("聖") || skillName.includes("治癒") || skillName.includes("光") || skillName.includes("驅魔")) return "holy";
        if (job === "archer" || job === "hunter" || job === "bard_dancer") return "arrow";
        return "arcane";
    }

    function resolveSkillVfx(skill, job) {
        const metadata = skill && (skill.vfxMetadata || skill.vfx);
        const projectileType = detectProjectileType(skill?.name, job, metadata);
        const shape = metadata && typeof metadata === "object" && ["slash", "fire-burst", "ice-shards", "lightning-zigzag", "heal-points", "shield-ring"].includes(metadata.shape)
            ? metadata.shape : projectileShapes[projectileType];
        return { projectileType, shape };
    }

    function triggerProjectileFX(type = "arcane", count = 1, metadata = {}) {
        const now = Date.now();
        if (now < projectileBurstGuardUntil) return false;
        projectileBurstGuardUntil = now + 90;

        const metadataType = metadata && typeof metadata === "object" ? metadata.projectileType || metadata.element : null;
        const projectileType = projectileShapes[metadataType] ? metadataType : (projectileShapes[type] ? type : "arcane");
        const quality = qualityConfig();
        const maxCount = boundedInteger(count, 1, 1, quality.maxBurst);
        return spawnVfx("cast", {
            anchor: "monster",
            count: maxCount,
            duration: quality.maxBurst === 2 ? 160 : 320,
            particleCount: quality.particles ? 1 : 0,
            variant: `projectile-${projectileType}`,
            projectileType,
            shape: metadata && typeof metadata === "object" ? metadata.shape : undefined
        });
    }

    function detectSkillCssClass(skillName) {
        if (!skillName) return "skill-bash";
        if (skillName.includes("火") || skillName.includes("炎") || skillName.includes("爆") || skillName.includes("隕")) return "skill-fire";
        if (skillName.includes("冰") || skillName.includes("霜") || skillName.includes("凍") || skillName.includes("雪")) return "skill-ice";
        if (skillName.includes("雷") || skillName.includes("電") || skillName.includes("震")) return "skill-lightning";
        if (skillName.includes("聖") || skillName.includes("治癒") || skillName.includes("光") || skillName.includes("頌歌")) return "skill-holy";
        if (skillName.includes("毒")) return "skill-poison";
        return "skill-bash";
    }

    function getVfxDiagnostics() {
        return {
            active: activeVfxNodes.size,
            particles: activeParticleCount,
            queued: queuedSpawns.size,
            labels: activeLabels.size,
            queuedLabels: queuedLabels.length,
            dropped: droppedEffects + droppedLabels,
            timers: pendingVfxTimers.size,
            followListeners: followListenersAttached ? 3 : 0
        };
    }

    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") clearVfxLayer();
        });
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindSettingsControls, { once: true });
        else bindSettingsControls();
    }

    global.VFX_DEFINITIONS = VFX_DEFINITIONS;
    global.prefersReducedMotion = prefersReducedMotion;
    global.ensureVfxLayer = ensureVfxLayer;
    global.clampVfxPercent = clampVfxPercent;
    global.resolveVfxPosition = resolveVfxPosition;
    global.spawnVfx = spawnVfx;
    global.clearVfxLayer = clearVfxLayer;
    global.scheduleVfx = scheduleVfx;
    global.triggerProjectileFX = triggerProjectileFX;
    global.detectProjectileType = detectProjectileType;
    global.resolveSkillVfx = resolveSkillVfx;
    global.detectSkillCssClass = detectSkillCssClass;
    global.getVfxSettings = getVfxSettings;
    global.setVfxSettings = setVfxSettings;
    global.getVfxDiagnostics = getVfxDiagnostics;
})(typeof window !== "undefined" ? window : globalThis);
