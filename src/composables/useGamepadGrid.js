import { ref, onMounted, onUnmounted, unref } from "vue";
import { ImpactStyle } from "@capacitor/haptics";
import { haptics } from "../utils/haptics";

export function useGamepadGrid({
  items,
  columns,
  onSelect,
  onBack,
  onSettings,
  onUpOut,
  onDownOut,
  onMenuToggle,
  enabled = true,
}) {
  const focusedIndex = ref(-1);
  let loopId = null;
  let lastButtonState = {};

  // expose itemsRef map to store dom elements
  const itemRefs = ref({});
  const setItemRef = (el, index) => {
    if (el) itemRefs.value[index] = el;
  };

  const startLoop = () => {
    if (loopId) return;
    const loop = () => {
      poll();
      loopId = requestAnimationFrame(loop);
    };
    loop();
  };

  const stopLoop = () => {
    if (loopId) {
      cancelAnimationFrame(loopId);
      loopId = null;
    }
  };

  const scrollToFocused = () => {
    const el = itemRefs.value[focusedIndex.value];
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const poll = () => {
    if (enabled !== undefined && !unref(enabled)) return;

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
      if (!gp) continue;
      const id = gp.index;

      // inputs
      const up = gp.buttons[12]?.pressed || gp.axes[1] < -0.5;
      const down = gp.buttons[13]?.pressed || gp.axes[1] > 0.5;
      const left = gp.buttons[14]?.pressed || gp.axes[0] < -0.5;
      const right = gp.buttons[15]?.pressed || gp.axes[0] > 0.5;

      const select = gp.buttons[0]?.pressed; // a / x
      const back = gp.buttons[1]?.pressed; // b / o
      // map settings to select(8) or y(3)
      const settings = gp.buttons[8]?.pressed || gp.buttons[3]?.pressed;

      const total = items.value.length;
      const cols = columns.value || 1;

      if (total === 0) return;

      // init focus
      if ((up || down || left || right) && focusedIndex.value === -1) {
        focusedIndex.value = 0;
        lastButtonState[id + "-move"] = true; // debounce first input
        return;
      }

      // --- nav ---
      // right
      if (right) {
        if (!lastButtonState[id + "-right"]) {
          if (focusedIndex.value < total - 1) {
            focusedIndex.value++;
            scrollToFocused();
            haptics.impact(ImpactStyle.Light).catch(() => {});
          }
          lastButtonState[id + "-right"] = true;
        }
      } else {
        lastButtonState[id + "-right"] = false;
      }

      // left
      if (left) {
        if (!lastButtonState[id + "-left"]) {
          if (focusedIndex.value > 0) {
            focusedIndex.value--;
            scrollToFocused();
            haptics.impact(ImpactStyle.Light).catch(() => {});
          }
          lastButtonState[id + "-left"] = true;
        }
      } else {
        lastButtonState[id + "-left"] = false;
      }

      // down
      if (down) {
        if (!lastButtonState[id + "-down"]) {
          const next = focusedIndex.value + cols;
          if (next < total) {
            focusedIndex.value = next;
            scrollToFocused();
            haptics.impact(ImpactStyle.Light).catch(() => {});
          }
          lastButtonState[id + "-down"] = true;
        }
      } else {
        lastButtonState[id + "-down"] = false;
      }

      // up
      if (up) {
        if (!lastButtonState[id + "-up"]) {
          const prev = focusedIndex.value - cols;
          if (prev >= 0) {
            focusedIndex.value = prev;
            scrollToFocused();
            haptics.impact(ImpactStyle.Light).catch(() => {});
          } else {
            // Boundary Check
            if (onUpOut) onUpOut();
          }
          lastButtonState[id + "-up"] = true;
        }
      } else {
        lastButtonState[id + "-up"] = false;
      }

      // --- actions ---
      // select (a)
      if (select) {
        if (!lastButtonState[id + "-a"]) {
          if (focusedIndex.value >= 0 && items.value[focusedIndex.value]) {
            onSelect(items.value[focusedIndex.value]);
          }
          lastButtonState[id + "-a"] = true;
        }
      } else {
        lastButtonState[id + "-a"] = false;
      }

      // back (b)
      if (back) {
        if (!lastButtonState[id + "-b"]) {
          if (onBack) onBack();
          lastButtonState[id + "-b"] = true;
        }
      } else {
        lastButtonState[id + "-b"] = false;
      }

      // settings
      if (settings) {
        if (!lastButtonState[id + "-settings"]) {
          if (onSettings) onSettings();
          lastButtonState[id + "-settings"] = true;
        }
      } else {
        lastButtonState[id + "-settings"] = false;
      }

      // menu toggle (x / square) -> button 2
      const menu = gp.buttons[2]?.pressed;
      if (menu) {
        if (!lastButtonState[id + "-menu"]) {
          if (onMenuToggle) onMenuToggle();
          lastButtonState[id + "-menu"] = true;
        }
      } else {
        lastButtonState[id + "-menu"] = false;
      }
    }
  };

  const handleKeydown = (e) => {
    // check enabled state
    if (enabled !== undefined && !unref(enabled)) return;

    // ignore if typing in an input
    if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      if (e.key === "Escape") {
        document.activeElement.blur();
        return;
      }
      if (e.key !== "Enter") return;
    }

    const total = items.value.length;
    const cols = columns.value || 1;

    // auto-focus if pressing nav keys
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
      focusedIndex.value === -1
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      focusedIndex.value = 0;
      scrollToFocused();
      return;
    }

    if (["Backspace", "Escape", "b", "B"].includes(e.key)) {
      if (onBack) {
        onBack();
        e.stopImmediatePropagation();
      }
      return;
    }

    // only handle nav if focusedIndex !== -1 (active)
    if (focusedIndex.value === -1) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (focusedIndex.value < total - 1) {
        focusedIndex.value++;
        scrollToFocused();
      }
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (focusedIndex.value > 0) {
        focusedIndex.value--;
        scrollToFocused();
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopImmediatePropagation();
      const next = focusedIndex.value + cols;
      if (next < total) {
        focusedIndex.value = next;
        scrollToFocused();
      } else {
        if (onDownOut) onDownOut();
      }
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopImmediatePropagation();
      const prev = focusedIndex.value - cols;
      if (prev >= 0) {
        focusedIndex.value = prev;
        scrollToFocused();
      } else {
        if (onUpOut) onUpOut();
      }
    }

    if (["Enter", " ", "z", "Z"].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (items.value[focusedIndex.value]) {
        onSelect(items.value[focusedIndex.value]);
      }
    }
  };

  onMounted(() => {
    startLoop();
    window.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    stopLoop();
    window.removeEventListener("keydown", handleKeydown);
  });

  return {
    focusedIndex,
    setItemRef,
  };
}
