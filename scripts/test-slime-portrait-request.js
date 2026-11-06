#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/combat/monsters/manifest.json"), "utf8"));
const spriteTag = html.match(/<img\b[^>]*id="battle-monster-sprite"[^>]*>/i)?.[0];
assert.ok(spriteTag, "the battle monster image element exists");
assert.doesNotMatch(spriteTag, /\bsrc\s*=/i, "the hidden battle scene does not request a default slime image during page startup");
const preloadTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]).join("\n");
assert.doesNotMatch(preloadTags, /monster-slime\.png/i, "the legacy slime variant is not preloaded in HTML");

const resolverBlock = ui.match(/const BATTLE_MONSTER_PORTRAIT_OVERRIDES[\s\S]*?(?=\nfunction applyBattleMonsterLayout)/);
const loaderBlock = ui.match(/function finishBattleMonsterPortraitLoad[\s\S]*?(?=\nconst BATTLE_SCENE_BACKGROUND_PATHS)/);
assert.ok(resolverBlock, "monster portrait resolver is available");
assert.ok(loaderBlock, "portrait load/reuse helpers are available");

let nextTimerId = 0;
const timers = new Map();
const sandbox = {
    setTimeout(callback, delay) {
        const id = ++nextTimerId;
        timers.set(id, { callback, delay });
        return id;
    },
    clearTimeout(id) { timers.delete(id); }
};
vm.createContext(sandbox);
vm.runInContext(`
let battleMonsterPortraitLoadToken = 0;
let battleMonsterPortraitLoadTimer = null;
let battleMonsterPortraitReadyPromise = Promise.resolve(true);
let resolveBattleMonsterPortraitReady = null;
${resolverBlock[0]}
${loaderBlock[0]}
this.getPortraitPath = getBattleMonsterPortraitPath;
this.setPortraitSource = setBattleMonsterPortraitSource;
this.waitPortraitReady = waitForBattleMonsterPortraitReady;
`, sandbox);

function makeImage() {
    let source = "";
    return {
        dataset: {},
        hidden: false,
        naturalWidth: 0,
        srcAssignments: 0,
        onload: null,
        onerror: null,
        get src() { return source; },
        set src(value) { source = value; this.srcAssignments += 1; },
        removeAttribute(name) { if (name === "src") source = ""; },
        decode() { return Promise.resolve(); }
    };
}

(async () => {
    const slimeEntry = manifest.portraits.find((entry) => entry.name.includes("藍色史萊姆"));
    assert.ok(slimeEntry, "the dedicated blue-slime portrait exists in the manifest");
    assert.equal(slimeEntry.path, "assets/combat/monsters/regular-01-blue-slime.png");
    assert.ok(fs.statSync(path.join(root, slimeEntry.path)).size > 0, "the dedicated slime portrait asset is present");

    const firstEncounterPath = sandbox.getPortraitPath({ name: "💧 藍色史萊姆" });
    assert.equal(firstEncounterPath, slimeEntry.path, "the first ordinary blue-slime encounter resolves directly to its dedicated portrait");
    const firstImage = makeImage();
    const firstFallback = { hidden: true };
    sandbox.setPortraitSource(firstImage, firstFallback, null, firstEncounterPath);
    assert.equal(firstImage.srcAssignments, 1, "the first encounter starts only the dedicated portrait request");
    assert.equal(firstImage.src, slimeEntry.path);
    firstImage.naturalWidth = 2304;
    const firstReady = sandbox.waitPortraitReady();
    firstImage.onload();
    assert.equal(await firstReady, true, "the dedicated portrait decodes and becomes ready");
    assert.equal(firstFallback.hidden, true, "the fallback hides after the dedicated portrait is ready");

    sandbox.setPortraitSource(firstImage, firstFallback, null, firstEncounterPath);
    assert.equal(firstImage.srcAssignments, 1, "subsequent UI updates reuse the already-ready same-path portrait without another request");
    assert.equal(firstImage.hidden, false);

    const legacySlimePath = sandbox.getPortraitPath({ name: "深淵史萊姆變異體" });
    assert.equal(legacySlimePath, "assets/combat/monster-slime.png", "unmapped slime variants retain the existing legacy image fallback");
    assert.ok(fs.statSync(path.join(root, legacySlimePath)).size > 0, "the legacy slime fallback asset remains available");
    const legacyImage = makeImage();
    sandbox.setPortraitSource(legacyImage, { hidden: true }, null, legacySlimePath);
    assert.equal(legacyImage.srcAssignments, 1, "the legacy image is requested only when an unmapped slime variant actually appears");

    const unknownImage = makeImage();
    const unknownFallback = { hidden: true };
    assert.equal(sandbox.getPortraitPath({ name: "古代齒輪獸" }), "", "unmapped non-legacy monsters use the icon fallback instead of a random slime image");
    sandbox.setPortraitSource(unknownImage, unknownFallback, null, "");
    assert.equal(unknownImage.srcAssignments, 0, "emoji fallback does not request an unrelated image");
    assert.equal(unknownImage.hidden, true);
    assert.equal(unknownFallback.hidden, false);

    console.log("Slime portrait request tests passed: no HTML startup request, dedicated first-encounter portrait, same-path reuse, legacy variant fallback, and icon fallback.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
