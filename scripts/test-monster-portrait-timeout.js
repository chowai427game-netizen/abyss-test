#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
const portraitLoader = ui.match(/function finishBattleMonsterPortraitLoad[\s\S]*?(?=\nfunction updateBattleScene)/);
assert.ok(portraitLoader, "portrait load, timeout, and readiness helpers exist");

let nextTimerId = 0;
const timers = new Map();
const sandbox = {
    setTimeout(callback, delay) {
        const id = ++nextTimerId;
        timers.set(id, { callback, delay });
        return id;
    },
    clearTimeout(id) {
        timers.delete(id);
    }
};
vm.createContext(sandbox);
vm.runInContext(`
let battleMonsterPortraitLoadToken = 0;
let battleMonsterPortraitLoadTimer = null;
let battleMonsterPortraitReadyPromise = Promise.resolve(true);
let resolveBattleMonsterPortraitReady = null;
${portraitLoader[0]}
this.setPortraitSource = setBattleMonsterPortraitSource;
this.waitPortraitReady = waitForBattleMonsterPortraitReady;
this.getLoadToken = () => battleMonsterPortraitLoadToken;
`, sandbox);

function createImage() {
    return {
        dataset: {},
        hidden: false,
        complete: false,
        naturalWidth: 0,
        src: "",
        decodeCalls: 0,
        decode() {
            this.decodeCalls += 1;
            return new Promise((resolve) => { this.resolveDecode = resolve; });
        }
    };
}

function runTimeoutForCurrentRequest() {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === 4000);
    assert.ok(entry, "portrait request has the four-second fallback watchdog");
    entry[1].callback();
}

(async () => {
    const lateEventImage = createImage();
    const lateEventFallback = { hidden: true };
    const lateEventStatus = { hidden: true, textContent: "" };
    sandbox.setPortraitSource(lateEventImage, lateEventFallback, lateEventStatus, "regular-late-event.png");
    const lateEventReady = sandbox.waitPortraitReady();
    const staleLoadHandler = lateEventImage.onload;
    const initialToken = sandbox.getLoadToken();

    runTimeoutForCurrentRequest();
    assert.equal(await lateEventReady, false, "a timed-out portrait releases the encounter gate as failed");
    assert.equal(lateEventImage.dataset.loadState, "error");
    assert.equal(lateEventImage.hidden, true, "the portrait remains hidden after timeout");
    assert.equal(lateEventFallback.hidden, false, "the fallback remains visible after timeout");
    assert.equal(lateEventImage.onload, null, "timeout detaches the image load handler");
    assert.equal(lateEventImage.onerror, null, "timeout detaches the image error handler");
    assert.ok(sandbox.getLoadToken() > initialToken, "timeout invalidates callbacks from that request");

    lateEventImage.complete = true;
    lateEventImage.naturalWidth = 2304;
    staleLoadHandler();
    assert.equal(lateEventImage.decodeCalls, 0, "a queued stale load handler cannot begin decoding after timeout");
    sandbox.setPortraitSource(lateEventImage, lateEventFallback, lateEventStatus, "regular-late-event.png");
    assert.equal(lateEventImage.hidden, true, "same-path UI updates do not reveal a late completed image");
    assert.equal(lateEventFallback.hidden, false, "same-path UI updates keep the fallback visible");

    const lateDecodeImage = createImage();
    const lateDecodeFallback = { hidden: true };
    const lateDecodeStatus = { hidden: true, textContent: "" };
    sandbox.setPortraitSource(lateDecodeImage, lateDecodeFallback, lateDecodeStatus, "regular-late-decode.png");
    const lateDecodeReady = sandbox.waitPortraitReady();
    const originalLoadHandler = lateDecodeImage.onload;
    lateDecodeImage.complete = true;
    lateDecodeImage.naturalWidth = 2304;
    originalLoadHandler();
    assert.equal(lateDecodeImage.decodeCalls, 1, "load begins image decoding before the watchdog fires");

    runTimeoutForCurrentRequest();
    assert.equal(await lateDecodeReady, false, "decode still pending at timeout resolves to fallback");
    lateDecodeImage.resolveDecode();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(lateDecodeImage.dataset.loadState, "error", "late decode completion cannot overwrite timeout state");
    assert.equal(lateDecodeImage.hidden, true, "late decode completion cannot reveal the portrait");
    assert.equal(lateDecodeFallback.hidden, false, "fallback remains visible after late decode completion");

    console.log("✅ Monster portrait timeout, late load/decode, and stable fallback regression tests passed.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
