<template>
  <!-- main layout: flex column for portrait, overlay for landscape -->
  <div
    class="relative h-screen w-screen overflow-hidden bg-black select-none flex flex-col landscape:flex-row landscape:items-stretch"
  >
    <!-- game zone -->
    <div
      class="game-zone flex-1 relative flex items-center justify-center overflow-hidden w-full landscape:h-full landscape:w-full landscape:px-[max(env(safe-area-inset-left),30px)] landscape:pr-[max(env(safe-area-inset-right),30px)] landscape:py-4 pointer-events-none"
    >
      <div
        id="canvas-container"
        ref="canvasContainer"
        class="relative flex items-center justify-center p-1 portrait:pb-8 w-full h-full pointer-events-auto"
      >
        <canvas
          class="aspect-square w-full h-full object-contain portrait:object-bottom landscape:object-center image-pixelated rounded-sm transition-shadow duration-300"
          :class="{ 'shadow-2xl shadow-black/50': isMenuOpen }"
          id="canvas"
          oncontextmenu="event.preventDefault()"
          tabindex="-1"
          width="128"
          height="128"
        ></canvas>

        <!-- loading overlay -->
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

        <!-- pause menu overlay -->
        <div
          v-if="isMenuOpen"
          class="absolute inset-0 bg-black/60 backdrop-blur-xl z-[60] flex items-center justify-center"
        >
          <!-- menu content -->
          <div
            class="flex flex-col gap-4 text-center p-8 landscape:p-4 landscape:gap-2 w-full max-w-xs max-h-screen overflow-y-auto"
          >
            <h2
              class="text-4xl font-bold text-white mb-8 tracking-widest drop-shadow-md font-pico"
            >
              PAUSE
            </h2>

            <!-- dynamic menu buttons -->
            <button
              v-for="(btn, idx) in menuButtons"
              :key="btn.label"
              :id="'btn-' + idx"
              @click="triggerMenuAction(btn.action)"
              @touchend.prevent="triggerMenuAction(btn.action)"
              class="px-8 py-3 rounded-xl font-medium tracking-wider transition-colors w-full backdrop-blur-md focus:ring-4 focus:ring-white/50 outline-none font-pico uppercase"
              :class="[
                focusIndex === idx
                  ? 'bg-white text-black scale-105 shadow-lg'
                  : 'bg-white/10 text-white hover:bg-white/20',
                btn.action === 'exit' ? 'border border-red-500/30' : '',
              ]"
            >
              {{ btn.label }}
            </button>

            <!-- hidden file picker -->
            <input
              type="file"
              ref="filePicker"
              class="hidden"
              accept=".p8d,.txt,.p8"
              @change="handleFileImport"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- exit overlay -->
    <div
      v-if="isExiting"
      class="absolute inset-0 bg-black z-[100] transition-opacity duration-100 ease-out"
    ></div>

    <!-- controller zone -->
    <!-- portrait: fixed height block at bottom -->
    <!-- landscape: absolute overlay -->
    <div
      class="controller-zone relative shrink-0 z-50 portrait:h-[410px] portrait:w-full portrait:bg-black/80 portrait:backdrop-blur-xl portrait:p-1 landscape:absolute landscape:inset-0 landscape:pointer-events-none"
    >
      <VirtualController @menu="toggleMenu" />
    </div>

    <!-- global toast usage -->
    <!-- saves drawer -->
    <SavesDrawer
      :isOpen="isSavesDrawerOpen"
      :cartName="activeCartName"
      @close="isSavesDrawerOpen = false"
      @load="
        (filename) => {
          if (filename) {
            picoBridge.loadRAMState('Saves/' + filename);
            showToast('STATE LOADED');
          }
          isMenuOpen = false;
        }
      "
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { haptics } from "../utils/haptics";
import { ImpactStyle } from "@capacitor/haptics";
import { useRouter, useRoute } from "vue-router";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { picoBridge } from "../services/PicoBridge";
import VirtualController from "../components/VirtualController.vue";
import SavesDrawer from "../components/SavesDrawer.vue";

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
const filePicker = ref(null);
const focusIndex = ref(0);
const isSavesDrawerOpen = ref(false);
import { libraryManager } from "../services/LibraryManager";
import { useToast } from "../composables/useToast";
import { useLibraryStore } from "../stores/library";

