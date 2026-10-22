#!/usr/bin/env node
/*
 * 安全重構第一階段：零依賴靜態檢查
 * 檢查 CSS 檔案、schema helper、index.html 載入順序與關鍵 window API 匯出字串。
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const requiredFiles = [
    "css/01-legacy.css",
    "css/00-tokens.css",
    "css/04-components.css",
    "css/10-responsive.css",
    "css/11-accessibility.css",
    "css/12-combat-scene.css",
    "css/14-mobile-shell.css",
    "data/jobdata.js",
    "data/itemdata.js",
    "data/monsterdata.js",
    "data/environmentdata.js",
    "data/eventdata.js",
    "data/data-schema.js",
    "index.html",
    "js/vfx.js",
    "js/game.js"
];

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

requiredFiles.forEach((relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath);
    assert(fs.existsSync(absolutePath), `Missing required file: ${relativePath}`);
});

const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const gameJs = fs.readFileSync(path.join(repoRoot, "js/game.js"), "utf8");
const vfxJs = fs.readFileSync(path.join(repoRoot, "js/vfx.js"), "utf8");

const orderedIndexSnippets = [
    'href="css/01-legacy.css"',
    'href="css/00-tokens.css"',
    'href="css/04-components.css"',
    'href="css/10-responsive.css"',
    'href="css/11-accessibility.css"',
    'href="css/12-combat-scene.css"',
    'href="css/14-mobile-shell.css"',
    'src="data/jobdata.js"',
    'src="data/itemdata.js"',
    'src="data/monsterdata.js"',
    'src="data/environmentdata.js"',
    'src="data/eventdata.js"',
    'src="data/data-schema.js"',
    'src="js/vfx.js"',
    'src="js/statengine.js"',
    'src="js/state.js"',
    'src="js/ui.js"',
    'src="js/game.js"',
    'src="js/browser-compat.js"'
];

let previousPosition = -1;
orderedIndexSnippets.forEach((snippet) => {
    const position = indexHtml.indexOf(snippet);
    assert(position !== -1, `index.html is missing expected reference: ${snippet}`);
    assert(position > previousPosition, `index.html load order is incorrect near: ${snippet}`);
    previousPosition = position;
});

const assetReferences = [...indexHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/gi)]
    .map((match) => match[1])
    .filter((reference) => !/^https?:\/\//i.test(reference) && !/^data:/i.test(reference));
assetReferences.forEach((reference) => {
    assert(!reference.startsWith("/"), `GitHub Pages assets must use relative paths: ${reference}`);
    const localPath = reference.split(/[?#]/, 1)[0];
    assert(fs.existsSync(path.join(repoRoot, localPath)), `Missing local asset referenced by index.html: ${reference}`);
});

const scriptTags = [...indexHtml.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/gi)];
const localScriptTags = scriptTags.filter(([, source]) => !/^https?:\/\//i.test(source));
assert(localScriptTags.every(([tag]) => /\bdefer\b/i.test(tag)), "All local scripts must defer to preserve ordered initialization after HTML parsing.");
const socketScriptIndex = scriptTags.findIndex(([, source]) => source.includes("cdn.socket.io"));
const uiScriptIndex = scriptTags.findIndex(([, source]) => source === "js/ui.js");
assert(socketScriptIndex >= 0 && uiScriptIndex > socketScriptIndex, "Socket.IO must appear before UI initialization.");

assert(!/onsubmit\s*=/.test(indexHtml), "index.html should not use inline onsubmit.");

[
    "window.handleStartGame = handleStartGame;",
    "window.renderInitialJobModal = renderInitialJobModal;",
    "window.selectInitialJob = selectInitialJob;",
    "window.enterGameMainShell = enterGameMainShell;",
    "window.startNextFloor = startNextFloor;",
    "window.rerunCurrentFloor = rerunCurrentFloor;",
    "window.returnToVillage = returnToVillage;",
    "window.handleMainAction = handleMainAction;",
    "window.handleRerunAction = handleRerunAction;",
    "window.handleSecondaryAction = handleSecondaryAction;",
    "window.selectRouteNode = selectRouteNode;"
].forEach((snippet) => {
    assert(gameJs.includes(snippet), `game.js is missing expected window API export: ${snippet}`);
});

assert(vfxJs.includes("global.spawnVfx = spawnVfx;"), "vfx.js is missing the legacy window.spawnVfx API.");

console.log("✅ Refactor baseline checks passed.");
