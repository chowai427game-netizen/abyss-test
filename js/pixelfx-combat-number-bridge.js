import { clearFrame, composite, createFrame, createFx } from "./vendor/pixelfx/src/core/index.js";
import * as damageNumber from "./vendor/pixelfx/src/fx/ui/damage-number.js";
import * as critNumber from "./vendor/pixelfx/src/fx/ui/crit-number.js";
import { spell } from "./vendor/pixelfx/src/fx/ui/_lib.js";

const EFFECTS = Object.freeze({ damage: damageNumber, crit: critNumber });
const MAX_FRAME_WIDTH = 512;
const FRAME_STEP = 1 / 30;

function normalizeDamageText(value) {
    const match = String(value ?? "").match(/-?\s*[\d,]+/);
    if (!match) return "";
    const digits = match[0].replace(/\D/g, "");
    return digits ? `-${digits}` : "";
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function createCombatNumber({ kind, text, x, y, seed = 1, scale } = {}) {
    const mod = EFFECTS[kind];
    const displayText = normalizeDamageText(text);
    if (!mod || !displayText || typeof document === "undefined" || typeof requestAnimationFrame !== "function") return null;

    const baseMeta = mod.meta;
    const [baseWidth, height] = baseMeta.size;
    const [baseOriginX, originY] = baseMeta.origin;
    const maxGlyphScale = kind === "crit" ? 7 : 3.4;
    const requiredWidth = Math.ceil(spell(displayText).w * maxGlyphScale + 8);
    const width = Math.min(MAX_FRAME_WIDTH, Math.max(baseWidth, requiredWidth));
    const originX = width === baseWidth ? baseOriginX : Math.round(width / 2);
    const effectModule = width === baseWidth ? mod : {
        ...mod,
        meta: { ...baseMeta, size: [width, height], origin: [originX, originY] }
    };
    const frame = createFrame(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context || typeof context.createImageData !== "function" || typeof context.putImageData !== "function") return null;
    const output = context.createImageData(width, height);

    const effect = createFx(effectModule, {
        x: originX,
        y: originY,
        text: displayText,
        label: "CRIT",
        seed: Math.max(1, Math.floor(Number(seed) || 1))
    });
    canvas.className = "vfx-pixelfx-number";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-pixelfx-kind", kind);
    canvas.setAttribute("data-pixelfx-text", displayText);
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    canvas.style.imageRendering = "pixelated";

    const viewportWidth = Math.max(1, Number(globalThis.innerWidth) || 1);
    const viewportHeight = Math.max(1, Number(globalThis.innerHeight) || 1);
    const preferredScale = Number.isFinite(Number(scale)) ? clamp(Number(scale), 0.75, 1.5) : (kind === "crit" ? 1.2 : 1.35);
    const cssScale = Math.min(preferredScale, (viewportWidth - 12) / width, (viewportHeight - 12) / height);
    if (!Number.isFinite(cssScale) || cssScale <= 0) return null;
    const cssWidth = width * cssScale;
    const cssHeight = height * cssScale;
    const anchorX = clamp(Number(x) || viewportWidth / 2, originX * cssScale + 4, viewportWidth - (width - originX) * cssScale - 4);
    const anchorY = clamp(Number(y) || viewportHeight / 2, originY * cssScale + 4, viewportHeight - (height - originY) * cssScale - 4);
    canvas.style.left = `${anchorX - originX * cssScale}px`;
    canvas.style.top = `${anchorY - originY * cssScale}px`;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    let rafId = null;
    let disposed = false;
    let previousTimestamp = null;
    let accumulator = 0;
    let hasDrawn = false;
    let onComplete = null;

    const destroy = () => {
        if (disposed) return;
        disposed = true;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
        if (canvas.parentNode) canvas.remove();
    };

    const finish = () => {
        if (disposed) return;
        const callback = onComplete;
        destroy();
        if (callback) callback();
    };

    const draw = (timestamp) => {
        rafId = null;
        if (disposed) return;
        if (document.visibilityState === "hidden") {
            destroy();
            return;
        }
        if (previousTimestamp !== null) accumulator += clamp((timestamp - previousTimestamp) / 1000, 0, 0.1);
        previousTimestamp = timestamp;
        if (accumulator >= FRAME_STEP || !hasDrawn) {
            const dt = Math.min(0.1, accumulator);
            accumulator = 0;
            if (dt > 0) effect.update(dt);
            clearFrame(frame);
            effect.draw(frame);
            composite(frame, output.data, null);
            context.putImageData(output, 0, 0);
            hasDrawn = true;
            if (effect.done()) {
                finish();
                return;
            }
        }
        rafId = requestAnimationFrame(draw);
    };

    return {
        element: canvas,
        start(completed) {
            if (disposed || rafId !== null) return false;
            onComplete = typeof completed === "function" ? completed : null;
            rafId = requestAnimationFrame(draw);
            return rafId !== null;
        },
        destroy
    };
}

const api = Object.freeze({ create: createCombatNumber, normalizeDamageText });
if (typeof window !== "undefined") window.PixelFxCombatNumbers = api;
export { createCombatNumber, createCombatNumber as create, normalizeDamageText };
