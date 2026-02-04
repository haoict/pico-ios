<template>
  <div
    class="min-h-screen bg-pico-gradient relative no-scrollbar transition-colors overflow-y-auto"
  >
    <!-- hidden file input -->
    <input
      type="file"
      ref="fileInput"
      multiple
      accept=".p8,.p8.png,.png,.lua,.txt"
      class="hidden"
      @change="handleFileImport"
    />

    <!-- content -->
    <div
      class="relative z-10 p-6 pt-16 pb-32 max-w-7xl mx-auto w-full min-h-[calc(100vh+1px)]"
      @click="handleBackgroundClick"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- pull refresh indicator -->
      <div
        class="fixed top-20 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 pointer-events-none flex items-center gap-2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10"
        :style="{
          opacity: pullProgress > 0 ? 1 : 0,
          transform: `translate(-50%, ${pullProgress * 50}px) scale(${
            0.8 + pullProgress * 0.2
          })`,
        }"
      >
        <svg
          class="w-4 h-4 text-white animate-spin"
          v-if="isRefreshing"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <svg
          v-else
          class="w-4 h-4 text-white rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          ></path>
        </svg>
        <span class="text-xs font-bold text-white uppercase tracking-widest">{{
          isRefreshing ? "Refreshing..." : "Pull to Scan"
        }}</span>
      </div>

      <!-- header -->
      <LibraryHeader
        v-model:searchQuery="searchQuery"
        v-model:sortBy="sortBy"
        v-model:sortDropdownOpen="sortDropdownOpen"
        v-model:headerFocusIndex="headerFocusIndex"
        v-model:gridSize="gridSize"
        :gamesCount="games.length"
        @import="triggerImport"
        @open-bbs="openOfficialBBS"
        @open-bbs-explorer="openBBSExplorer"
        @open-settings="$router.push('/settings')"
        @keydown="handleHeaderNav"
        @scroll-to-top="scrollToTop"
      />

      <!-- loading state -->
      <transition name="fade">
        <div
          v-if="loading"
          class="flex flex-col items-center justify-center py-20"
        >
          <div
            class="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mb-4"
          ></div>
          <span class="text-white/30 text-sm tracking-widest uppercase">
            {{ importProgress || "Scanning" }}
          </span>
          <span
            v-if="scanProgress.show"
            class="text-white/50 text-xs mt-2 font-mono"
          >
            Processing {{ scanProgress.current }} / {{ scanProgress.total }}
          </span>
        </div>
      </transition>

      <!-- empty state -->
      <transition name="fade">
        <div
          v-if="!loading && games.length === 0"
          class="flex flex-col items-center justify-center py-20 text-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-12 h-12 mb-4 opacity-50 text-white pixelated"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
            />
          </svg>

          <!-- android setup -->
          <div
            v-if="games.length === 0"
            class="flex flex-col items-center gap-4 px-6"
          >
            <p class="text-white/60 font-medium">Library Setup</p>
            <p
              v-if="isAndroid"
              class="text-white/30 text-sm max-w-xs leading-relaxed"
            >
              Import a game above or sync with an external folder.
            </p>
            <p v-else class="text-white/30 text-sm max-w-xs leading-relaxed">
              Import a game above to get started.
            </p>

            <button
              v-if="isAndroid"
              @click="pickExternalFolder"
              class="mt-2 px-6 py-3 bg-white/10 rounded-full font-bold text-sm tracking-wide active:bg-white/20 transition-all flex items-center gap-2 border border-white/5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 opacity-70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                />
              </svg>
              Sync External Folder
            </button>
          </div>
        </div>
      </transition>

      <!-- favorites section -->
      <transition-group
        name="list"
        tag="div"
        class="mb-8"
        v-if="favorites.length > 0"
      >
        <div key="fav-header" class="flex flex-col items-center mb-6">
          <div class="flex items-center gap-2 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-pink-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clip-rule="evenodd"
              />
            </svg>
            <span
              class="text-xs font-bold tracking-[0.2em] text-pink-500 uppercase"
              >favorites</span
            >
          </div>
        </div>

        <div
          key="fav-grid"
          class="grid gap-6 justify-center"
          :class="{
            'grid-cols-3': gridSize === 'S',
            'grid-cols-2': gridSize === 'M',
            'grid-cols-1': gridSize === 'L'
          }"
        >
          <GameCard
            v-for="(game, index) in favorites"
            :key="game.filename"
            :ref="(el) => setItemRef(el, index)"
            :game="game"
            :index="index"
            :is-focused="focusedIndex === index"
            :delete-mode="deleteMode"
            :card-menu-open="game.filename === cardMenuGameId"
            :card-menu-btn-index="cardMenuBtnIndex"
            :is-favorite="true"
            @click="openGame"
            @long-press-start="startLongPress"
            @long-press-cancel="cancelLongPress"
            @mousedown="handleMouseDown"
            @favorite="handleFavorite"
            @rename="openRenameModal"
            @delete="handleDelete"
          />
        </div>
      </transition-group>

      <!-- formatting divider -->
      <div v-if="favorites.length > 0" class="relative py-8 flex items-center">
        <div class="flex-grow border-t border-white/5"></div>
        <span
          class="flex-shrink-0 mx-4 text-white/20 text-[10px] uppercase tracking-widest"
          >all games</span
        >
        <div class="flex-grow border-t border-white/5"></div>
      </div>
      <!-- end divider -->

      <!-- main library grid -->
      <transition-group
        name="list"
        tag="div"
        class="grid gap-6"
        :class="{
          'grid-cols-3': gridSize === 'S',
          'grid-cols-2': gridSize === 'M',
          'grid-cols-1': gridSize === 'L'
        }"
      >
        <GameCard
          v-for="(game, index) in nonFavorites"
          :key="game.filename"
          :ref="(el) => setItemRef(el, favorites.length + index)"
          :game="game"
          :index="favorites.length + index"
          :is-focused="focusedIndex === favorites.length + index"
          :delete-mode="deleteMode"
          :card-menu-open="game.filename === cardMenuGameId"
          :card-menu-btn-index="cardMenuBtnIndex"
          :is-favorite="false"
          @click="openGame"
          @long-press-start="startLongPress"
          @long-press-cancel="cancelLongPress"
          @mousedown="handleMouseDown"
          @favorite="handleFavorite"
          @rename="openRenameModal"
          @delete="handleDelete"
        />
      </transition-group>
    </div>

    <!-- rename modal -->
    <transition name="fade">
      <div
        v-if="showRenameModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="closeRenameModal"
      >
        <div
          class="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all"
        >
          <h3 class="text-lg font-bold text-white mb-2">Rename Cartridge</h3>
          <p class="text-white/50 text-sm mb-4">
            Enter a new name for this game.
          </p>
          <input
            v-model="renameInput"
            ref="renameInputRef"
            type="text"
            class="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all mb-6"
            @keydown.enter.stop.prevent="confirmRename"
          />
          <div class="flex justify-end gap-3">
            <button
              @click="closeRenameModal"
              class="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              @click="confirmRename"
              class="px-4 py-2 rounded-lg bg-white text-black hover:scale-105 active:scale-95 transition-all font-bold text-sm shadow-lg shadow-white/10"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- versions footer -->
    <div class="mt-12 mb-6 text-center opacity-30">
      <p class="text-[10px] font-mono uppercase tracking-widest">
        Pocket8 v{{ appVersion }}
      </p>
    </div>
  </div>
