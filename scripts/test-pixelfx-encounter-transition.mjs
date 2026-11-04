#!/usr/bin/env node
import assert from "node:assert/strict";
import {
    createBattleEncounterTransition,
    ENCOUNTER_SHATTER_COVER_TIME,
    ENCOUNTER_SHATTER_BURST_TIME,
    ENCOUNTER_SHATTER_OPTIONS,
    SMOKE_PALETTE
} from "../js/pixelfx-encounter-transition.js";

const expectedSmoke = ["#0e0c12", "#1d1a22", "#2e2a35", "#433e4b", "#5c5664", "#7b7484", "#a39cab"];
assert.equal(ENCOUNTER_SHATTER_OPTIONS.speed, 0.5, "the encounter wipe uses the requested half-speed playback");
assert.equal(ENCOUNTER_SHATTER_OPTIONS.palette, "smoke", "the encounter wipe selects the Smoke palette");
assert.deepEqual(Array.from(SMOKE_PALETTE), expectedSmoke, "the bridge uses PixelFX's exact Smoke palette colors");
assert.equal(ENCOUNTER_SHATTER_COVER_TIME, 0.55, "the reveal gate matches the upstream full-pane landing point");
assert.equal(ENCOUNTER_SHATTER_BURST_TIME, 1.62, "the combat gate matches the upstream pane BREAK point");

let nextRafId = 0;
let now = 0;
const pendingFrames = new Map();
const canvasInstances = [];
let imageDataWrites = 0;
let lastOpaquePixels = 0;

const fakeDocument = {
    visibilityState: "visible",
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
                    createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
                    putImageData(image, x, y) {
                        assert.equal(image.width, 320);
                        assert.equal(image.height, 180);
                        assert.equal(x, 0);
                        assert.equal(y, 0);
                        imageDataWrites += 1;
                        lastOpaquePixels = 0;
                        for (let alphaIndex = 3; alphaIndex < image.data.length; alphaIndex += 4) {
                            if (image.data[alphaIndex] === 255) lastOpaquePixels += 1;
                        }
                    }
                };
            },
            remove() {
                if (!this.parentNode) return;
                const index = this.parentNode.children.indexOf(this);
                if (index >= 0) this.parentNode.children.splice(index, 1);
                this.parentNode = null;
            }
        };
        canvasInstances.push(canvas);
        return canvas;
    }
};

globalThis.document = fakeDocument;
globalThis.requestAnimationFrame = (callback) => {
    const id = ++nextRafId;
    pendingFrames.set(id, callback);
    return id;
};
globalThis.cancelAnimationFrame = (id) => pendingFrames.delete(id);

const container = {
    children: [],
    appendChild(element) {
        this.children.push(element);
        element.parentNode = this;
        return element;
    }
};

function stepFrame(milliseconds = 1000 / 30) {
    now += milliseconds;
    const current = [...pendingFrames.values()];
    pendingFrames.clear();
    current.forEach((callback) => callback(now));
}

const coveredTimes = [];
const coveredOpaquePixels = [];
const burstTimes = [];
const transition = createBattleEncounterTransition({
    container,
    onCovered: () => {
        coveredTimes.push(now);
        coveredOpaquePixels.push(lastOpaquePixels);
        assert.equal(container.children[0]?.attributes["data-pixelfx-transition"], "shatter-wipe");
    },
    onBurst: () => {
        burstTimes.push(now);
        assert.equal(coveredTimes.length, 1, "the burst cannot begin before the pane has fully covered the scene");
        assert.equal(container.children[0]?.attributes["data-pixelfx-transition"], "shatter-wipe");
    }
});
assert.ok(transition, "a transition is created when canvas and RAF are available");
assert.equal(transition.element.width, 320);
assert.equal(transition.element.height, 180);
assert.equal(transition.element.attributes["data-pixelfx-palette"], "smoke");
assert.equal(container.children.length, 1, "the canvas attaches to the battle scene container");
assert.equal(transition.start(), true, "the transition starts once");
assert.equal(transition.start(), false, "the transition cannot be started twice");

let guard = 0;
while (container.children.length && guard < 240) {
    stepFrame();
    guard += 1;
}
const completed = await transition.finished;
assert.equal(completed, true, "the full Shatter Wipe completes");
assert.equal(coveredTimes.length, 1, "the monster reveal callback fires exactly once");
assert.equal(coveredOpaquePixels[0], 320 * 180, "the reveal callback runs only after every screen pixel is opaque");
assert.ok(coveredTimes[0] >= 1800 && coveredTimes[0] <= 2400, `fully opaque pane callback occurs after landing and bounce (got ${coveredTimes[0]} ms)`);
assert.equal(burstTimes.length, 1, "the battle-start burst callback fires exactly once");
assert.ok(burstTimes[0] > coveredTimes[0], "the combat callback follows the full-cover callback");
assert.ok(burstTimes[0] >= 3100 && burstTimes[0] <= 3500, `the burst callback follows the 1.62 s upstream break point at 0.5× (got ${burstTimes[0]} ms)`);
assert.ok(burstTimes[0] < now, "the combat callback fires before the remaining shards finish clearing");
assert.ok(now >= 5500 && now <= 6100, `0.5× playback lasts about 5.6 s (got ${now} ms)`);
assert.ok(imageDataWrites >= 100, "the animation renders multiple canvas frames");
assert.equal(container.children.length, 0, "the canvas is removed after completion");
assert.equal(pendingFrames.size, 0, "no animation frame is left scheduled after completion");

fakeDocument.visibilityState = "hidden";
let hiddenBurstCount = 0;
const backgroundTransition = createBattleEncounterTransition({ container, onBurst: () => { hiddenBurstCount += 1; } });
assert.ok(backgroundTransition, "a transition can be created before the tab becomes hidden");
assert.equal(backgroundTransition.start(), true);
stepFrame();
assert.equal(await backgroundTransition.finished, false, "a hidden tab cancels cleanly rather than holding the encounter gate");
assert.equal(hiddenBurstCount, 0, "a canceled hidden-tab transition never signals battle start");
assert.equal(container.children.length, 0, "hidden-tab cancellation removes its canvas");
assert.equal(pendingFrames.size, 0, "hidden-tab cancellation clears the scheduled frame");

assert.equal(createBattleEncounterTransition({}), null, "invalid containers fail closed without creating a transition");
console.log("PixelFX encounter Shatter Wipe tests passed: 0.5× Smoke palette, opaque cover, burst-time battle gate, 5.6 s completion, cleanup, and hidden-tab cancellation.");