import { Fullscreen } from "@boengli/capacitor-fullscreen";

const activeCartName = ref(
  props.cartId === "boot" ? "boot" : props.cartId.replace(".p8.png", "")
);

const ensureImmersiveMode = async () => {
  if (Capacitor.getPlatform() === "android") {
    try {
      await Fullscreen.activateImmersiveMode();
    } catch (e) {
      console.warn("[player] failed to activate immersive mode", e);
    }
  }
};

onMounted(async () => {
  // immersive mode
  await ensureImmersiveMode();

  // helper: verify binary injection
  const base64ToUint8Array = (base64) => {
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      console.log(
        `[player] atob decoded len: ${len}. first byte charcode: ${binaryString.charCodeAt(
          0
        )}`
      );

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log(
        `[player] converted uint8array [0]: ${bytes[0]}, [1]: ${bytes[1]}`
      );
      return bytes;
    } catch (e) {
      console.error("[player] base64toUint8array crash", e);
      throw e;
    }
  };

  // hard reload strategy
  // if query param is missing, reload.
  const targetQuery = route.query.cart;

  if (!props.cartId || !targetQuery) {
    console.warn("[player] missing cart id, returning to library");
    router.push("/");
    return;
  }

  if (window.Module && window.Module.ccall && window.p8_is_running) {
    console.log("[player] engine running, forcing reload for new cart");
    window.location.reload();
    return;
  }

  try {
    // ensure library service is ready
    await libraryManager.init();

    // fetch data (player responsibility)
    let cartData = null;
    let payload = {};
    let effectiveCartName = props.cartId;
    let stashedName = localStorage.getItem("pico_handoff_name");
    const stashedData = localStorage.getItem("pico_handoff_payload");

    console.log(
      `[player] handoff check - id: ${
        props.cartId
      }, stashedname: ${stashedName}, stasheddatalen: ${
        stashedData ? stashedData.length : "N/A"
      }`
    );

    if (stashedData) {
      console.log(
        `[player] raw stashed data (first 50): ${stashedData.substring(0, 50)}`
      );
    }

    // resolve main cart data & name
    // case a: bbs cart (memory)
    if (props.cartId === "bbs_cart" && window._bbs_cartdat) {
      console.log("[player] bbs stash found!");
      cartData = window._bbs_cartdat;
      effectiveCartName = "bbs_cart.p8.png";
    }
    // case b: stashed fast-load (memory)
    else if (
      (props.cartId === "boot" || stashedName === props.cartId) &&
      stashedData
    ) {
      console.log(`[player] memory handoff found for ${stashedName}`);
      effectiveCartName = stashedName;
      activeCartName.value = stashedName.replace(".p8.png", "");

      // raw pipe
      // just convert base64 -> uint8array directly
      console.log(`[player] handoff load: ${stashedName}`);
      cartData = base64ToUint8Array(stashedData);
    }
    // case c: disk load (filesystem)
    else {
      // case d: check if this looks like a bbs cart id
      // bbs carts have format: [a-z]+-\d+ (e.g., abc-0, xyz-123)
      const cartNameWithoutExt = props.cartId.replace(".p8.png", "");
      const isBBSCartId = /^[a-z]+-\d+$/i.test(cartNameWithoutExt);

      if (isBBSCartId) {
        console.log(
          `[player] detected BBS cart id: ${cartNameWithoutExt}, fetching from lexaloffle...`
        );
        try {
          const result = await libraryManager.handleDeepLink(
            cartNameWithoutExt
          );
          effectiveCartName = result.filename;
          activeCartName.value = result.filename.replace(".p8.png", "");
          // re-read from disk after download
          const rawData = await libraryManager.loadCartData(result.filename);
          if (rawData) {
            console.log(
              `[player] bbs cart downloaded and loaded: ${result.filename}`
            );
            cartData = base64ToUint8Array(rawData);
          }
        } catch (err) {
          console.error(`[player] failed to fetch BBS cart: ${err.message}`);
          throw new Error(`Failed to download BBS cartridge: ${err.message}`);
        }
      } else {
        console.log(`[player] disk fetching ${props.cartId}...`);
        let rawData = await libraryManager.loadCartData(props.cartId);
        if (rawData) {
          console.log(`[player] disk load: ${props.cartId}`);
          cartData = base64ToUint8Array(rawData);
        }
      }
    }

    if (!cartData) {
      throw new Error("No cart data found.");
    }

    // initialize payload
    payload[effectiveCartName] = cartData;

    // universal metadata check (run this for stashed carts too!)
    // if props.cartid is 'boot', we rely on stashedname for metadata lookup
    const metaKey = props.cartId === "boot" ? stashedName : props.cartId;
    console.log(
      `[player] inspecting metadata for: ${metaKey} (universal check)`
    );

    const meta = libraryManager.metadata[metaKey];

    if (meta && meta.subCarts && meta.subCarts.length > 0) {
      console.log(
        `[player] bundle detected for ${metaKey}! loading ${meta.subCarts.length} sub-carts...`
      );

      for (const subFile of meta.subCarts) {
        console.log(`   -> loading sub-cart: ${subFile}`);
        const subBase64 = await libraryManager.loadCartData(subFile);

        if (subBase64) {
          payload[subFile] = base64ToUint8Array(subBase64);
        } else {
          console.warn(`   [warning] failed to load data for ${subFile}`);
        }
      }
    } else {
      console.log(
        `[player] no sub-carts found for ${metaKey}. single cart boot.`
      );
    }

    // boot engine
    console.log(
      `[player] sending payload with ${Object.keys(payload).length} files.`
    );

    console.log("[player] booting via slot insertion...");

    // stagger boot
    setTimeout(async () => {
      const finalPayload = payload;

      console.log("[player] booting via universal bundle mode.");

      await picoBridge.boot(effectiveCartName, finalPayload);

      hookPicoQuit();

      setTimeout(() => {
        loading.value = false;
        if (route.query.state) {
          console.log(
            "[player] deep link: auto-loading state:",
            route.query.state
          );
          setTimeout(async () => {
            await picoBridge.loadRAMState("Saves/" + route.query.state);
            showToast("AUTO-LOADED");
          }, 500); // grace period
        }
      }, 1500);
    }, 50);
  } catch (e) {
    console.error("Failed to load cart:", e);
    alert("Failed to load cartridge: " + e.message);
    router.push("/");
  }

  startAutoSaveTimer();
});