</template>

<script setup>
import {
  onMounted,
  onUnmounted,
  ref,
  computed,
  reactive,
  nextTick,
  unref,
  watch,
} from "vue";
import { useRouter, useRoute } from "vue-router";
import { useLibraryStore } from "../stores/library";
import { storeToRefs } from "pinia";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { haptics } from "../utils/haptics";
import { ImpactStyle } from "@capacitor/haptics";
import { libraryManager } from "../services/LibraryManager";
import { Capacitor } from "@capacitor/core";
import { useFocusable } from "../composables/useFocusable";
import { useLibraryNavigation } from "../composables/useLibraryNavigation";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { inputManager } from "../services/InputManager";
import { ScopedStorage } from "@daniele-rolli/capacitor-scoped-storage";
import { Browser } from "@capacitor/browser";
import packageJson from "../../package.json";
import GameCard from "../components/GameCard.vue";
import LibraryHeader from "../components/LibraryHeader.vue";

const router = useRouter();
const route = useRoute();
const appVersion = packageJson.version;

const width = ref(window.innerWidth);
const gridSize = ref(localStorage.getItem('pico_library_grid_size') || 'M');

// grid cols
const gridColumns = computed(() => {
  if (gridSize.value === 'S') return 3;
  if (gridSize.value === 'M') return 2;
  if (gridSize.value === 'L') return 1;
  // fallback to responsive
  if (width.value >= 1024) return 5;
  if (width.value >= 768) return 4;
  return 3;
});

