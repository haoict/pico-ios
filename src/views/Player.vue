<template>
  <!-- main layout: flex column for portrait, overlay for landscape -->
  <div
    class="relative h-screen w-screen overflow-hidden bg-black select-none flex flex-col landscape:flex-row landscape:items-stretch pt-[env(safe-area-inset-top)] pt-4"
  >
    <!-- game zone -->
    <div
      class="game-zone flex-1 relative flex items-center justify-center overflow-hidden w-full landscape:h-full landscape:w-full landscape:px-60 landscape:py-4 pointer-events-none"
    >
      <div
        id="canvas-container"
        ref="canvasContainer"
        class="relative flex items-center justify-center p-1 w-full h-full pointer-events-auto"
      >
        <canvas
          class="aspect-square w-full h-full object-contain image-pixelated shadow-2xl shadow-black/50 rounded-sm"
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
          class="absolute inset-0 bg-black/60 backdrop-blur-xl z-30 flex items-center justify-center"
        >
          <!-- menu content -->
          <div class="flex flex-col gap-4 text-center p-8 w-full max-w-xs">
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
      class="controller-zone relative shrink-0 z-50 portrait:h-[350px] portrait:w-full portrait:bg-black/80 portrait:backdrop-blur-xl portrait:border-t portrait:border-white/5 landscape:absolute landscape:inset-0 landscape:pointer-events-none"
    >
      <VirtualController @menu="toggleMenu" />
    </div>

    <!-- info overlay (toast) -->
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
    <!-- saves drawer -->
    <SavesDrawer
      :isOpen="isSavesDrawerOpen"
      :cartName="activeCartName"
      @close="isSavesDrawerOpen = false"
      @load="
        (filename) => {
          if (filename) {
            picoBridge.loadRAMState('Saves/' + filename);
            showToast('STATE LOADED ⚡️');
          }
          isMenuOpen = false;
        }
      "
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
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
const showInfo = ref(false);
const infoMessage = ref("");
const focusIndex = ref(0);
const isSavesDrawerOpen = ref(false);

const activeCartName = ref(
  props.cartId === "boot" ? "boot" : props.cartId.replace(".p8.png", "")
);

