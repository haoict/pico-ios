<template>
  <!-- Main Layout: Flex Column for Portrait, Overlay for Landscape -->
  <div
    class="relative h-screen w-screen overflow-hidden bg-black select-none flex flex-col landscape:block pt-[env(safe-area-inset-top)] pt-4"
  >
    <!-- GAME ZONE -->
    <!-- Portrait: Flex-1 (Takes remaining space above controller) -->
    <!-- Landscape: Full screen with padding constraints -->
    <div
      class="game-zone flex-1 relative flex items-center justify-center overflow-hidden w-full landscape:h-full landscape:w-full landscape:px-32"
    >
      <div
        id="canvas-container"
        ref="canvasContainer"
        class="relative flex items-center justify-center p-1 w-full h-full"
      >
        <canvas
          class="aspect-square w-full h-full object-contain image-pixelated shadow-2xl shadow-black/50 rounded-sm"
          id="canvas"
          oncontextmenu="event.preventDefault()"
          tabindex="-1"
          width="128"
          height="128"
        ></canvas>

        <!-- Loading Overlay -->
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20"
        >
          <div class="flex flex-col items-center gap-4">
            <div
              class="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"
            ></div>
            <p class="text-white/60 font-mono text-sm animate-pulse">
              BOOTING CARTRIDGE...
            </p>
          </div>
        </div>

        <!-- Pause Menu Overlay -->
        <div
          v-if="isMenuOpen"
          class="absolute inset-0 bg-black/60 backdrop-blur-xl z-30 flex items-center justify-center"
        >
          <!-- Menu Content -->
          <div class="flex flex-col gap-4 text-center p-8 w-full max-w-xs">
            <h2
              class="text-4xl font-bold text-white mb-8 tracking-widest drop-shadow-md font-pico"
            >
              PAUSE
            </h2>

            <button
              id="resumeBtn"
              @click="resumeGame"
              class="px-8 py-3 rounded-xl font-bold tracking-wider hover:scale-105 transition-transform w-full shadow-lg shadow-white/10 focus:ring-4 focus:ring-white/50 outline-none font-pico"
              :class="
                focusIndex === 0
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              "
            >
              RESUME
            </button>

            <button
              id="resetBtn"
              @click="resetGame"
              class="px-8 py-3 rounded-xl font-medium tracking-wider transition-colors w-full backdrop-blur-md focus:ring-4 focus:ring-white/50 outline-none font-pico"
              :class="
                focusIndex === 1
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              "
            >
              RESET
            </button>

            <button
              id="exitBtn"
              @click="exit"
              class="px-8 py-3 rounded-xl font-medium tracking-wider transition-colors w-full border border-red-500/30 backdrop-blur-md focus:ring-4 focus:ring-red-500/50 outline-none font-pico"
              :class="
                focusIndex === 2
                  ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              "
            >
              EXIT
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Exit Overlay -->
    <div
      v-if="isExiting"
      class="absolute inset-0 bg-black z-[100] transition-opacity duration-100 ease-out"
    ></div>

    <!-- CONTROLLER ZONE -->
    <!-- Portrait: Fixed Height Block at Bottom -->
    <!-- Landscape: Absolute Overlay -->
    <div
      class="controller-zone relative shrink-0 z-50 portrait:h-[350px] portrait:w-full portrait:bg-black/80 portrait:backdrop-blur-xl portrait:border-t portrait:border-white/5 landscape:absolute landscape:inset-0 landscape:pointer-events-none"
    >
      <VirtualController @menu="toggleMenu" />
    </div>

    <!-- Info Overlay (Toast) -->
    <Transition name="fade">
      <div
        v-if="showInfo"
        class="fixed top-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-[60] flex items-center gap-3 pointer-events-none"
      >
        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        <span class="text-white/90 font-medium tracking-wide text-sm">
          {{ infoMessage }}
        </span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { picoBridge } from "../services/PicoBridge";
import VirtualController from "../components/VirtualController.vue";

const props = defineProps({
  cartId: {
    type: String,
    required: true,
  },
});

const router = useRouter();
const route = useRoute();
const loading = ref(true);
const isMenuOpen = ref(false);
const isExiting = ref(false);
const canvasRef = ref(null);