const updateWidth = () => {
  width.value = window.innerWidth;
};
onMounted(() => window.addEventListener("resize", updateWidth));
onUnmounted(() => window.removeEventListener("resize", updateWidth));

watch(gridSize, (newSize) => {
  localStorage.setItem('pico_library_grid_size', newSize);
});

const libraryStore = useLibraryStore();
// init games as safe computed/ref to prevent crash if store is empty
const {
  games,
  loading,
  searchQuery,
  sortBy,
  swapButtons,
  hapticsEnabled,
  rootDir,
  scanProgress,
} = storeToRefs(libraryStore);

// pull to refresh
const startY = ref(0);
const pullProgress = ref(0);
const isRefreshing = ref(false);

const handleTouchStart = (e) => {
  if (window.scrollY <= 10 && !isRefreshing.value) {
    startY.value = e.touches[0].clientY;
  }
};

const handleTouchMove = (e) => {
  if (startY.value && window.scrollY <= 10 && !isRefreshing.value) {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.value;
    if (diff > 0) {
      // resistance
      pullProgress.value = Math.min(diff / 200, 1.5);
    }
  }
};

const handleTouchEnd = async () => {
  if (pullProgress.value > 0.8 && !isRefreshing.value) {
    isRefreshing.value = true;
    haptics.impact(ImpactStyle.Medium).catch(() => {});

    // trigger full refresh
    await libraryStore.loadLibrary(true);

    // reset
    setTimeout(() => {
      isRefreshing.value = false;
      pullProgress.value = 0;
      startY.value = 0;
      haptics.success();
    }, 500);
  } else {
    // bounce back
    pullProgress.value = 0;
    startY.value = 0;
  }
};

const {
  loadLibrary,
  addCartridge,
  addBundle,
  removeCartridge,
  toggleFavorite,
  renameCartridge,
  toggleSwapButtons,
  toggleJoystick,
  updateRootDirectory,
} = libraryStore;

const favorites = computed(() => games.value.filter((g) => g.isFavorite));
const nonFavorites = computed(() => games.value.filter((g) => !g.isFavorite));

const displayGames = computed(() => [
  ...favorites.value,
  ...nonFavorites.value,
]);

// card menu
const cardMenuGameId = ref(null); // filename of the game with open menu

// Sort options for LibraryHeader
const sortOptions = [
  { label: "Recently Played", value: "lastPlayed" },
  { label: "Name (A-Z)", value: "name" },
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Play Count", value: "playCount" },
];

// Initialize navigation composable
const {
  headerFocusIndex,
  cardMenuBtnIndex,
  isTransitioning,
  headerEntryTime,
  menuCloseTimestamp,
  navigateHeader,
  enterHeader,
  exitHeader,
  openCardMenu,
  closeCardMenu,
  navigateCardMenu,
  handleSortNav,
  handleInputKeyboard,
  handleCardMenuKeyboard,
  routeGamepadInput,
} = useLibraryNavigation({
  sortOptions,
  sortBy,
  sortDropdownOpen,
  searchQuery,
  games,
  displayGames,
  focusedIndex: ref(0), // Will be replaced by useFocusable
  cardMenuGameId,
  showRenameModal,
  deleteMode,
});

const gridInputEnabled = computed(
  () =>
    !cardMenuGameId.value &&
    !sortDropdownOpen.value &&
    !showRenameModal.value &&
    !deleteMode.value,
);

// Use the new composable
const { focusedIndex, setItemRef } = useFocusable({
  items: displayGames,
  columns: gridColumns,
  enabled: gridInputEnabled,
  onSelect: (game) => {
    // prevent double activation if menu just closed
    if (Date.now() - menuCloseTimestamp.value < 400) return;
    openGame(game);
  },
  onMenu: () => {
    router.push("/settings");
  },

  onUpOut: () => {
    // enter header (focus search by default)
    enterHeader(0);
  },
  enabled: computed(
    () =>
      headerFocusIndex.value === -1 &&
      !cardMenuGameId.value &&
      !sortDropdownOpen.value &&
      !isTransitioning.value,
  ),
});

// card menu navigation logic
const sortDropdownOpen = ref(false);

// Header keyboard navigation - use composable
const handleHeaderNav = (e) => {
  handleInputKeyboard(e);
};

// Trigger header action based on index
const triggerHeaderAction = (idx) => {
  if (idx === 0) {
    // search: focus input
    const input = document.querySelector('input[type="text"]');
    input?.focus();
  } else if (idx === 1) {
    // sort: handled by dropdown
  } else if (idx === 2) triggerImport();
  else if (idx === 3) openOfficialBBS();
  else if (idx === 4) router.push("/settings");
  else if (idx === 5) openBBSExplorer();
};

