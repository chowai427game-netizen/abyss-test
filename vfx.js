// --------------------------------------------------------------------------
// 💥 戰場特效與多投射物連發機制
// --------------------------------------------------------------------------
const VFX_LAYER_ID = "vfx-layer";
const VFX_LIMIT_DEFAULT = 24;
let projectileBurstGuardUntil = 0;

(function (global) {
    const pendingVfxTimers = new Set();
    let vfxGeneration = 0;

    function isDocumentHidden() {
        return typeof document !== "undefined" && document.visibilityState === "hidden";
    }

    function scheduleTrackedVfx(callback, delay, generation = vfxGeneration) {
        if (isDocumentHidden() || typeof setTimeout !== "function") return null;

        let timerId;
        timerId = setTimeout(() => {
            pendingVfxTimers.delete(timerId);
            if (generation !== vfxGeneration || isDocumentHidden()) return;
            callback();
        }, delay);
        pendingVfxTimers.add(timerId);
        return timerId;
    }

    function prefersReducedMotion() {
        return !!(typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
        return layer;
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

        const anchorMap = {
            monster: "monster-status-card",
            player: "status-panel-box",
            log: "log-wrapper-box"
        };
        const targetId = anchorMap[options.anchor] || "monster-status-card";
        const anchorEl = document.getElementById(targetId);

        if (!anchorEl || typeof anchorEl.getBoundingClientRect !== "function") {
            return { x: 50, y: options.anchor === "player" ? 38 : 46 };
        }

        const rect = anchorEl.getBoundingClientRect();
        const width = Math.max(1, window.innerWidth || 1);
        const height = Math.max(1, window.innerHeight || 1);

        return {
            x: clampVfxPercent((rect.left + rect.width * 0.5) / width * 100, 50),
            y: clampVfxPercent((rect.top + rect.height * 0.45) / height * 100, 45)
        };
    }

    function spawnVfx(type, options = {}) {
        if (!type || isDocumentHidden()) return null;
        const layer = ensureVfxLayer();
        if (!layer) return null;

        const reducedMotion = prefersReducedMotion();
        const maxActive = reducedMotion ? 12 : (options.maxActive ?? VFX_LIMIT_DEFAULT);
        while (layer.childElementCount >= maxActive && layer.firstElementChild) {
            layer.firstElementChild.remove();
        }

        const pos = resolveVfxPosition(options);
        const effectCount = Math.max(1, Math.min(options.count || 1, reducedMotion ? 2 : 4));
        const duration = Math.max(120, Math.min(options.duration ?? (reducedMotion ? 180 : 460), 1400));
        const particleCount = Math.max(0, Math.min(options.particleCount ?? (reducedMotion ? 0 : 3), reducedMotion ? 0 : 6));
        const variantClass = options.variant ? ` vfx-variant-${String(options.variant).replace(/[^a-z0-9_-]/gi, "-")}` : "";

        for (let i = 0; i < effectCount; i++) {
            scheduleTrackedVfx(() => {
                if (typeof document === "undefined" || !document.body || typeof document.createElement !== "function") return;
                const latestMaxActive = prefersReducedMotion() ? 12 : (options.maxActive ?? VFX_LIMIT_DEFAULT);
                while (layer.childElementCount >= latestMaxActive && layer.firstElementChild) {
                    layer.firstElementChild.remove();
                }
                if (!layer.isConnected) return;

                const node = document.createElement("div");
                node.className = `vfx-effect vfx-${type}${variantClass}`;
                node.setAttribute("aria-hidden", "true");
                if (options.text) node.setAttribute("data-vfx-text", options.text);
                node.style.setProperty("--vfx-x", `${clampVfxPercent(pos.x + (Math.random() - 0.5) * 6, pos.x)}%`);
                node.style.setProperty("--vfx-y", `${clampVfxPercent(pos.y + (Math.random() - 0.5) * 6, pos.y)}%`);
                node.style.setProperty("--vfx-duration", `${duration}ms`);

                for (let p = 0; p < particleCount; p++) {
                    const particle = document.createElement("span");
                    particle.className = "vfx-particle";
                    particle.style.setProperty("--particle-angle", `${Math.floor((360 / Math.max(1, particleCount)) * p)}deg`);
                    node.appendChild(particle);
                }

                layer.appendChild(node);
                scheduleTrackedVfx(() => {
                    if (node.parentNode) node.remove();
                }, duration + 90);
            }, i * 55);
        }

        return true;
    }

    function clearVfxLayer() {
        vfxGeneration++;
        pendingVfxTimers.forEach((timerId) => clearTimeout(timerId));
        pendingVfxTimers.clear();

        const layer = typeof document !== "undefined" ? document.getElementById(VFX_LAYER_ID) : null;
        if (layer) layer.innerHTML = "";
    }

    function scheduleVfx(callback, delay = 0) {
        if (typeof callback !== "function") return false;
        return scheduleTrackedVfx(callback, Math.max(0, Number(delay) || 0)) !== null;
    }

    function triggerProjectileFX(type = 'arcane', count = 1) {
        const now = Date.now();
        if (now < projectileBurstGuardUntil) return;
        projectileBurstGuardUntil = now + 90;

        const reducedMotion = prefersReducedMotion();
        const maxCount = Math.min(Math.max(1, count), reducedMotion ? 2 : 6);
        spawnVfx("hit", {
            anchor: "monster",
            count: maxCount,
            duration: reducedMotion ? 160 : 320,
            particleCount: reducedMotion ? 0 : 1,
            variant: `projectile-${type}`
        });
    }

    function detectProjectileType(skillName, job) {
        if (!skillName) return "arcane";
        if (skillName.includes("火") || skillName.includes("炎") || skillName.includes("爆") || skillName.includes("隕")) return "fire";
        if (skillName.includes("冰") || skillName.includes("霜") || skillName.includes("凍") || skillName.includes("雪")) return "ice";
        if (skillName.includes("雷") || skillName.includes("電") || skillName.includes("震")) return "lightning";
        if (skillName.includes("聖") || skillName.includes("治癒") || skillName.includes("光") || skillName.includes("驅魔")) return "holy";
        if (job === "archer" || job === "hunter" || job === "bard_dancer") return "arrow";
        return "arcane";
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

    global.prefersReducedMotion = prefersReducedMotion;
    global.ensureVfxLayer = ensureVfxLayer;
    global.clampVfxPercent = clampVfxPercent;
    global.resolveVfxPosition = resolveVfxPosition;
    global.spawnVfx = spawnVfx;
    global.clearVfxLayer = clearVfxLayer;
    global.scheduleVfx = scheduleVfx;
    global.triggerProjectileFX = triggerProjectileFX;
    global.detectProjectileType = detectProjectileType;
    global.detectSkillCssClass = detectSkillCssClass;
})(typeof window !== "undefined" ? window : globalThis);