onMounted(async () => {
  // # hard reload strategy
  // if query param is missing, reload.
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
    // ## fetch data (player responsibility)

    let cartData = null;
    let effectiveCartName = props.cartId;

    // # check memory handoff (fast path)
    const stashedName = localStorage.getItem("pico_handoff_name");
    const stashedData = localStorage.getItem("pico_handoff_payload");

    // # logic:
    // if cartId is 'boot', we must use stashed data.
    if (
      (props.cartId === "boot" || stashedName === props.cartId) &&
      stashedData
    ) {
      console.log(`⚡️ [Player] Memory Handoff Found for ${stashedName}`);
      effectiveCartName = stashedName;
      activeCartName.value = stashedName.replace(".p8.png", "");

      // # convert base64 -> uint8array
      const binaryString = window.atob(stashedData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      cartData = bytes;
    } else {
      // # disk load
      console.log(`[Player] Disk Fetching ${props.cartId}...`);

      const res = await Filesystem.readFile({
        path: `Carts/${props.cartId}`,
        directory: Directory.Documents,
      });
      // capacitor returns base64
      const binaryString = window.atob(res.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      cartData = bytes;
    }

    // ## boot engine
    if (cartData) {
      // no init() needed, bridge is singleton
      await picoBridge.boot(effectiveCartName, cartData);

      // # hook into pico-8 internal exit
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
  window.removeEventListener("keydown", handleGlobalKeydown);
  picoBridge.shutdown();
});

// ## menu structure
const menuButtons = [
  { label: "resume", action: "resume" },
  { label: "quick save", action: "quicksave" },
  { label: "manage saves", action: "managesaves" },
  { label: "reset", action: "reset" },
  { label: "exit", action: "exit" },
];

let menuDebounce = false;
const toggleMenu = () => {
  // # debounce to prevent sticky touches
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
  if (action === "resume") toggleMenu();
  if (action === "quicksave") triggerQuickSave();
  if (action === "quickload") triggerQuickLoad();
  if (action === "managesaves") isSavesDrawerOpen.value = true;
  if (action === "reset") resetGame();
  if (action === "exit") exitGame();
};

const triggerQuickSave = async () => {
  if (!window.FS) {
    showToast("WAITING FOR FS...");
    return;
  }
  showToast("SAVING (KEEP OPEN)...");
  const success = await window.picoBridge.captureFullRAMState();
  if (success) {
    showToast("STATE SAVED 💾");
  } else {
    showToast("SAVE FAILED ❌");
  }
};

const triggerQuickLoad = async () => {
  showToast("LOADING STATE...");

  // # delegate to bridge
  const success = await window.picoBridge.loadRAMState();

  if (success) {
    showToast("STATE LOADED ⚡️");
    isMenuOpen.value = false;
  } else {
    showToast("NO SAVE FOUND");
  }
};

const triggerSave = (silent = false) => {
  // # silent background sync
  if (window.FS) {
    window.picoSave();
  }
  window.picoBridge.syncToNative();
  if (!silent) showToast("GAME SAVED");
};

const triggerBrowse = () => {
  if (filePicker.value) {
    // ensure we accept .state files
    filePicker.value.accept = ".p8d,.txt,.p8,.state";
    filePicker.value.click();
  } else {
    console.error("File picker ref not found");
  }
};

const handleFileImport = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // feedback
  showToast("IMPORTING...");

  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target.result;
    const uint8Array = new Uint8Array(arrayBuffer);
    const fileName = file.name;

    if (fileName.endsWith(".state")) {
      // # ram injection path
      console.log("⚡️ [Player] Detect .state file, triggering RAM Injection");
      window.picoBridge.injectFullRAMState(uint8Array);
      showToast("STATE LOADED ⚡️");
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
  console.log("[Player] Hard Resetting...");
  window.location.reload();
}

async function exitGame() {
  // # reliable exit save
  // await engine's internal flush
  if (window.picoSave) {
    console.log("💾 [Player] Saving High Scores & Save Data (Async)...");
    const savePromise = window.picoSave();
    const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
    await Promise.race([savePromise, timeout]);
  }

  // force one last sync
  await picoBridge.syncToNative();

  window.Pico8Kill = true;
  isExiting.value = true;
  picoBridge.shutdown();

  setTimeout(() => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "#/";
    window.location.href = url.toString();
  }, 100);
}

// # enhanced shutdown hook
function hookPicoQuit() {
  if (window.Module) {
    const originalQuit = window.Module.quit;
    window.Module.quit = (status, toThrow) => {
      console.log("⚡️ [Player] PICO-8 Quit Detected (Internal)");
      try {
        if (originalQuit) originalQuit(status, toThrow);
      } catch (e) {}

      picoBridge.shutdown();
      window.location.replace(
        window.location.origin + window.location.pathname
      );
    };
  }
}

const showToast = (msg) => {
  infoMessage.value = msg;
  showInfo.value = true;
  setTimeout(() => (showInfo.value = false), 2000);
};

// # keyboard navigation
function handleGlobalKeydown(e) {
  if (e.key === "Escape") {
    toggleMenu();
    return;
  }

  if (!isMenuOpen.value) return;
  if (isSavesDrawerOpen.value) return;

  if (e.key === "ArrowUp") {
    focusIndex.value =
      (focusIndex.value - 1 + menuButtons.length) % menuButtons.length;
  } else if (e.key === "ArrowDown") {
    focusIndex.value = (focusIndex.value + 1) % menuButtons.length;
  } else if (e.key === "Enter" || e.key === " ") {
    triggerMenuAction(menuButtons[focusIndex.value].action);
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