onUnmounted(async () => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  stopAutoSaveTimer();
  picoBridge.shutdown();

  if (Capacitor.getPlatform() === "android") {
    try {
      await Fullscreen.showSystemBars();
    } catch (e) {
      console.warn("[player] failed to restore system bars", e);
    }
  }
});

const isMuted = ref(false);

const menuButtons = computed(() => [
  { label: "resume", action: "resume" },
  { label: "save state", action: "manualsave" },
  { label: "manage saves", action: "managesaves" },
  { label: "reset", action: "reset" },
  { label: "exit", action: "exit" },
]);

let menuDebounce = false;
const toggleMenu = async () => {
  if (menuDebounce) return;
  menuDebounce = true;
  setTimeout(() => {
    menuDebounce = false;
  }, 100);

  isMenuOpen.value = !isMenuOpen.value;
  if (isMenuOpen.value) {
    picoBridge.pause();
  } else {
    picoBridge.resume();
  }
};

const triggerMenuAction = (action) => {
  console.log("[player] menu action triggered:", action);
  haptics.impact(ImpactStyle.Light).catch(() => {});
  if (action === "resume") toggleMenu();
  if (action === "manualsave") triggerManualSave();
  if (action === "managesaves") isSavesDrawerOpen.value = true;
  if (action === "reset") resetGame();
  if (action === "exit") exitGame();
};

let autoSaveInterval = null;

const startAutoSaveTimer = () => {
  autoSaveInterval = setInterval(() => {
    if (!isMenuOpen.value) {
      triggerAutoSave();
    }
  }, 600000);
  console.log("[player] auto-save timer started (10m)");
};

const stopAutoSaveTimer = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
};

const triggerAutoSave = async (silent = false) => {
  if (!window.picoBridge || !window.pico8_engine_ready) return;

  const autoName = `Saves/${activeCartName.value}_auto.state`;
  console.log(`[player] triggering auto-save to: ${autoName}`);

  const success = await window.picoBridge.captureFullRAMState(autoName);
  if (success && !silent) {
    showToast("Auto-Saved");
  }
};

