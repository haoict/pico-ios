<template>
  <!-- main layout: flex column for portrait, overlay for landscape -->
  <div
    class="relative h-screen w-screen overflow-hidden bg-black select-none flex flex-col landscape:flex-row landscape:items-stretch touch-none overscroll-none"
    :class="{ 'portrait:pt-[max(env(safe-area-inset-top),30px)]': !isWeb }">
    <!-- game zone -->
    <div
      class="game-zone flex-none w-full aspect-square relative flex items-center justify-center overflow-hidden landscape:flex-1 landscape:aspect-[4/3] landscape:h-full landscape:w-auto landscape:max-w-full pointer-events-none z-10"
      :class="{ '!h-full !w-full !aspect-auto': fullscreen }">
      <div
        id="canvas-container"
        ref="canvasContainer"
        class="relative flex items-center justify-center p-1 w-full h-full aspect-square pointer-events-auto"
        :class="{ '!p-0': fullscreen }">
        <canvas
          class="aspect-square w-full h-full object-contain image-pixelated rounded-sm shadow-2xl bg-black"
          :class="{ 'shadow-black/50': isMenuOpen }"
          style="will-change: transform"
          id="canvas"
          oncontextmenu="event.preventDefault()"
          tabindex="-1"
          width="128"
          height="128"></canvas>

        <!-- pause menu overlay -->
        <div v-if="isMenuOpen" class="absolute inset-0 bg-black/60 backdrop-blur-xl z-[60] flex items-center justify-center">
          <!-- menu content -->
          <div class="flex flex-col gap-4 text-center p-8 landscape:p-4 landscape:gap-2 w-full max-w-xs max-h-screen overflow-y-auto">
            <h2 class="text-[clamp(1.5rem,5vw,2.5rem)] font-bold text-white mb-4 landscape:mb-2 tracking-widest drop-shadow-md font-pico">PAUSE</h2>

            <!-- dynamic menu buttons -->
            <button
              v-for="(btn, idx) in menuButtons"
              :key="btn.label"
              :id="'btn-' + idx"
              @click="triggerMenuAction(btn.action)"
              @touchend.prevent="triggerMenuAction(btn.action)"
              class="px-8 py-3 landscape:py-1 landscape:px-4 landscape:text-sm rounded-xl font-medium tracking-wider transition-colors w-full backdrop-blur-md focus:ring-4 focus:ring-white/50 outline-none font-pico uppercase text-[clamp(0.8rem,4vw,1rem)]"
              :class="[
                focusIndex === idx ? 'bg-white text-black scale-105 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20',
                btn.action === 'exit' ? 'border border-red-500/30' : '',
              ]">
              {{ btn.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- exit overlay -->
    <div v-if="isExiting" class="absolute inset-0 bg-black z-[100] transition-opacity duration-100 ease-out"></div>

    <!-- controller zone -->
    <div
      v-if="!fullscreen"
      class="controller-zone flex-1 relative w-full bg-black/90 backdrop-blur-xl landscape:absolute landscape:inset-0 landscape:bg-transparent landscape:backdrop-blur-none landscape:pointer-events-none z-20">
      <VirtualController @menu="toggleMenu" />
    </div>

    <!-- global toast usage -->
    <!-- saves drawer -->
    <SavesDrawer :isOpen="isSavesDrawerOpen" :cartName="activeCartName" @close="isSavesDrawerOpen = false" @load="handleStateLoad" />
  </div>
</template>

<script setup>
import { ImpactStyle } from '@capacitor/haptics';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SavesDrawer from '../components/SavesDrawer.vue';
import VirtualController from '../components/VirtualController.vue';
import { useToast } from '../composables/useToast';
import { inputManager } from '../services/InputManager';
import { libraryManager } from '../services/LibraryManager';
import { picoBridge } from '../services/PicoBridge';
import { useLibraryStore } from '../stores/library';
import { haptics } from '../utils/haptics';

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
const focusIndex = ref(0);
const isSavesDrawerOpen = ref(false);

import { App } from '@capacitor/app';

const { showToast } = useToast();
const { fullscreen } = storeToRefs(useLibraryStore());
const isWeb = computed(() => {
  return window.Capacitor.getPlatform() === 'web';
});

const activeCartName = ref(props.cartId === 'boot' ? 'boot' : props.cartId.replace('.p8.png', ''));

onMounted(async () => {
  // helper: verify binary injection
  const base64ToUint8Array = base64 => {
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      console.log(`[player] atob decoded len: ${len}. first byte charcode: ${binaryString.charCodeAt(0)}`);

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log(`[player] converted uint8array [0]: ${bytes[0]}, [1]: ${bytes[1]}`);
      return bytes;
    } catch (e) {
      console.error('[player] base64toUint8array crash', e);
      throw e;
    }
  };

  // hard reload strategy
  // if query param is missing, reload.
  const targetQuery = route.query.cart;

  if (!props.cartId || !targetQuery) {
    console.warn('[player] missing cart id, returning to library');
    router.push('/');
    return;
  }

  if (window.Module && window.Module.ccall && window.p8_is_running) {
    console.log('[player] engine running, forcing reload for new cart');
    window.location.reload();
    return;
  }

  try {
    // ensure library service is ready
    await libraryManager.init();

    // fetch data (player responsibility)
    let cartData = null;
    let payload = {};

    const rawData = await libraryManager.loadCartData(props.cartId);
    if (rawData) {
      console.log(`[player] Cart loaded: ${props.cartId}`);
      cartData = base64ToUint8Array(rawData);
    }

    if (!cartData) {
      throw new Error('No cart data found.');
    }

    // initialize payload
    payload[props.cartId] = cartData;

    // universal metadata check (run this for stashed carts too!)
    // if props.cartid is 'boot', we rely on stashedname for metadata lookup
    const metaKey = props.cartId === 'boot' ? stashedName : props.cartId;
    console.log(`[player] inspecting metadata for: ${metaKey} (universal check)`);

    const game = libraryManager.getMetadata(metaKey);

    if (game && game.subCarts && game.subCarts.length > 0) {
      console.log(`[player] bundle detected for ${metaKey}! loading ${game.subCarts.length} sub-carts...`);

      for (const subFile of game.subCarts) {
        console.log(`   -> loading sub-cart: ${subFile}`);
        const subBase64 = await libraryManager.loadCartData(subFile);

        if (subBase64) {
          payload[subFile] = base64ToUint8Array(subBase64);
        } else {
          console.warn(`   [warning] failed to load data for ${subFile}`);
        }
      }
    } else {
      console.log(`[player] no sub-carts found for ${metaKey}. single cart boot.`);
    }

    // stagger boot
    setTimeout(async () => {
      console.log('[player] booting via universal bundle mode.');
      await picoBridge.boot(props.cartId, payload);

      hookPicoQuit();

      setTimeout(() => {
        loading.value = false;
        if (route.query.state) {
          console.log('[player] deep link: auto-loading state:', route.query.state);
          setTimeout(async () => {
            await picoBridge.loadRAMState('Saves/' + route.query.state);
            showToast('AUTO-LOADED');
          }, 500); // grace period
        }
      }, 1500);
    }, 50);
  } catch (e) {
    console.error('Failed to load cart:', e);
    alert('Failed to load cartridge: ' + e.message);
    router.push('/');
  }
});

onUnmounted(async () => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  picoBridge.shutdown();

  if (inputCleanup.value) inputCleanup.value();
  inputManager.setMode('UI');

  App.removeAllListeners('backButton');
});