const isAndroid = computed(() => Capacitor.getPlatform() === "android");
const needsDirectorySetup = computed(() => isAndroid.value && games.value.length === 0);

async function pickExternalFolder() {
  haptics.impact(ImpactStyle.Light).catch(() => {});

  // guardrail
  alert(
    "Note: Android ensures privacy by restricting access to 'Downloads' and 'Android' folders.\n\nPlease select a dedicated folder (e.g., 'Roms' or 'Games').",
  );

  try {
    const { folder } = await ScopedStorage.pickFolder();

    if (folder) {
      if (
        confirm(
          `Index games from '${folder.name}'? This will add references without copying files.`,
        )
      ) {
        const success = await libraryStore.addExternalSource(folder);
        if (success) {
          haptics.success();
        } else {
          alert("Sync Failed. Please try again.");
        }
      }
    }
  } catch (e) {
    if (e.message !== "User cancelled" && e.message !== "canceled") {
      alert("Failed to pick directory: " + e.message);
    }
  }
}
// split lists
const hasFavorites = computed(() => favorites.value.length > 0);

const fileInput = ref(null);
const showRenameModal = ref(false);
const renameInput = ref("");
const renameInputRef = ref(null);
const currentRenamingGame = ref(null);

const showDeleteConfirm = ref(false);
const deleteMode = ref(false);
const importProgress = ref("");
let longPressTimer = null;

onMounted(async () => {
  console.log("[library] mounting...");
  try {
    const loadedGames = await loadLibrary();
    // silent ship protocol
    console.log(`[library] loaded ${loadedGames.length} cartridges.`);
  } catch (e) {
    console.error("[library] load failed:", e);
  }
});

function triggerImport() {
  haptics.impact(ImpactStyle.Light).catch(() => {});
  fileInput.value.click();
}

function openOfficialBBS() {
  haptics.impact(ImpactStyle.Light).catch(() => {});
  // the magic url provided by zep to set the cookie
  const url =
    "https://www.lexaloffle.com/bbs/?cat=7#sub=2&mode=carts&orderby=featured&ios_player=pocket8";

  // open in system browser to set BBS cookie
  if (Capacitor.getPlatform() === "android") {
    Browser.open({ url: url, windowName: "_system" });
  } else {
    // ios and legacy web
    window.open(url, "_system");
  }
}

function openBBSExplorer() {
  haptics.impact(ImpactStyle.Light).catch(() => {});
  router.push("/bbs");
}

async function handleFileImport(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // ui feedback
  loading.value = true;
  const total = files.length;
  console.log(`[library] batch importing ${total} files...`);

  // use new session bundler
  // checks if multiple files are selected, or just passes the list
  try {
    const success = await addBundle(files);
    if (success) {
      haptics.success().catch(() => {});
      alert(`Success! ${total} cartridges loaded.`);
    } else {
    }
  } catch (e) {
    console.error(e);
    haptics.notification({ type: "error" }).catch(() => {});
    alert(e.message); // show specific error
  }

  // cleanup
  loading.value = false;
  importProgress.value = "";
  event.target.value = ""; // reset input
}

// long press logic
function handleMouseDown(game, event) {
  // only left click triggers long press
  if (event.button === 0) {
    startLongPress(game);
  }
}

