import { reactive, watch } from "vue";
import { useLibraryStore } from "../stores/library";
import { Capacitor } from "@capacitor/core";

class InputManagerService {
  constructor() {
    this.state = reactive({
      inputMode: "UI", // 'UI' | 'GAME'
      active: false,
    });

    this.listeners = new Set();
    this.loopId = null;
    this.lastButtonState = {
      menu: false,
      navUp: null,
      navDown: null,
      navLeft: null,
      navRight: null,
      confirm: false,
      back: false,
      start: false,
    };

    // STATIC BUFFERS
    this._inputBuffer = {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      x: false,
      y: false,
      start: false,
      select: false,
    };

    // BIT HYGIENE - separate masks for inputs
    this._gamepadMask = 0;
    this._keyMask = 0;
    this._virtualMask = 0;

    // master state
    this._currentState = 0;

    // loop control
    this.pollInterval = null; // for setInterval
    this.swapButtons = false;
    this.isAndroid = Capacitor.getPlatform() === "android";
    this._swapCooldown = 0;

    // keyboard state
    this.keys = {};
    this.boundKeyHandler = this.handleKey.bind(this);

    // pico-8 layout default (left=1, right=2, up=4, down=8, o=16, x=32)
    if (typeof window !== "undefined") {
      window.pico8_buttons = window.pico8_buttons || [0, 0, 0, 0, 0, 0, 0, 0];
      // JIT Hook
      window.inputManager = this;
    }
  }

  init() {
    if (this.loopId) return;
    this.state.active = true;

    // sync initial settings & watch for changes
    const store = useLibraryStore();
    this.swapButtons = store.swapButtons;

    // watch store for swap changes (avoids polling store in loop)
    watch(
      () => store.swapButtons,
      (newVal) => {
        const oldVal = this.swapButtons;
        this.swapButtons = newVal;
        console.log(`[input-manager] cached swapButtons updated: ${newVal}`);

        if (this.state.inputMode === "UI" && newVal !== oldVal) {
          this.lastButtonState["back"] = true;
          this.lastButtonState["confirm"] = true;
          this._swapCooldown = 5; // protect for 20ms
        }
      },
      { flush: "sync" }
    );

    // attach keyboard listeners
    window.addEventListener("keydown", this.boundKeyHandler);
    window.addEventListener("keyup", this.boundKeyHandler);

    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.poll(), 4);

    this.loop();

    // JIT injection
    this.injectFrameHook();