const triggerManualSave = async () => {
  if (!window.FS) {
    showToast("Waiting for filesystem...");
    return;
  }
  showToast("Saving State...");

  try {
    // scan existing saves to find next index
    const result = await Filesystem.readdir({
      path: "Saves",
      directory: Directory.Documents,
    });

    // pattern: cartname_manual_N.state
    const base = activeCartName.value + "_manual_";
    let maxIndex = 0;

    result.files.forEach((f) => {
      if (f.name.startsWith(base) && f.name.endsWith(".state")) {
        const part = f.name.replace(base, "").replace(".state", "");
        const num = parseInt(part);
        if (!isNaN(num) && num > maxIndex) {
          maxIndex = num;
        }
      }
    });

    const nextIndex = maxIndex + 1;
    const saveName = `Saves/${base}${nextIndex}.state`;

    const start = performance.now();
    const success = await window.picoBridge.captureFullRAMState(saveName);
    const duration = Math.round(performance.now() - start);

    if (success) {
      showToast(`Saved Slot #${nextIndex}`);
    } else {
      showToast("Save Failed");
    }
  } catch (e) {
    console.error("Manual save scan failed", e);
    // fallback
    const fallbackName = `Saves/${activeCartName.value}_manual_fallback.state`;
    await window.picoBridge.captureFullRAMState(fallbackName);
    showToast("Saved (Fallback)");
  }
};

// # keyboard navigation
const handleFileImport = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // feedback
  showToast("Importing...");

  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target.result;
    const uint8Array = new Uint8Array(arrayBuffer);
    const fileName = file.name;

    if (fileName.endsWith(".state")) {
      // # ram injection path
      console.log("[player] detect .state file, triggering ram injection");
      window.picoBridge.injectFullRAMState(uint8Array);
      showToast("State Loaded");
      // close menu to return to game
      isMenuOpen.value = false;
      picoBridge.resume();
    } else {
      // # standard cart import
      await window.picoBridge.importSaveFile(fileName, uint8Array);
    }
  };
  reader.readAsArrayBuffer(file);
};

function resetGame() {
  console.log("[player] hard resetting...");
  window.location.reload();
}

async function exitGame() {
  // auto-save ram state
  if (window.picoBridge && window.pico8_engine_ready) {
    await triggerAutoSave(true); // silent
  }

  // save data (async wait)
  if (window.picoSave) {
    console.log("[player] auto-saving before exit...");
    const savePromise = window.picoSave();
    const timeout = new Promise((resolve) => setTimeout(resolve, 1000));
    await Promise.race([savePromise, timeout]);
  }
  await picoBridge.syncToNative();

  // kill switch
  window.Pico8Kill = true;
  isExiting.value = true;
  picoBridge.shutdown();

  // hard navigation to root (clears wasm memory)
  setTimeout(() => {
    // force a reload by stripping all query params and hash
    const baseUrl = window.location.origin + window.location.pathname;
    window.location.replace(baseUrl);
  }, 100);
}

// enhanced shutdown hook
function hookPicoQuit() {
  if (window.Module) {
    const originalQuit = window.Module.quit;
    window.Module.quit = (status, toThrow) => {
      console.log("[player] pico-8 quit detected (internal)");
      try {
        if (originalQuit) originalQuit(status, toThrow);
      } catch (e) {}

      picoBridge.shutdown();

      // preserve query parameters so we reload the cart, not the lib
      const targetUrl = window.location.href;
      window.location.replace(targetUrl);
    };
  }
}

// keyboard navigation
function handleGlobalKeydown(e) {
  if (e.key === "Escape") {
    console.log("[player] input: escape");
    toggleMenu();
    return;
  }

  if (!isMenuOpen.value) return;
  if (isSavesDrawerOpen.value) return;

  console.log("[player] menu input:", e.key);

  if (e.key === "ArrowUp") {
    focusIndex.value =
      (focusIndex.value - 1 + menuButtons.value.length) %
      menuButtons.value.length;
  } else if (e.key === "ArrowDown") {
    focusIndex.value = (focusIndex.value + 1) % menuButtons.value.length;
  } else if (
    e.key === "Enter" ||
    e.key === " " ||
    e.key === "z" ||
    e.key === "x" ||
    e.key === "Z" ||
    e.key === "X"
  ) {
    console.log("[player] triggering action from key:", e.key);
    triggerMenuAction(menuButtons.value[focusIndex.value].action);
  }
}

// attach listener
onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});
</script>

<style>
.image-pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
