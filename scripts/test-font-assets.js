const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fontCss = fs.readFileSync(path.join(root, "css/15-fonts.css"), "utf8");
const legacyCss = fs.readFileSync(path.join(root, "css/01-legacy.css"), "utf8");
const componentCss = fs.readFileSync(path.join(root, "css/04-components.css"), "utf8");
const combatCss = fs.readFileSync(path.join(root, "css/12-combat-scene.css"), "utf8");
const fontPath = path.join(root, "assets/fonts/Cubic_11.woff2");
const licensePath = path.join(root, "assets/fonts/OFL-Cubic-11.txt");
const fontBytes = fs.readFileSync(fontPath);
const license = fs.readFileSync(licensePath, "utf8");

assert.equal(fontBytes.toString("ascii", 0, 4), "wOF2", "the bundled asset is a WOFF2 font");
assert.ok(fontBytes.length > 0 && fontBytes.length < 500_000, "the web font stays below 500 KB");
assert.match(html, /rel="preload" href="assets\/fonts\/Cubic_11\.woff2" as="font" type="font\/woff2" crossorigin/);
assert.ok(
    html.indexOf('href="css/15-fonts.css"') > html.indexOf('href="css/14-mobile-shell.css"'),
    "font overrides load after the existing stylesheets"
);
assert.match(fontCss, /font-family:\s*"Cubic 11"/);
assert.match(fontCss, /url\("\.\.\/assets\/fonts\/Cubic_11\.woff2"\) format\("woff2"\)/);
assert.match(fontCss, /font-display:\s*swap/);
assert.match(fontCss, /--font-damage:\s*var\(--font-game\)/);
assert.match(fontCss, /body,[\s\S]*button,[\s\S]*input,[\s\S]*select,[\s\S]*textarea/);
assert.match(componentCss, /font:\s*700 clamp\(12px, 3vw, 16px\)\/1\.2 var\(--font-game\)/);
assert.doesNotMatch(combatCss, /font:\s*[^;]*\bmonospace\s*;/, "combat scene text uses the chosen game font");
assert.doesNotMatch(legacyCss, /fonts\.googleapis\.com/, "unused external Google Fonts imports are removed");
assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
assert.match(license, /\[Cubic 11\]/);

console.log("Cubic 11 WOFF2, local loading, game typography, and OFL license checks passed.");