function startLongPress(game) {
  if (deleteMode.value) return;
  longPressTimer = setTimeout(() => {
    haptics.impact(ImpactStyle.Heavy).catch(() => {});
    deleteMode.value = true;
  }, 500);
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function handleBackgroundClick(e) {
  if (deleteMode.value) {
    deleteMode.value = false;
  }
}

async function startDeleteMode() {
  haptics.impact(ImpactStyle.Medium).catch(() => {});
  deleteMode.value = !deleteMode.value;
}

async function handleFavorite(game, event) {
  event?.stopPropagation(); // optional chaining in case validation triggers locally
  haptics.impact(ImpactStyle.Light).catch(() => {});
  await toggleFavorite(game);

  // if card menu was open, close it and follow the game if it moved
  if (cardMenuGameId.value === game.filename) {
    closeCardMenu();
    // find new index
    const idx = displayGames.value.findIndex(
      (g) => g.filename === game.filename,
    );
    if (idx !== -1) focusedIndex.value = idx;
  }
}

function openRenameModal(game) {
  currentRenamingGame.value = game;
  const currentName =
    game.displayName || game.name.replace(/(\.p8\.png|\.p8|\.png)$/i, "");
  renameInput.value = currentName;
  showRenameModal.value = true;

  // focus input
  nextTick(() => {
    if (renameInputRef.value) {
      renameInputRef.value.focus();
      renameInputRef.value.select();
    }
  });
}

function closeRenameModal() {
  showRenameModal.value = false;
  currentRenamingGame.value = null;
  renameInput.value = "";
}

async function confirmRename() {
  if (!renameInput.value.trim() || !currentRenamingGame.value) {
    closeRenameModal();
    return;
  }

  const newName = renameInput.value.trim();
  const game = currentRenamingGame.value;

  closeRenameModal(); // close first for responsiveness
  closeCardMenu(); // force unfocus

  const success = await renameCartridge(game, newName);
  if (success) {
    haptics.success().catch(() => {});
    console.log(`[library] renamed via modal -> ${newName}`);
    // find new index
    const reFound = displayGames.value.find(
      (g) => g.name === newName || g.filename === game.filename,
    );
    if (reFound) {
      const idx = displayGames.value.indexOf(reFound);
      if (idx !== -1) focusedIndex.value = idx;
    }
  }
}

async function handleDelete(game, event) {
  event?.stopPropagation();

  // ask first
  if (confirm(`Delete ${game.name}? This cannot be undone.`)) {
    // action
    const success = await removeCartridge(game.filename);
    // feedback
    haptics.success().catch(() => {});
    if (success) closeCardMenu();
  }
}

const formatDate = (ms) => new Date(ms).toLocaleDateString();

async function openGame(game) {
  if (deleteMode.value) return;
  haptics.impact(ImpactStyle.Light).catch(() => {});
  await libraryManager.updateLastPlayed(game.filename);
  router.push({ name: "player", query: { cart: game.filename } });
}

const listenerCleanup = ref(null);

// Define handlers for card menu keyboard navigation
const _handleCardMenuKeyboard = (e) => {
  if (!cardMenuGameId.value || showRenameModal.value) return;

  // Use composable for navigation
  handleCardMenuKeyboard(e);

  // Handle confirm actions locally
  if (["Enter", " ", "z", "Z", "x", "X"].includes(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const game = games.value.find((g) => g.filename === cardMenuGameId.value);
    if (!game) return;

    if (cardMenuBtnIndex.value === 0) {
      handleFavorite(game);
    } else if (cardMenuBtnIndex.value === 1) {
      openRenameModal(game);
    } else if (cardMenuBtnIndex.value === 2) {
      handleDelete(game);
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleHeaderNav);
  window.addEventListener("keydown", _handleCardMenuKeyboard);
  listenerCleanup.value = inputManager.addListener(handleGamepadInput);
});

onUnmounted(() => {
  if (listenerCleanup.value) listenerCleanup.value();
});

// watch for sort dropdown to lock body scroll
watch(sortDropdownOpen, (isOpen) => {
  document.body.style.overflow = isOpen ? "hidden" : "";
});

// watch for route changes to reset state when returning to library

watch(
  () => route.path,
  (newPath) => {
    if (newPath === "/") {
      headerFocusIndex.value = -1;
      sortDropdownOpen.value = false;
    }
  },
);

// Use composable for gamepad input routing
const handleGamepadInput = (action) => {
  routeGamepadInput(action, {
    onHeaderAction: (idx) => triggerHeaderAction(idx),
    onCardMenuConfirm: (game, btnIndex) => {
      if (btnIndex === 0) {
        handleFavorite(game);
      } else if (btnIndex === 1) {
        openRenameModal(game);
        closeCardMenu();
      } else if (btnIndex === 2) {
        handleDelete(game);
      }
    },
    onEmptyStateConfirm: () => {
      if (needsDirectorySetup.value) {
        pickAndroidDirectory();
      }
    },
  });
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};
</script>

<style scoped>
.block {
  display: block;
}

/* transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* staggered fade transition */
.staggered-fade-enter-active {
  transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  transition-delay: calc(var(--index) * 50ms);
}
.staggered-fade-leave-active {
  transition: all 0.3s ease;
}

.staggered-fade-enter-from,
.staggered-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* list transitions */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.list-leave-active {
  position: absolute;
}

/* custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

/* ios jiggle */
@keyframes wiggle {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-0.5deg);
  }
  75% {
    transform: rotate(0.5deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

.animate-wiggle {
  animation: wiggle 0.3s linear infinite;
}
</style>
