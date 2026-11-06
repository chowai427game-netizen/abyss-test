#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(root, "css/12-combat-scene.css");
const browserCandidates = [
    process.env.CHROMIUM_BIN,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable"
].filter(Boolean);
const chromium = browserCandidates.find((candidate) => {
    try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
});

if (!chromium) {
    console.log("SKIP monster lift layout tests: Chromium was not found (set CHROMIUM_BIN to enable real-browser layout checks).");
    process.exit(0);
}

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${pathToFileURL(cssPath).href}">
<style>
    html, body { margin: 0; min-height: 100%; background: #09090e; }
    body { display: grid; place-items: center; min-height: 100vh; }
    #battle-scene-box {
        width: min(600px, calc(100vw - 20px)); height: 360px; min-height: 0;
        margin: 0; padding: 0; border: 0; overflow: hidden;
        --battle-monster-desktop-height: 168px;
        --battle-monster-mobile-height: 142px;
        --battle-monster-desktop-lift: 13px;
        --battle-monster-mobile-lift: 7px;
        --battle-monster-vfx-lift: 9px;
        --battle-monster-mobile-vfx-lift: 5px;
    }
</style>
</head>
<body>
<section id="battle-scene-box" class="battle-scene" aria-label="layout test">
    <div class="battle-stage">
        <div id="platform" class="battle-sprite-platform"></div>
        <img id="monster" class="battle-sprite" alt="test monster" style="width:120px">
        <span id="fallback" class="battle-monster-fallback">👾</span>
        <span id="anchor" class="battle-monster-vfx-anchor"></span>
        <canvas id="skill-effect" class="battle-pixelfx-skill-effect"></canvas>
    </div>
    <div id="hud" class="battle-hud"></div>
</section>
<pre id="test-result">PENDING</pre>
<script>
(() => {
    const checks = [];
    const near = (actual, expected, label) => {
        const difference = Math.abs(actual - expected);
        if (difference > 1.1) throw new Error(label + ": expected " + expected + "px, got " + actual.toFixed(2) + "px");
        checks.push(label + "=" + actual.toFixed(2) + "px");
    };
    try {
        const scene = document.getElementById("battle-scene-box");
        const stage = scene.querySelector(".battle-stage");
        const stageBottom = stage.getBoundingClientRect().bottom;
        const platform = document.getElementById("platform").getBoundingClientRect();
        const sprite = document.getElementById("monster").getBoundingClientRect();
        const fallback = document.getElementById("fallback").getBoundingClientRect();
        const anchor = document.getElementById("anchor").getBoundingClientRect();
        const mobile = matchMedia("(max-width: 600px)").matches;
        const globalLift = 70;
        const monsterLift = mobile ? 7 : 13;
        const vfxLift = mobile ? 5 : 9;
        const platformGap = stageBottom - platform.bottom;
        near((stageBottom - sprite.bottom) - platformGap, globalLift + monsterLift + 2, "monster global lift plus individual lift");
        near((stageBottom - fallback.bottom) - platformGap, globalLift + 12, "fallback icon global lift");
        near((stageBottom - anchor.bottom) - platformGap, globalLift + vfxLift + 2, "hit VFX anchor global and individual lift");
        if (getComputedStyle(scene).getPropertyValue("--battle-monster-global-lift").trim() !== "70px") throw new Error("shared CSS lift is not 70px");
        checks.push("viewport=" + (mobile ? "mobile" : "desktop"));

        const effect = document.getElementById("skill-effect");
        const effectStyle = getComputedStyle(effect);
        if (effectStyle.imageRendering !== "pixelated") throw new Error("skill effect canvas lost pixelated rendering");
        if (effectStyle.pointerEvents !== "none") throw new Error("skill effect canvas can intercept player input");
        if (Number(effectStyle.zIndex) !== 5) throw new Error("skill effect canvas is not on the expected scene-local layer");
        if (Number(getComputedStyle(document.getElementById("monster")).zIndex) !== 2) throw new Error("monster layer changed unexpectedly");
        if (Number(getComputedStyle(document.getElementById("anchor")).zIndex) !== 3) throw new Error("hit VFX anchor layer changed unexpectedly");
        checks.push("canvas=pixelated/pointer-transparent/z5; sprite=z2; anchor=z3");
        document.body.dataset.testResult = "PASS";
        document.getElementById("test-result").textContent = "PASS " + checks.join(" | ");
    } catch (error) {
        document.body.dataset.testResult = "FAIL";
        document.getElementById("test-result").textContent = "FAIL " + error.stack;
    }
})();
</script>
</body>
</html>`;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "abyss-monster-layout-"));
const htmlPath = path.join(tempDir, "layout-test.html");
fs.writeFileSync(htmlPath, html);

function runViewport(name, width, height, expectMobile) {
    const result = spawnSync(chromium, [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--allow-file-access-from-files",
        "--hide-scrollbars",
        "--dump-dom",
        `--window-size=${width},${height}`,
        "--virtual-time-budget=1500",
        pathToFileURL(htmlPath).href
    ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });

    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${name} Chromium exited successfully: ${result.stderr}`);
    const marker = result.stdout.match(/<pre id="test-result">([\s\S]*?)<\/pre>/);
    assert.ok(marker, `${name} browser fixture returned a result`);
    assert.match(marker[1], /^PASS /, `${name} real-browser layout checks pass: ${marker[1]}`);
    assert.match(marker[1], new RegExp(`viewport=${expectMobile ? "mobile" : "desktop"}`), `${name} uses the expected CSS media query`);
    console.log(`${name}: ${marker[1]}`);
}

try {
    runViewport("Desktop", 1280, 900, false);
    runViewport("Mobile", 390, 844, true);
    console.log("Monster lift and VFX layout tests passed in Chromium at desktop and mobile viewports.");
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