const menuButtons = computed(() => [
  { label: 'resume', action: 'resume' },
  { label: 'save state', action: 'manualsave' },
  { label: 'load state', action: 'managesaves' },
  { label: 'reset', action: 'reset' },
  { label: 'exit', action: 'exit' },
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
    inputManager.setMode('UI');
  } else {
    picoBridge.resume();
    inputManager.setMode('GAME');
  }
};

const triggerMenuAction = action => {
  console.log('[player] menu action triggered:', action);
  haptics.impact(ImpactStyle.Light).catch(() => {});
  if (action === 'resume') toggleMenu();
  if (action === 'manualsave') triggerManualSave();
  if (action === 'managesaves') isSavesDrawerOpen.value = true;
  if (action === 'reset') resetGame();
  if (action === 'exit') exitGame();
};

const handleStateLoad = async filename => {
  if (filename) {
    console.log('[player] loading state:', filename);
    await picoBridge.loadRAMState('Saves/' + filename);
    showToast('State Loaded');
    isMenuOpen.value = false;
    isSavesDrawerOpen.value = false;
    picoBridge.resume();
    inputManager.setMode('GAME');
  }
};

const triggerManualSave = async () => {
  // close menu immediately for better ux
  isMenuOpen.value = false;
  picoBridge.resume();
  inputManager.setMode('GAME');

  try {
    const base = activeCartName.value;
    const key = `pico_save_idx_${base}`;

    // index from localStorage to avoid readdir
    let nextIndex = parseInt(localStorage.getItem(key) || '0') + 1;

    // save new index
    localStorage.setItem(key, nextIndex.toString());

    // pattern: cartname_manual_N.state
    const saveName = `Saves/${base}_manual_${nextIndex}.state`;

    showToast('Saving...');

    const success = await window.picoBridge.captureFullRAMState(saveName);

    if (success) {
      showToast(`Saved Slot #${nextIndex}`);
    } else {
      showToast('Save Failed');
    }
  } catch (e) {
    console.error('Manual save failed', e);
    showToast('Save Error');
  }
};

