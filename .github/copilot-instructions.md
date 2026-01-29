# Pocket8 AI Development Guide

## Project Overview

Pocket8 is a native PICO-8 companion app for iOS/Android built with Vue 3 + Capacitor. The core engineering challenge is **bridging the asynchronous mobile file I/O with the synchronous Emscripten/WASM filesystem** that the PICO-8 engine requires.

## Critical Architecture

### WASM Bridge Pattern (`PicoBridge.js`)
- **Never** assume PICO-8's filesystem is asynchronous—it's a synchronous WASM/Emscripten environment
- `window.Module.preRun` is hijacked to inject cartridge data (`window._cartdat`) and configure paths before engine boot
- The engine expects `/cart.png` regardless of user filename—normalize all cart names to this
- All native file operations must complete **before** calling `Module.callMain()` to boot the engine
- Save states serialize entire WASM RAM with GZIP compression for instant resume

### Service Layer Architecture
Services are **singleton instances** (not classes), imported and used directly:
```javascript
import { libraryManager } from "./services/LibraryManager";
await libraryManager.init();
```

**Key Services:**
- `PicoBridge`: Manages WASM engine lifecycle, cart injection, save states
- `LibraryManager`: Handles cart scanning, metadata extraction, multi-directory support (including Android SAF)
- `InputManager`: Bit-mask based input system with mode switching (UI vs GAME)
- `BBS`: Scrapes Lexaloffle BBS for carts (web scraper implementation, no API)

### Platform-Specific Paths
**Always** use platform-aware paths via `Capacitor.getPlatform()`:
- **iOS**: `Directory.Documents/Carts`, `Directory.Documents/Saves`
- **Android**: `Directory.Documents/Pocket8/Carts`, `Directory.Documents/Pocket8/Saves`, `Directory.Documents/Pocket8/Cache`

Android requires the `Pocket8/` prefix for all internal paths. See [LibraryManager.js](src/services/LibraryManager.js#L23-L28) for the `getAppDataDir()` pattern.

### Input System (`InputManager.js`)
- Maintains three separate bit masks: `_gamepadMask`, `_keyMask`, `_virtualMask`
- Mode switching between `UI` and `GAME` with focus-aware polling
- Writes to `window.pico8_buttons` array (PICO-8's expected input buffer)
- Swap buttons feature requires cooldown protection (`_swapCooldown`) to prevent ghost inputs

## Development Workflows

### Build & Test
```bash
npm run build           # Vite build to dist/
npx cap sync ios        # Copy web assets + sync plugins to iOS
npx cap sync android    # Copy web assets + sync plugins to Android
npx cap open ios        # Launch Xcode
npx cap open android    # Launch Android Studio
```

### Engine Development
The PICO-8 engine (`public/pico8.js`) is **proprietary** and not in the repo. For local dev:
1. Place licensed `pico8.js` in `public/`
2. `EngineLoader.init()` checks for engine availability at boot
3. If missing, `BiosImporter` component prompts user to import

### Common Pitfalls
1. **Don't** call Capacitor Filesystem APIs synchronously—always `await`
2. **Don't** modify `window.Module` after engine has booted—it's immutable post-init
3. **Don't** assume file paths work the same on iOS/Android—always check platform
4. Android requires explicit MIME type handling for file pickers: `"image/*"` for `.p8.png` carts

## Key Conventions

### State Management
- Pinia store at [stores/library.js](src/stores/library.js) for global app state
- LocalStorage for persistent settings (prefix: `pico_*`)
- No reactive state in services—use callbacks or store updates

### Routing
Hash-based routing (`createWebHashHistory`) for Capacitor compatibility:
- `/` → Library grid
- `/play?cart={id}` → Player view with engine canvas
- `/bbs` → BBS Explorer (web scraper)
- `/settings/saves` → Saves manager

### Component Patterns
- `useFocusable.js`: Provides gamepad navigation for UI elements
- `useToast.js`: Global toast system (injected via `App.vue`)
- Virtual controller: Always rendered in Player view, visibility controlled by store settings

## External Dependencies

### Capacitor Plugins
- `@capawesome/capacitor-file-picker`: File imports
- `@daniele-rolli/capacitor-scoped-storage`: Android SAF (has patch in `patches/`)
- `@boengli/capacitor-fullscreen`: Immersive mode

### BBS Integration
- No official API—uses web scraper (`PicoWebScraperWeb.js`)
- Cart thumbnails extracted from HTML, download URLs parsed from page structure

## Testing Notes
- Playwright config exists but primarily manual testing on devices
- Test WASM boot sequence with multiple cart formats (`.p8`, `.p8.png`)
- Verify save state compression/decompression with large carts
- Android: Test SAF folder sync and permission flows
