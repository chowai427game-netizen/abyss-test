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
    let source = "";
    return {
        dataset: {},
        hidden: false,
        complete: false,
        naturalWidth: 0,
        srcAssignments: 0,
        get src() { return source; },
        set src(value) { source = value; this.srcAssignments += 1; },
        removeAttribute(name) { if (name === "src") source = ""; },
        decodeCalls: 0,
        decode() {
            this.decodeCalls += 1;
            return new Promise((resolve, reject) => {
                this.resolveDecode = resolve;
                this.rejectDecode = reject;
            });
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
    assert.equal(lateEventImage.dataset.loadAttempts, "2", "a failed path receives only one bounded retry");
    runTimeoutForCurrentRequest();
    assert.equal(lateEventImage.dataset.loadState, "error", "a failed retry leaves the stable fallback state");
    assert.equal(lateEventFallback.hidden, false);

    const lateDecodeImage = createImage();
    const lateDecodeFallback = { hidden: true };
    const lateDecodeStatus = { hidden: true, textContent: "" };
    sandbox.setPortraitSource(lateDecodeImage, lateDecodeFallback, lateDecodeStatus, "regular-late-decode.png");
    const lateDecodeReady = sandbox.waitPortraitReady();
    const originalLoadHandler = lateDecodeImage.onload;
    lateDecodeImage.complete = true;
    lateDecodeImage.naturalWidth = 2304;
    originalLoadHandler();
    await Promise.resolve();
    assert.equal(lateDecodeImage.decodeCalls, 1, "load begins image decoding before the watchdog fires");

    runTimeoutForCurrentRequest();
    assert.equal(await lateDecodeReady, false, "decode still pending at timeout resolves to fallback");
    lateDecodeImage.resolveDecode();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(lateDecodeImage.dataset.loadState, "error", "late decode completion cannot overwrite timeout state");
    assert.equal(lateDecodeImage.hidden, true, "late decode completion cannot reveal the portrait");
    assert.equal(lateDecodeFallback.hidden, false, "fallback remains visible after late decode completion");

    const retryImage = createImage();
    const retryFallback = { hidden: true };
    const retryStatus = { hidden: true, textContent: "" };
    retryImage.decode = function () {
        this.decodeCalls += 1;
        return this.decodeCalls === 1 ? Promise.reject(new Error("simulated decode rejection")) : Promise.resolve();
    };
    sandbox.setPortraitSource(retryImage, retryFallback, retryStatus, "regular-decode-retry.png");
    const firstDecodeReady = sandbox.waitPortraitReady();
    retryImage.complete = true;
    retryImage.naturalWidth = 2304;
    retryImage.onload();
    assert.equal(await firstDecodeReady, false, "decode rejection resolves the first request as failed, not ready");
    assert.equal(retryImage.dataset.loadState, "error");
    assert.equal(retryImage.hidden, true);
    assert.equal(retryFallback.hidden, false);

    sandbox.setPortraitSource(retryImage, retryFallback, retryStatus, "regular-decode-retry.png");
    assert.equal(retryImage.dataset.loadState, "loading", "a same-path failure is retried once");
    assert.equal(retryImage.dataset.loadAttempts, "2");
    assert.equal(retryImage.srcAssignments, 2);
    const successfulRetryReady = sandbox.waitPortraitReady();
    retryImage.onload();
    assert.equal(await successfulRetryReady, true, "a successful decode on the bounded retry marks the portrait ready");
    assert.equal(retryImage.dataset.loadState, "ready");
    assert.equal(retryImage.hidden, false);
    assert.equal(retryFallback.hidden, true);

    const exhaustedImage = createImage();
    const exhaustedFallback = { hidden: true };
    const exhaustedStatus = { hidden: true, textContent: "" };
    sandbox.setPortraitSource(exhaustedImage, exhaustedFallback, exhaustedStatus, "regular-load-exhausted.png");
    let exhaustedReady = sandbox.waitPortraitReady();
    exhaustedImage.onerror();
    assert.equal(await exhaustedReady, false);
    sandbox.setPortraitSource(exhaustedImage, exhaustedFallback, exhaustedStatus, "regular-load-exhausted.png");
    assert.equal(exhaustedImage.dataset.loadAttempts, "2");
    exhaustedReady = sandbox.waitPortraitReady();
    exhaustedImage.onerror();
    assert.equal(await exhaustedReady, false);
    sandbox.setPortraitSource(exhaustedImage, exhaustedFallback, exhaustedStatus, "regular-load-exhausted.png");
    assert.equal(exhaustedImage.dataset.loadAttempts, "2", "a repeatedly failing path is not retried indefinitely");
    assert.equal(exhaustedImage.srcAssignments, 2);
    assert.equal(exhaustedImage.hidden, true);
    assert.equal(exhaustedFallback.hidden, false);

    console.log("✅ Monster portrait timeout, late load/decode, bounded same-path retry, decode rejection, and stable fallback regression tests passed.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