    console.log("[input-manager] initialized (JIT + Dual Loop mode)");
  }

  // RAF Loop for general frame-based updates (if any)
  loop() {
    if (!this.state.active) return;

    // SYNC: Call poll() to fetch fresh inputs and update PICO-8 mem
    this.poll();

    this.loopId = requestAnimationFrame(() => this.loop());
  }

  // JIT input injection
  // hijacks PICO-8's internal draw call to force an input update
  // 0ms before the engine reads inputs for the frame
  injectFrameHook() {
    let attempts = 0;
    const maxAttempts = 100; // try for ~10s

    const hookInterval = setInterval(() => {
      attempts++;

      if (window.Module && window.Module.pico8draw) {
        // prevent double hook
        if (window.Module._isHooked) {
          clearInterval(hookInterval);
          return;
        }

        console.log("[input-manager] Injecting JIT Frame Hook...");
        const originalDraw = window.Module.pico8draw;

        // monkey patch
        window.Module.pico8draw = function () {
          // force update from hardware before frame
          if (window.inputManager) {
            window.inputManager.syncState();
          }
          // resume
          if (originalDraw) originalDraw();
        };

        window.Module._isHooked = true;
        clearInterval(hookInterval);
        console.log("[input-manager] JIT Frame Hook ACTIVE");
      }

      if (attempts > maxAttempts) {
        clearInterval(hookInterval); // give up
      }
    }, 100);
  }

  // merge all input sources and write to PICO-8 mem
  syncState() {
    this._currentState = this._gamepadMask | this._keyMask | this._virtualMask;

    if (window.pico8_buttons) {
      window.pico8_buttons[0] = this._currentState;
    }
  }

  handleKey(e) {
    // ignore synth events to prevent feedback loops
    if (!e.isTrusted) return;

    // prevent scrolling with arrows/space in game mode
    const isInput =
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA";

    // update key state tracking immediately
    this.keys[e.key] = e.type === "keydown";
    this.keys[e.code] = e.type === "keydown";

    // prevent escape (global)
    if (e.code === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    // prevent backspace navigation (outside inputs)
    if (e.code === "Backspace" && !isInput) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    // prevent space scrolling (outside inputs)
    if (e.code === "Space" && !isInput) {
      e.preventDefault();
    }

    if (this.state.inputMode === "GAME" && !isInput) {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
      ) {
        e.preventDefault();
      }
    }

    if (isInput) return;

    let bit = 0;

    // map keys to PICO-8 bits
    switch (e.code) {
      case "ArrowLeft":
        bit = 1;
        break;
      case "ArrowRight":
        bit = 2;
        break;
      case "ArrowUp":
        bit = 4;
        break;
      case "ArrowDown":
        bit = 8;
        break;
      case "KeyZ":
      case "KeyC":
      case "KeyN":
        bit = 16;
        break; // O
      case "KeyX":
      case "KeyV":
      case "KeyM":
        bit = 32;
        break; // X
      case "Enter":
        bit = 64;
        break; // pause
    }

    if (bit > 0) {
      if (e.type === "keydown") this._keyMask |= bit;
      else this._keyMask &= ~bit;

      // instant write: don't wait for poll loop
      this.syncState();
    }
  }

  destroy() {
    if (this.loopId) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }
    if (this.pollInterval) clearInterval(this.pollInterval);
    window.removeEventListener("keydown", this.boundKeyHandler);
    window.removeEventListener("keyup", this.boundKeyHandler);
    this.state.active = false;
  }

  setVirtualKey(keyCode, pressed) {
    const map = {
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      88: "x",
      90: "z",
      13: "Enter",
      80: "p", // start
    };

    const key = map[keyCode];
    if (key) {
      this.keys[key] = pressed;
    }

    if (this.state.inputMode === "GAME") {
      const bit = {
        37: 1, // left
        39: 2, // right
        38: 4, // up
        40: 8, // down
        90: 16, // z = O
        88: 32, // x = X
      }[keyCode];

      if (bit !== undefined) {
        if (pressed) {
          this._virtualMask |= bit;
        } else {
          this._virtualMask &= ~bit;
        }
        // instant write
        this.syncState();
      }
    }
  }

  // register a listener for ui events
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setMode(mode) {
    if (!["UI", "GAME"].includes(mode)) return;

    this.state.inputMode = mode;

    // clear inputs when switching to avoid stuck buttons
    this.lastButtonState = {
      menu: false,
      navUp: null, // object when active
      navDown: null,
      navLeft: null,
      navRight: null,
      confirm: false,
      back: false,
      wiggle: false,
    };

    // reset virtual gamepad bits
    if (mode === "UI") {
      if (window.pico8_buttons) window.pico8_buttons[0] = 0;
    }
  }

  poll() {
    // decrement swap protection
    if (this._swapCooldown > 0) this._swapCooldown--;

    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;

    // gather raw inputs into buffer
    const buf = this._inputBuffer;

    if (gp) {
      // gamepad
      const btns = gp.buttons;
      const axes = gp.axes;

      buf.a = btns[0]?.pressed || false;
      buf.b = btns[1]?.pressed || false;
      buf.x = btns[2]?.pressed || false; // usually unused
      buf.y = btns[3]?.pressed || false; // usually unused
      buf.select = btns[8]?.pressed || false;
      buf.start = btns[9]?.pressed || false;

      // if digital is active it wins.
      // if silent, check analog
      buf.up = btns[12]?.pressed || false;
      if (!buf.up && axes) buf.up = axes[1] < -0.3;

      buf.down = btns[13]?.pressed || false;
      if (!buf.down && axes) buf.down = axes[1] > 0.3;

      buf.left = btns[14]?.pressed || false;
      if (!buf.left && axes) buf.left = axes[0] < -0.3;

      buf.right = btns[15]?.pressed || false;
      if (!buf.right && axes) buf.right = axes[0] > 0.3;
    } else {
      // reset if no gamepad
      buf.a = false;
      buf.b = false;
      buf.x = false;
      buf.y = false;
      buf.select = false;
      buf.start = false;
      buf.up = false;
      buf.down = false;
      buf.left = false;
      buf.right = false;
    }

    // kb
    if (this.keys["ArrowUp"]) buf.up = true;
    if (this.keys["ArrowDown"]) buf.down = true;
    if (this.keys["ArrowLeft"]) buf.left = true;
    if (this.keys["ArrowRight"]) buf.right = true;

    // GAME MODE
    if (this.state.inputMode === "GAME") {
      let gpMask = 0;

      // gamepad direction
      if (buf.left) gpMask |= 1;
      if (buf.right) gpMask |= 2;
      if (buf.up) gpMask |= 4;
      if (buf.down) gpMask |= 8;

      let o = false;
      let x = false;

      // gamepad face buttons swap logic
      if (!this.swapButtons) {
        if (buf.a || buf.y) o = true;
        if (buf.b || buf.x) x = true;
      } else {
        if (buf.b || buf.x) o = true;
        if (buf.a || buf.y) x = true;
      }

      if (o) gpMask |= 16;
      if (x) gpMask |= 32;

      this._gamepadMask = gpMask;
      this.syncState();

      this.emitChange("menu", buf.select);

      if (window.pico8_gpio) {
        const picoMenuRequested =
          buf.start || this.keys["Enter"] || this.keys["p"] || this.keys["P"];
        window.pico8_gpio[0] = picoMenuRequested ? 1 : 0;
      }
    }
    // UI MODE
    else {
      // nav
      const isTyping = document.activeElement?.tagName === "INPUT" ||
                       document.activeElement?.tagName === "TEXTAREA";

      this.handleNavInput("nav-up", buf.up);
      this.handleNavInput("nav-down", buf.down);

      if (!isTyping) {
        this.handleNavInput("nav-left", buf.left);
        this.handleNavInput("nav-right", buf.right);
      }

      // confirm / back
      let confirm = false;
      let back = false;

      // gamepad face
      if (!this.swapButtons) {
        if (buf.a) confirm = true;
        if (buf.b) back = true;
      } else {
        if (buf.b) confirm = true;
        if (buf.a) back = true;
      }

      // keyboard (only when not typing)
      if (!isTyping) {
        if (
          this.keys["z"] ||
          this.keys["Z"] ||
          this.keys["Enter"] ||
          this.keys[" "]
        )
          confirm = true;
        if (this.keys["x"] || this.keys["X"] || this.keys["Escape"]) back = true;
      }

      this.emitChange("confirm", confirm);
      this.emitChange("back", back);

      // edit mode (only when not typing)
      let wiggle = false;
      if (!isTyping) {
        if (buf.y) wiggle = true;
        if (this.keys["e"] || this.keys["E"]) wiggle = true;
      }
      this.emitChange("wiggle", wiggle);
    }
  }

  // handle navigation with key repeat
  // delay: 400ms, rate: 100ms
  handleNavInput(event, isPressed) {
    const now = Date.now();
    const state = this.lastButtonState[event];

    if (isPressed) {
      if (!state) {
        // first press
        this.emit(event);
        this.lastButtonState[event] = {
          pressed: true,
          startTime: now,
          lastRepeat: now,
        };
      } else if (state.pressed) {
        // holding
        const elapsed = now - state.startTime;
        if (elapsed > 400) {
          // initial delay
          if (now - state.lastRepeat > 100) {
            // repeat rate
            this.emit(event);
            state.lastRepeat = now;
          }
        }
      }
    } else {
      // released
      if (state) {
        this.lastButtonState[event] = null;
      }
    }
  }

  emitOnce(event) {
    if (!this.lastButtonState[event]) {
      this.emit(event);
      this.lastButtonState[event] = true;
    }
  }

  emitChange(event, isPressed) {
    if (isPressed) {
      if (!this.lastButtonState[event]) {
        this.emit(event);
        this.lastButtonState[event] = true;
      }
    } else {
      // protect against clearing state if we just swapped buttons in this frame
      if (this._swapCooldown > 0 && (event === "back" || event === "confirm")) {
        return;
      }
      this.lastButtonState[event] = false;
    }
  }

  emit(eventName, data = null) {
    this.listeners.forEach((listener) => listener(eventName, data));
  }

  dispatchKey(keyCode, type) {
    const keyMap = { 13: "Enter", 80: "p" };
    const codeMap = { 13: "Enter", 80: "KeyP" };

    const key = keyMap[keyCode] || "";
    const code = codeMap[keyCode] || "";

    const event = new KeyboardEvent(type, {
      key: key,
      code: code,
      bubbles: true,
      cancelable: true,
      view: window,
    });

    // emscripten: define property for read-only fields
    Object.defineProperty(event, "keyCode", { get: () => keyCode });
    Object.defineProperty(event, "which", { get: () => keyCode });
    Object.defineProperty(event, "charCode", { get: () => keyCode });

    const target = document.getElementById("canvas") || document;
    target.dispatchEvent(event);
  }

  // legacy compat
  checkKeys(keyList) {
    return false;
  }
}

export const inputManager = new InputManagerService();
