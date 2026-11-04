#!/usr/bin/env node
import assert from "node:assert/strict";
import { clearFrame, composite, createFrame, createFx } from "../js/vendor/pixelfx/src/core/index.js";
import * as darkExplosion from "../js/vendor/pixelfx/src/fx/shadow/dark-explosion.js";
import {
    createPixelFxSkillEffects,
    PIXELFX_POISON_EXPLOSION_PALETTE,
    PIXELFX_POISON_EXPLOSION_SPEED
} from "../js/pixelfx-skill-effects.js";

assert.equal(darkExplosion.meta.name, "Dark explosion");
assert.deepEqual(Array.from(darkExplosion.meta.size), [280, 248]);
assert.equal(darkExplosion.meta.duration, 3.8);
assert.equal(PIXELFX_POISON_EXPLOSION_SPEED, 2);
assert.equal(PIXELFX_POISON_EXPLOSION_PALETTE.length, 8);
assert.ok(PIXELFX_POISON_EXPLOSION_PALETTE.some((color) => color.toLowerCase() === "#7fbe52"), "the effect uses the game-matched poison-green ramp");

// Render the actual pinned PixelFX effect into a transparent pixel frame.
{
    const frame = createFrame(280, 248);
    const pixels = new Uint8ClampedArray(frame.w * frame.h * 4);
    const effect = createFx(darkExplosion, {
        x: darkExplosion.meta.origin[0],
        y: darkExplosion.meta.origin[1],
        seed: 17,
        palette: [...PIXELFX_POISON_EXPLOSION_PALETTE]
    });
    let visiblePixelCount = 0;
    for (let step = 0; step < 15; step++) {
        effect.update(1 / 30);
        clearFrame(frame);
        effect.draw(frame);
        composite(frame, pixels, null);
        let count = 0;
        for (let alpha = 3; alpha < pixels.length; alpha += 4) if (pixels[alpha] > 0) count++;
        visiblePixelCount = Math.max(visiblePixelCount, count);
    }
    assert.ok(visiblePixelCount > 100, `the effect renders visible transparent pixels (got ${visiblePixelCount})`);
    let guard = 0;
    while (!effect.done() && guard < 120) {
        effect.update((1 / 30) * PIXELFX_POISON_EXPLOSION_SPEED);
        guard++;
    }
    assert.equal(effect.done(), true, "the one-shot completes at the configured 2× playback speed");
}

function makeHarness({ reducedMotion = false, display = "block" } = {}) {
    let now = 0;
    let nextFrameId = 0;
    const pendingFrames = new Map();
    const visibilityListeners = new Map();
    const stats = { imageWrites: 0, maxVisiblePixels: 0 };
    const stage = {
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
        appendChild(element) {
            this.children.push(element);
            element.parentNode = this;
            return element;
        },
        removeChild(element) {
            const index = this.children.indexOf(element);
            if (index >= 0) this.children.splice(index, 1);
            element.parentNode = null;
            return element;
        }
    };
    const scene = {
        hidden: false,
        style: { display },
        querySelector: (selector) => selector === ".battle-stage" ? stage : null
    };
    const target = {
        getBoundingClientRect: () => ({ left: 270, top: 45, width: 100, height: 240, right: 370, bottom: 285 })
    };
    const document = {
        visibilityState: "visible",
        body: { getAttribute: (name) => name === "data-vfx-reduced-motion" && reducedMotion ? "true" : null },
        getElementById(id) {
            if (id === "battle-scene-box") return scene;
            if (id === "battle-monster-vfx-anchor") return target;
            return null;
        },
        addEventListener(type, listener) {
            if (type === "visibilitychange") visibilityListeners.set(type, listener);
        },
        createElement(tag) {
            assert.equal(tag, "canvas");
            const canvas = {
                width: 0,
                height: 0,
                className: "",
                style: {},
                attributes: {},
                parentNode: null,
                setAttribute(name, value) { this.attributes[name] = String(value); },
                getContext(type, options) {
                    assert.equal(type, "2d");
                    assert.equal(options.alpha, true);
                    return {
                        createImageData(width, height) {
                            return { width, height, data: new Uint8ClampedArray(width * height * 4) };
                        },
                        putImageData(image, x, y) {
                            assert.equal(x, 0);
                            assert.equal(y, 0);
                            stats.imageWrites++;
                            let visible = 0;
                            for (let alpha = 3; alpha < image.data.length; alpha += 4) if (image.data[alpha] > 0) visible++;
                            stats.maxVisiblePixels = Math.max(stats.maxVisiblePixels, visible);
                        }
                    };
                }
            };
            canvas.remove = function remove() { this.parentNode?.removeChild(this); };
            return canvas;
        }
    };
    const host = {
        document,
        matchMedia: () => ({ matches: reducedMotion }),
        getComputedStyle: (element) => ({ display: element.style.display || "block" }),
        requestAnimationFrame(callback) {
            const id = ++nextFrameId;
            pendingFrames.set(id, callback);
            return id;
        },
        cancelAnimationFrame(id) { pendingFrames.delete(id); }
    };
    function stepFrame(milliseconds = 1000 / 60) {
        now += milliseconds;
        const callbacks = [...pendingFrames.values()];
        pendingFrames.clear();
        callbacks.forEach((callback) => callback(now));
    }
    return { host, stage, scene, document, pendingFrames, visibilityListeners, stats, stepFrame };
}