function resetGame() {
  console.log('[player] hard resetting...');
  picoBridge.shutdown();
  setTimeout(() => {
    window.location.reload();
  }, 200);
}

async function exitGame() {
  // kill switch
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
      console.log('[player] pico-8 quit detected (internal)');
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
  if (e.key === 'Escape') {
    console.log('[player] input: escape');
    toggleMenu();
    return;
  }

  if (!isMenuOpen.value) return;
  if (isSavesDrawerOpen.value) return;

  console.log('[player] menu input:', e.key);

  if (e.key === 'ArrowUp') {
    focusIndex.value = (focusIndex.value - 1 + menuButtons.value.length) % menuButtons.value.length;
  } else if (e.key === 'ArrowDown') {
    focusIndex.value = (focusIndex.value + 1) % menuButtons.value.length;
  } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'x' || e.key === 'Z' || e.key === 'X') {
    console.log('[player] triggering action from key:', e.key);
    triggerMenuAction(menuButtons.value[focusIndex.value].action);
  }
}

// attach listener
const inputCleanup = ref(null);

onMounted(() => {
  // Switch to GAME mode initially
  inputManager.setMode('GAME');

  inputCleanup.value = inputManager.addListener((event, data) => {
    if (event === 'menu') {
      toggleMenu();
      return;
    }

    // Only handle UI events if menu is open (UI Mode)
    if (isMenuOpen.value && !isSavesDrawerOpen.value) {
      if (event === 'nav-up') {
        focusIndex.value = (focusIndex.value - 1 + menuButtons.value.length) % menuButtons.value.length;
      } else if (event === 'nav-down') {
        focusIndex.value = (focusIndex.value + 1) % menuButtons.value.length;
      } else if (event === 'confirm') {
        triggerMenuAction(menuButtons.value[focusIndex.value].action);
      } else if (event === 'back') {
        toggleMenu();
      }
    }
  });

  // android back button
  App.addListener('backButton', data => {
    console.log('[player] back button pressed. canGoBack:', data.canGoBack);
    if (isMenuOpen.value) {
      // close menu if open
      toggleMenu();
    } else {
      // ehh
      toggleMenu();
    }
  });
});
</script>

<style>
.image-pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* fix for cube aspect ratios to remove portrait padding */
@media (min-aspect-ratio: 0.95) and (max-aspect-ratio: 1.05) {
  .portrait\:pt-\[max\(env\(safe-area-inset-top\)\,30px\)\] {
    padding-top: 0 !important;
  }
}
</style>