onMounted(async () => {
  // HARD RELOAD STRATEGY:
  // If the query param is missing (should reflect in props), reload.
  const targetQuery = route.query.cart;

  if (!props.cartId || !targetQuery) {
    console.warn("[Player] Missing cart ID, returning to library");
    router.push("/");
    return;
  }

  if (window.Module && window.Module.ccall && window.p8_is_running) {
    console.log("[Player] Engine running, forcing reload for new cart");
    window.location.reload();
    return;
  }

  try {
    // Phase 8: Golden Bridge Pattern
    // 1. Fetch Data (Player responsibility now)

    let cartData = null;
    let effectiveCartName = props.cartId;

    // Check Memory Handoff (Fast Path)
    // Keys defined in Library.vue: pico_handoff_name, pico_handoff_payload
    const stashedName = localStorage.getItem("pico_handoff_name");
    const stashedData = localStorage.getItem("pico_handoff_payload");

    // Logic:
    // If cartId is 'boot', we MUST use the stashed data (User clicked a game in library).
    // If cartId matches stashedName, we also use it.
    if (
      (props.cartId === "boot" || stashedName === props.cartId) &&
      stashedData
    ) {
      console.log(`⚡️ [Player] Memory Handoff Found for ${stashedName}`);
      effectiveCartName = stashedName;

      // Convert Base64 -> Uint8Array
      const binaryString = window.atob(stashedData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      cartData = bytes;
    } else {
      // Disk Load (Direct URL navigation?)
      // Note: If cartId is 'boot' but no stash exists, this remains 'boot' and fails disk load intentionally.
      console.log(`[Player] Disk Fetching ${props.cartId}...`);

      const res = await Filesystem.readFile({
        path: `Carts/${props.cartId}`,
        directory: Directory.Documents,
      });
      // Capacitor returns base64
      const binaryString = window.atob(res.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      cartData = bytes;
    }

    // 2. Boot Engine
    if (cartData) {
      // No init() needed, bridge is singleton
      await picoBridge.boot(effectiveCartName, cartData);

      // Hook into PICO-8 internal exit
      hookPicoQuit();

      setTimeout(() => {
        loading.value = false;
      }, 1500);
    } else {
      throw new Error("No data found for cart");
    }
  } catch (e) {
    console.error("Failed to load cart:", e);
    alert("Failed to load cartridge: " + e.message);
    router.push("/");
  }
});

onUnmounted(() => {
  picoBridge.shutdown();
});

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value; // Simple toggle
  if (isMenuOpen.value) {
    picoBridge.pause();
  } else {
    picoBridge.resume();
  }
}

function resumeGame() {
  isMenuOpen.value = false;
  picoBridge.resume();
}

function resetGame() {
  // HARD RESET: specific logic to force reload
  console.log("[Player] Hard Resetting...");
  window.location.reload();
}

const showInfo = ref(false);
const infoMessage = ref("");

// Enhanced Shutdown Hook
function hookPicoQuit() {
  if (window.Module) {
    const originalQuit = window.Module.quit;
    window.Module.quit = (status, toThrow) => {
      console.log("⚡️ [Player] PICO-8 Quit Detected (Internal)");
      try {
        // Emscripten may throw ExitStatus
        if (originalQuit) originalQuit(status, toThrow);
      } catch (e) {
        // Ignore ExitStatus
      }

      // CRITICAL: Force a full reload to clear sticky Emscripten memory state.
      // This prevents the "halt" and ensures a clean return to Library.
      picoBridge.shutdown();
      window.location.replace(
        window.location.origin + window.location.pathname
      );
    };
  }
}

function exit() {
  window.Pico8Kill = true;
  isExiting.value = true;
  picoBridge.shutdown();

  setTimeout(() => {
    // Robust exit: Clear search (query params) and go to root hash
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "#/";
    window.location.href = url.toString();
  }, 100);
}
// Menu Navigation Logic
const menuButtons = ["resumeBtn", "resetBtn", "exitBtn"];
const focusIndex = ref(0);

watch(isMenuOpen, (newVal) => {
  if (newVal) {
    focusIndex.value = 0; // Reset focus to top
    setTimeout(() => document.getElementById(menuButtons[0])?.focus(), 50);
  }
});

function handleMenuKeydown(e) {
  if (!isMenuOpen.value) return;

  if (e.key === "ArrowUp") {
    // Phase 86: Swapped Logic (Up triggers Next/Down visual to fix inversion)
    focusIndex.value = (focusIndex.value + 1) % menuButtons.length;
    document.getElementById(menuButtons[focusIndex.value])?.focus();
    e.preventDefault();
  } else if (e.key === "ArrowDown") {
    // Phase 86: Swapped Logic (Down triggers Prev/Up visual to fix inversion)
    focusIndex.value =
      (focusIndex.value - 1 + menuButtons.length) % menuButtons.length;
    document.getElementById(menuButtons[focusIndex.value])?.focus();
    e.preventDefault();
  } else if (
    e.key === "z" ||
    e.key === "Enter" ||
    e.key === " " ||
    e.key === "x"
  ) {
    // "O" (z) or "X" (x) or Start triggers click
    document.getElementById(menuButtons[focusIndex.value])?.click();
    e.preventDefault();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleMenuKeydown);
  // ... existing onMounted code ...
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleMenuKeydown);
  picoBridge.shutdown();
});
</script>

<style>
.image-pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
