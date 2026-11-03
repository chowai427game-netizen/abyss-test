# PixelFX upstream record

This folder vendors the PixelFX code needed for the Damage number and Crit number effects.

- Upstream project: https://github.com/patch-gg/pixelfx
- Upstream version: `0.3.0`
- Upstream revision: `a84159688af3ca37a4be05a0d422b94451b2e24e`
- Effect sources: `src/fx/ui/damage-number.js`, `src/fx/ui/crit-number.js`, and their helper `src/fx/ui/_lib.js`.
- Required core modules are copied from that revision. `src/core/index.js` is a small local barrel that exports only symbols used by these two effects; the upstream effects and their helper remain otherwise unmodified.
- The PixelFX MIT license and upstream NOTICE are retained beside the sources. The separate Patch Pixel font under upstream `gallery/fonts` is not included.
- The game adapter is `js/pixelfx-combat-number-bridge.js`; it passes actual damage text at runtime and renders transparent canvas frames with nearest-neighbor scaling.
