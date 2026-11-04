import { clearFrame, composite, createFrame, createFx } from "./vendor/pixelfx/src/core/index.js";
import * as darkExplosion from "./vendor/pixelfx/src/fx/shadow/dark-explosion.js";

export const PIXELFX_POISON_EXPLOSION_SPEED = 2;
export const PIXELFX_POISON_EXPLOSION_PALETTE = Object.freeze([
    "#071311", "#10231d", "#1d3c2a", "#34633b",
    "#4f8f49", "#7fbe52", "#b9e77c", "#fbffd2"
]);

const [FRAME_WIDTH, FRAME_HEIGHT] = darkExplosion.meta.size;
const [ORIGIN_X, ORIGIN_Y] = darkExplosion.meta.origin;
const MAX_ACTIVE_EFFECTS = 1;
const MAX_FRAME_DELTA = 0.05;

function isReducedMotion(host) {
    const userPreference = host.document?.body?.getAttribute?.("data-vfx-reduced-motion") === "true";
    let systemPreference = false;
    try {
        systemPreference = Boolean(host.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    } catch {
        systemPreference = false;
    }
    return userPreference || systemPreference;
}

export function createPixelFxSkillEffects(host = globalThis) {
    const activeEffects = new Set();
    const doc = host.document;

    function getLayout() {
        const scene = doc?.getElementById?.("battle-scene-box");
        const stage = scene?.querySelector?.(".battle-stage");
        const target = doc?.getElementById?.("battle-monster-vfx-anchor");
        if (!scene || !stage || !target || scene.hidden || scene.style?.display === "none") return null;

        try {
            if (host.getComputedStyle?.(scene)?.display === "none") return null;
        } catch {
            return null;
        }

        const stageRect = stage.getBoundingClientRect?.();
        const targetRect = target.getBoundingClientRect?.();
        if (!stageRect || !targetRect || stageRect.width <= 0 || stageRect.height <= 0 || targetRect.width <= 0 || targetRect.height <= 0) return null;
        return { scene, stage, target, stageRect, targetRect };
    }

    function positionCanvas(canvas, layout) {
        const { stageRect, targetRect } = layout;
        const scale = Math.max(0.72, Math.min(1.12, stageRect.width / 420));
        const targetX = targetRect.left + targetRect.width / 2 - stageRect.left;
        const targetY = targetRect.bottom - stageRect.top;
        canvas.style.width = `${Math.round(FRAME_WIDTH * scale)}px`;
        canvas.style.height = `${Math.round(FRAME_HEIGHT * scale)}px`;
        canvas.style.left = `${Math.round(targetX - ORIGIN_X * scale)}px`;
        canvas.style.top = `${Math.round(targetY - ORIGIN_Y * scale)}px`;
    }

    function dispose(entry) {
        if (entry.disposed) return;
        entry.disposed = true;
        if (entry.rafId !== null && typeof host.cancelAnimationFrame === "function") {
            host.cancelAnimationFrame(entry.rafId);
        }
        entry.rafId = null;
        if (entry.canvas.parentNode) entry.canvas.parentNode.removeChild(entry.canvas);
        activeEffects.delete(entry);
    }

    function clear() {
        const hadEffects = activeEffects.size > 0;
        for (const entry of [...activeEffects]) dispose(entry);
        return hadEffects;
    }

    function playPoisonExplosion() {
        if (!doc || doc.visibilityState === "hidden" || isReducedMotion(host) || activeEffects.size >= MAX_ACTIVE_EFFECTS) return false;
        if (typeof host.requestAnimationFrame !== "function") return false;

        const layout = getLayout();
        if (!layout) return false;

        const canvas = doc.createElement?.("canvas");
        if (!canvas) return false;
        canvas.width = FRAME_WIDTH;
        canvas.height = FRAME_HEIGHT;
        canvas.className = "battle-pixelfx-skill-effect";
        canvas.setAttribute?.("aria-hidden", "true");
        canvas.setAttribute?.("data-pixelfx-skill-effect", "poison-explosion");

        let context;
        try {
            context = canvas.getContext("2d", { alpha: true });
        } catch {
            return false;
        }
        if (!context?.createImageData || !context?.putImageData) return false;

        try {
            const image = context.createImageData(FRAME_WIDTH, FRAME_HEIGHT);
            const frame = createFrame(FRAME_WIDTH, FRAME_HEIGHT);
            const effect = createFx(darkExplosion, {
                x: ORIGIN_X,
                y: ORIGIN_Y,
                seed: Math.floor(Math.random() * 0x7fffffff),
                palette: [...PIXELFX_POISON_EXPLOSION_PALETTE]
            });
            const entry = { canvas, context, image, frame, effect, stage: layout.stage, rafId: null, lastTime: null, disposed: false };
            positionCanvas(canvas, layout);
            layout.stage.appendChild(canvas);
            activeEffects.add(entry);

            const render = (timestamp) => {
                entry.rafId = null;
                if (entry.disposed) return;
                const currentLayout = getLayout();
                if (!currentLayout || currentLayout.stage !== entry.stage || doc.visibilityState === "hidden") {
                    dispose(entry);
                    return;
                }

                try {
                    positionCanvas(canvas, currentLayout);
                    const elapsed = entry.lastTime === null ? 1 / 60 : Math.min(MAX_FRAME_DELTA, Math.max(0, (timestamp - entry.lastTime) / 1000));
                    entry.lastTime = timestamp;
                    effect.update(elapsed * PIXELFX_POISON_EXPLOSION_SPEED);
                    clearFrame(frame);
                    effect.draw(frame);
                    composite(frame, image.data, null);
                    context.putImageData(image, 0, 0);
                    if (effect.done()) {
                        dispose(entry);
                        return;
                    }
                    entry.rafId = host.requestAnimationFrame(render);
                } catch {
                    dispose(entry);
                }
            };

            entry.rafId = host.requestAnimationFrame(render);
            return true;
        } catch {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            return false;
        }
    }

    if (typeof doc?.addEventListener === "function") {
        doc.addEventListener("visibilitychange", () => {
            if (doc.visibilityState === "hidden") clear();
        });
    }

    return Object.freeze({ playPoisonExplosion, clear });
}

if (typeof window !== "undefined" && window.document && !window.PixelFxSkillEffects) {
    window.PixelFxSkillEffects = createPixelFxSkillEffects(window);
}
