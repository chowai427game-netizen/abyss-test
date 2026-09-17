#!/usr/bin/env node
/*
 * 安全重構第一階段：零依賴靜態檢查
 * 檢查 CSS 檔案、schema helper、index.html 載入順序與關鍵 window API 匯出字串。
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const requiredFiles = [
    "css/00-tokens.css",
    "css/04-components.css",
    "css/10-responsive.css",
    "css/11-accessibility.css",
    "data/data-schema.js",
    "index.html",
    "game.js"
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
const gameJs = fs.readFileSync(path.join(repoRoot, "game.js"), "utf8");

const orderedIndexSnippets = [
    'href="style.css"',
    'href="css/00-tokens.css"',
    'href="css/04-components.css"',
    'href="css/10-responsive.css"',
    'href="css/11-accessibility.css"',
    'src="jobdata.js"',
    'src="itemdata.js"',
    'src="monsterdata.js"',
    'src="environmentdata.js"',
    'src="eventdata.js"',
    'src="data/data-schema.js"',
    'src="statengine.js"',
    'src="state.js"',
    'src="ui.js"',
    'src="game.js"',
    'src="browser-compat.js"'
];

let previousPosition = -1;
orderedIndexSnippets.forEach((snippet) => {
    const position = indexHtml.indexOf(snippet);
    assert(position !== -1, `index.html is missing expected reference: ${snippet}`);
    assert(position > previousPosition, `index.html load order is incorrect near: ${snippet}`);
    previousPosition = position;
});

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

console.log("✅ Refactor baseline checks passed.");
