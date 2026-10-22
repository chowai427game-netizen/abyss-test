#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const indexHtml = read("index.html");
const uiJs = read("js/ui.js");
const mobileCss = read("css/14-mobile-shell.css");

[
    "mobile-bottom-hud",
    "mobile-latest-log",
    "mobile-hud-action-slot",
    "mobile-drawer-scrim",
    "mobile-shell-drawer",
    "mobile-character-drawer",
    "mobile-log-drawer"
].forEach((id) => {
    assert(indexHtml.includes(`id=\"${id}\"`), `index.html is missing mobile shell element: ${id}`);
});

assert(indexHtml.includes('href="css/14-mobile-shell.css"'), "index.html must load the mobile shell stylesheet");
assert(indexHtml.indexOf('href="css/14-mobile-shell.css"') > indexHtml.indexOf('href="css/12-combat-scene.css"'), "mobile shell stylesheet must load after existing responsive and combat styles");

[
    "function initMobileShell()",
    "function syncMobileShellPlacement()",
    "function syncMobileShellUI()",
    "function openMobileDrawer(",
    "function closeMobileDrawer(",
    "function syncMobileLatestLog(",
    "moveMobileShellElement('status', 'status-panel-box', 'mobile-character-drawer')",
    "moveMobileShellElement('action', 'action-panel-box', 'mobile-hud-action-slot')",
    "moveMobileShellElement('log', 'log-wrapper-box', 'mobile-log-drawer')",
    "syncMobileLatestLog(diaryText);"
].forEach((snippet) => {
    assert(uiJs.includes(snippet), `ui.js is missing mobile shell integration: ${snippet}`);
});

assert(uiJs.includes('MOBILE_SHELL_MEDIA_QUERY = "(max-width: 640px)"'), "mobile shell must stay scoped to <=640px");
assert(uiJs.includes('restoreMobileShellElement(\'status\', \'status-panel-box\')'), "desktop restore for status panel is required");
assert(uiJs.includes('restoreMobileShellElement(\'action\', \'action-panel-box\')'), "desktop restore for action panel is required");
assert(uiJs.includes('restoreMobileShellElement(\'log\', \'log-wrapper-box\')'), "desktop restore for log panel is required");

assert(mobileCss.includes('@media screen and (max-width: 640px)'), "mobile shell CSS must be isolated to the mobile breakpoint");
assert(mobileCss.includes('env(safe-area-inset-bottom, 0px)'), "mobile shell must reserve iPhone safe-area space");
assert(mobileCss.includes('max-height: calc(100dvh'), "mobile drawer must account for mobile browser viewport height");
assert(mobileCss.includes('#mobile-hud-action-slot #action-panel-box'), "mobile HUD must scope action-panel overrides to its portal");
assert(mobileCss.includes('body.mobile-shell-active .left-layout-column'), "mobile mode must hide the empty source column only when active");

console.log("✅ Mobile HUD, drawer portals, desktop restoration, and mobile-only CSS guards passed.");
