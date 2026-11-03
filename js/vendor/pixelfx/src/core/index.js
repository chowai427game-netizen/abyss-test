// Minimal barrel for PixelFX UI damage and critical-number effects.
// Upstream source: patch-gg/pixelfx v0.3.0; see ../../LICENSE and ../../NOTICE.md.
export { Rng, TAU, clamp, ease, rand, seg, smooth, noise } from "./math.js";
export { fit, luma, mix, scale, WHITE } from "./color.js";
export { Bits, B, Lights, P, Particles, sparkle } from "./sim.js";
export { FONTS } from "./font.js";
export { clearFrame, composite, createFrame, createFx } from "./fx.js";
