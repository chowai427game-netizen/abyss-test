import { clearFrame, composite, createFrame, createFx } from "./vendor/pixelfx/src/core/index.js";
import * as shatterWipe from "./vendor/pixelfx/src/fx/transitions/shatter-wipe.js";

const [WIDTH, HEIGHT] = shatterWipe.meta.size;
const [ORIGIN_X, ORIGIN_Y] = shatterWipe.meta.origin;
const FRAME_STEP = 1 / 30;
// Shatter Wipe's upstream LAND point: the pane has reached and covered the full 320x180 frame.
export const ENCOUNTER_SHATTER_COVER_TIME = 0.55;
// Shatter Wipe's upstream BREAK point: the first burst/shard frame begins here.
export const ENCOUNTER_SHATTER_BURST_TIME = 1.62;
export const ENCOUNTER_SHATTER_OPTIONS = Object.freeze({
    speed: 0.5,
    palette: "smoke",
    color: "#0b0a10",
    seed: 2
});
export const SMOKE_PALETTE = Object.freeze([
    "#0e0c12", "#1d1a22", "#2e2a35", "#433e4b", "#5c5664", "#7b7484", "#a39cab"
]);

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function isFullyOpaque(pixels) {
    for (let alphaIndex = 3; alphaIndex < pixels.length; alphaIndex += 4) {
        if (pixels[alphaIndex] !== 255) return false;
    }
    return true;
}

function getPalette(value) {
    if (Array.isArray(value)) return value;
    return value === "smoke" ? SMOKE_PALETTE : shatterWipe.meta.options.palette;
}

function createBattleEncounterTransition({
    container,
    speed = ENCOUNTER_SHATTER_OPTIONS.speed,
    palette = ENCOUNTER_SHATTER_OPTIONS.palette,
    color = ENCOUNTER_SHATTER_OPTIONS.color,
    seed = ENCOUNTER_SHATTER_OPTIONS.seed,
    onCovered,
    onBurst
} = {}) {
    if (!container?.appendChild || typeof document === "undefined" || typeof globalThis.requestAnimationFrame !== "function") return null;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context || typeof context.createImageData !== "function" || typeof context.putImageData !== "function") return null;

    const output = context.createImageData(WIDTH, HEIGHT);
    const frame = createFrame(WIDTH, HEIGHT);
    const playbackSpeed = clamp(Number(speed) || 0.5, 0.1, 2);
    let effect;
    try {
        effect = createFx(shatterWipe, {
            x: ORIGIN_X,
            y: ORIGIN_Y,
            palette: getPalette(palette),
            color: String(color || ENCOUNTER_SHATTER_OPTIONS.color),
            seed: Math.max(1, Math.floor(Number(seed) || 1))
        });
    } catch (_error) {
        return null;
    }

    canvas.className = "battle-encounter-shatter-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-pixelfx-transition", "shatter-wipe");
    canvas.setAttribute("data-pixelfx-palette", palette === "smoke" ? "smoke" : "custom");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.imageRendering = "pixelated";

    let rafId = null;
    let disposed = false;
    let previousTimestamp = null;
    let accumulator = 0;
    let effectTime = 0;
    let hasDrawn = false;
    let covered = false;
    let burst = false;
    let resolveFinished;
    const finished = new Promise((resolve) => { resolveFinished = resolve; });

    const finish = (completed) => {
        if (disposed) return false;
        disposed = true;
        if (rafId !== null && typeof globalThis.cancelAnimationFrame === "function") {
            globalThis.cancelAnimationFrame(rafId);
        }
        rafId = null;
        if (canvas.parentNode) canvas.remove();
        resolveFinished(Boolean(completed));
        return true;
    };

    const drawFrame = (timestamp) => {
        rafId = null;
        if (disposed) return;
        if (document.visibilityState === "hidden") {
            finish(false);
            return;
        }

        if (previousTimestamp !== null) {
            accumulator += clamp((timestamp - previousTimestamp) / 1000, 0, 0.1);
        }
        previousTimestamp = timestamp;

        if (accumulator >= FRAME_STEP || !hasDrawn) {
            const elapsed = Math.min(0.1, accumulator);
            accumulator = 0;
            const dt = elapsed * playbackSpeed;
            if (dt > 0) {
                effect.update(dt);
                effectTime += dt;
            }
            clearFrame(frame);
            effect.draw(frame);
            composite(frame, output.data, null);
            context.putImageData(output, 0, 0);
            hasDrawn = true;

            // Wait for the pane to settle and verify the actual composite has no transparent pixels.
            if (!covered && effectTime >= ENCOUNTER_SHATTER_COVER_TIME && isFullyOpaque(output.data)) {
                covered = true;
                if (typeof onCovered === "function") onCovered();
            }
            if (!burst && covered && effectTime >= ENCOUNTER_SHATTER_BURST_TIME) {
                burst = true;
                if (typeof onBurst === "function") onBurst();
            }
            if (effect.done()) {
                finish(true);
                return;
            }
        }

        rafId = globalThis.requestAnimationFrame(drawFrame);
        if (rafId === null || rafId === undefined) finish(false);
    };

    try {
        container.appendChild(canvas);
    } catch (_error) {
        return null;
    }

    return {
        element: canvas,
        finished,
        start() {
            if (disposed || rafId !== null) return false;
            rafId = globalThis.requestAnimationFrame(drawFrame);
            if (rafId === null || rafId === undefined) {
                finish(false);
                return false;
            }
            return true;
        },
        cancel() {
            return finish(false);
        }
    };
}

const api = Object.freeze({
    create: createBattleEncounterTransition,
    options: ENCOUNTER_SHATTER_OPTIONS,
    coverTime: ENCOUNTER_SHATTER_COVER_TIME,
    burstTime: ENCOUNTER_SHATTER_BURST_TIME
});
if (typeof window !== "undefined") window.PixelFxEncounterTransition = api;

export { createBattleEncounterTransition, createBattleEncounterTransition as create };