// Browser bridge: one scene-local transparent canvas follows the current target and is removed on completion.
{
    const harness = makeHarness();
    const api = createPixelFxSkillEffects(harness.host);
    assert.equal(api.playPoisonExplosion(), true, "the effect starts while the battle scene and target are visible");
    assert.equal(harness.stage.children.length, 1);
    const canvas = harness.stage.children[0];
    assert.equal(canvas.width, 280);
    assert.equal(canvas.height, 248);
    assert.equal(canvas.attributes["data-pixelfx-skill-effect"], "poison-explosion");
    assert.equal(canvas.attributes["aria-hidden"], "true");
    assert.equal(canvas.className, "battle-pixelfx-skill-effect");

    let frames = 0;
    while (harness.stage.children.length && frames < 150) {
        harness.stepFrame();
        frames++;
    }
    assert.ok(harness.stats.imageWrites > 30, "the bridge renders multiple live animation frames");
    assert.ok(harness.stats.maxVisiblePixels > 100, "the canvas receives real PixelFX pixels");
    assert.ok(frames >= 90 && frames <= 130, `2× playback completes in about 1.9 s at 60 Hz (frames=${frames})`);
    assert.equal(harness.stage.children.length, 0, "the canvas is removed when the one-shot completes");
    assert.equal(harness.pendingFrames.size, 0, "no animation frame remains after completion");
}

// Reduced motion and invalid/hidden scenes fail closed, preserving the game's existing CSS hit cue.
{
    const reduced = makeHarness({ reducedMotion: true });
    assert.equal(createPixelFxSkillEffects(reduced.host).playPoisonExplosion(), false);
    assert.equal(reduced.stage.children.length, 0);

    const hiddenScene = makeHarness({ display: "none" });
    assert.equal(createPixelFxSkillEffects(hiddenScene.host).playPoisonExplosion(), false);
    assert.equal(hiddenScene.stage.children.length, 0);

    const hiddenTab = makeHarness();
    const hiddenApi = createPixelFxSkillEffects(hiddenTab.host);
    assert.equal(hiddenApi.playPoisonExplosion(), true);
    hiddenTab.stepFrame();
    hiddenTab.document.visibilityState = "hidden";
    hiddenTab.visibilityListeners.get("visibilitychange")();
    assert.equal(hiddenTab.stage.children.length, 0, "a background-tab event disposes the scene canvas");
    assert.equal(hiddenTab.pendingFrames.size, 0, "background-tab cleanup cancels the pending RAF");
}

// Explicit cleanup also cancels all owned runtime resources.
{
    const harness = makeHarness();
    const api = createPixelFxSkillEffects(harness.host);
    assert.equal(api.playPoisonExplosion(), true);
    assert.equal(api.clear(), true);
    assert.equal(harness.stage.children.length, 0);
    assert.equal(harness.pendingFrames.size, 0);
    assert.equal(api.clear(), false);
}

console.log("PixelFX skill effect tests passed: pinned dark explosion renders with poison palette, triggers through a transparent scene canvas, completes at 2×, respects reduced motion, and cleans up on hide/clear.");
