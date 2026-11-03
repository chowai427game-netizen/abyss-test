import assert from "node:assert/strict";

const rafCallbacks = new Map();
let nextRafId = 1;
class FakeCanvas {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.className = "";
        this.attributes = new Map();
        this.style = {};
        this.parentNode = null;
        this.lastImage = null;
        this.context = {
            createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
            putImageData: (image) => { this.lastImage = image; }
        };
    }
    getContext(type) { return type === "2d" ? this.context : null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
        this.parentNode = null;
    }
}

const document = {
    visibilityState: "visible",
    createElement(name) {
        assert.equal(name, "canvas");
        return new FakeCanvas();
    }
};
const parent = {
    children: [],
    appendChild(node) {
        node.parentNode = this;
        this.children.push(node);
        return node;
    }
};
globalThis.document = document;
globalThis.window = globalThis;
globalThis.innerWidth = 360;
globalThis.innerHeight = 640;
globalThis.requestAnimationFrame = (callback) => {
    const id = nextRafId++;
    rafCallbacks.set(id, callback);
    return id;
};
globalThis.cancelAnimationFrame = (id) => rafCallbacks.delete(id);

const bridge = await import("../js/pixelfx-combat-number-bridge.js");

function tick(timestamp) {
    const callbacks = [...rafCallbacks.values()];
    rafCallbacks.clear();
    for (const callback of callbacks) callback(timestamp);
}
function hasVisiblePixels(canvas) {
    const data = canvas.lastImage?.data;
    if (!data) return false;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
    return false;
}

assert.equal(bridge.normalizeDamageText("-120 ×6 HP"), "-120");
assert.equal(bridge.normalizeDamageText(" 305 HP"), "-305");
assert.equal(bridge.normalizeDamageText("MISS"), "");

const damage = bridge.create({ kind: "damage", text: "-120 ×6 HP", x: 2, y: 4, seed: 17 });
assert.ok(damage, "damage effect should create a Canvas controller");
assert.equal(damage.element.getAttribute("data-pixelfx-text"), "-120");
assert.equal(damage.element.getAttribute("data-pixelfx-kind"), "damage");
assert.ok(Number.parseFloat(damage.element.style.left) >= 0, "left edge is clamped within the viewport");
assert.ok(Number.parseFloat(damage.element.style.top) >= 0, "top edge is clamped within the viewport");
parent.appendChild(damage.element);
let damageCompleted = 0;
assert.equal(damage.start(() => damageCompleted++), true);
tick(0);
assert.ok(hasVisiblePixels(damage.element), "damage effect draws non-transparent PixelFX pixels");
const damagePixels = damage.element.lastImage.data.slice();
const alternateDamage = bridge.create({ kind: "damage", text: "-999 HP", x: 180, y: 320, seed: 17 });
parent.appendChild(alternateDamage.element);
alternateDamage.start();
tick(0);
assert.ok(alternateDamage.element.lastImage.data.some((channel, index) => channel !== damagePixels[index]), "the rendered glyph pixels change with the actual damage value");
alternateDamage.destroy();
for (let ms = 34; ms <= 1190 && damageCompleted === 0; ms += 34) tick(ms);
assert.equal(damageCompleted, 1, "damage animation completes and calls back exactly once");
assert.equal(parent.children.length, 0, "completed Canvas is removed");

const critical = bridge.create({ kind: "crit", text: "-98765 HP", x: 350, y: 636, seed: 21 });
assert.ok(critical, "critical effect should create a Canvas controller");
assert.equal(critical.element.getAttribute("data-pixelfx-text"), "-98765");
assert.ok(critical.element.width >= 152, "long damage values receive enough horizontal canvas space");
assert.ok(Number.parseFloat(critical.element.style.left) + Number.parseFloat(critical.element.style.width) <= 360.01, "right edge is clamped within the viewport");
parent.appendChild(critical.element);
let criticalCompleted = 0;
critical.start(() => criticalCompleted++);
tick(0);
assert.ok(hasVisiblePixels(critical.element), "critical effect draws non-transparent pixels");
for (let ms = 34; ms <= 1700 && criticalCompleted === 0; ms += 34) tick(ms);
assert.equal(criticalCompleted, 1, "critical animation completes after its longer duration");
assert.equal(parent.children.length, 0);

const cancelled = bridge.create({ kind: "damage", text: "-9", x: 180, y: 320 });
parent.appendChild(cancelled.element);
assert.equal(cancelled.start(() => assert.fail("cancelled renderer must not complete")), true);
assert.equal(rafCallbacks.size, 1);
cancelled.destroy();
assert.equal(rafCallbacks.size, 0, "destroy cancels the pending animation frame");
assert.equal(parent.children.length, 0, "destroy removes the active canvas");

delete globalThis.PixelFxCombatNumbers;
console.log("PixelFX damage/crit renderer tests passed (dynamic values, alpha drawing, bounds, completion, cleanup).");
