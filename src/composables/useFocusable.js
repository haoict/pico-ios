import { ref, onMounted, onUnmounted, unref, watch } from "vue";
import { inputManager } from "../services/InputManager";
import { ImpactStyle } from "@capacitor/haptics";
import { haptics } from "../utils/haptics";

export function useFocusable({
  items,
  columns = 1,
  onSelect,
  onBack,
  onMenu,
  onUpOut,
  onDownOut,
  enabled = true,
}) {
  const focusedIndex = ref(-1);
  // auto-scrolling support
  const itemRefs = ref({});
  const listenerRemove = ref(null);

  const setItemRef = (el, index) => {
    if (el) itemRefs.value[index] = el;
  };

  const scrollToFocused = () => {
    const el = itemRefs.value[focusedIndex.value];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const handleInput = (event) => {
    if (!unref(enabled)) return;

    const total = unref(items).length;
    const cols = unref(columns) || 1;

    if (total === 0) return;

    // auto-init focus on first nav
    if (
      ["nav-up", "nav-down", "nav-left", "nav-right"].includes(event) &&
      focusedIndex.value === -1
    ) {
      focusedIndex.value = 0;
      scrollToFocused();
      return;
    }

    // only continue if we have focus
    if (focusedIndex.value === -1) return;

    switch (event) {
      case "nav-right":
        if (focusedIndex.value < total - 1) {
          focusedIndex.value++;
          scrollToFocused();
          haptics.impact(ImpactStyle.Light).catch(() => {});
        }
        break;
      case "nav-left":
        if (focusedIndex.value > 0) {
          focusedIndex.value--;
          scrollToFocused();
          haptics.impact(ImpactStyle.Light).catch(() => {});
        }
        break;
      case "nav-down": {
        const next = focusedIndex.value + cols;
        if (next < total) {
          focusedIndex.value = next;
          scrollToFocused();
          haptics.impact(ImpactStyle.Light).catch(() => {});
        } else if (onDownOut) {
          onDownOut();
        }
        break;
      }
      case "nav-up": {
        const prev = focusedIndex.value - cols;
        if (prev >= 0) {
          focusedIndex.value = prev;
          scrollToFocused();
          haptics.impact(ImpactStyle.Light).catch(() => {});
        } else if (onUpOut) {
          onUpOut();
        }
        break;
      }
      case "confirm":
        if (onSelect) {
          const item = unref(items)[focusedIndex.value];
          if (item) onSelect(item);
        }
        break;
      case "back":
        if (onBack) onBack();
        break;
      case "menu":
        if (onMenu) onMenu();
        break;
    }
  };
  const handleKeydown = (e) => {
    // legacy
  };

  onMounted(() => {
    listenerRemove.value = inputManager.addListener(handleInput);
    window.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    if (listenerRemove.value) listenerRemove.value();
    window.removeEventListener("keydown", handleKeydown);
  });

  // reset focus when items change substantially
  watch(
    () => unref(items).length,
    (newLen) => {
      if (focusedIndex.value >= newLen) {
        focusedIndex.value = Math.max(-1, newLen - 1);
      }
    }
  );

  return {
    focusedIndex,
    setItemRef,
    itemRefs,
  };
}
