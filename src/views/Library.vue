<template>
  <div
    class="min-h-screen bg-[var(--color-oled-black)] relative no-scrollbar transition-colors overflow-y-auto"
  >
    <!-- mesh gradient background -->
    <div class="fixed inset-0 z-0 pointer-events-none">
      <div
        class="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-800/60 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"
      ></div>
      <div
        class="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-800/50 rounded-full blur-[100px] mix-blend-screen"
      ></div>
    </div>

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
    >
      <!-- header -->
      <!-- fix: aggressive z-index to beat global toast -->
      <div
        class="flex flex-col gap-6 mb-8 px-2 !relative !z-[100] !pointer-events-auto"
      >
        <!-- title & actions -->
        <div class="flex justify-between items-center">
          <div class="flex flex-col">
            <h1
              class="text-3xl font-bold tracking-tight text-white/90 drop-shadow-sm"
            >
              Library
            </h1>
            <span
              class="text-xs font-medium text-white/40 tracking-wider uppercase mt-1"
            >
              {{ games.length }} Cartridges
            </span>
          </div>

          <div class="flex gap-3">
            <!-- import button -->
            <button
              @click="triggerImport"
              class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105 !relative !z-[9999] !pointer-events-auto"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-white/80"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>

            <!-- bbs button -->
            <button
              @click="openOfficialBBS"
              class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-white/80"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </button>

            <!-- settings button -->
            <button
              @click="$router.push('/settings')"
              class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-white/80"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- search & filter -->
        <div class="flex gap-3">
          <div class="relative flex-1 group">
            <div
              class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
            >
              <svg
                class="h-4 w-4 text-white/40 group-focus-within:text-purple-400 transition-colors"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full pl-10 pr-3 py-2.5 border border-white/10 rounded-xl leading-5 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 sm:text-sm transition-all"
              placeholder="Search cartridges..."
            />
          </div>

          <div class="relative">
            <select
              v-model="sortBy"
              class="appearance-none bg-white/5 border border-white/10 text-white py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:bg-white/10 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 text-sm transition-all h-full"
            >
              <option
                v-for="opt in sortOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/40"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

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
            class="w-12 h-12 mb-4 opacity-50 text-white"
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
          <p class="text-white/60 font-medium">No cartridges found</p>
          <p class="text-white/30 text-sm mt-1">
            Import a .p8.png cartridge to get started
          </p>
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
          class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 justify-center"
        >
          <div
            v-for="(game, index) in favorites"
            :key="game.filename"
            @click="openGame(game)"
            @touchstart="startLongPress(game)"
            @touchend="cancelLongPress"
            @touchmove="cancelLongPress"
            @mousedown="handleMouseDown(game, $event)"
            @mouseup="cancelLongPress"
            @mouseleave="cancelLongPress"
            @contextmenu.prevent
            class="group relative aspect-[4/5] rounded-2xl cursor-pointer transition-all duration-500"
            :class="
              deleteMode
                ? 'animate-wiggle'
                : 'hover:scale-[1.03] hover:shadow-2xl hover:shadow-pink-500/20'
            "
          >
            <!-- heart icon (always visible for favorites) -->
            <div
              class="absolute -top-2 -right-2 z-20 transition-transform duration-300 hover:scale-110"
            >
              <button
                @click.stop="handleFavorite(game, $event)"
                class="rounded-full p-1.5 shadow-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <!-- edit controls overlay -->
            <template v-if="deleteMode">
              <div class="absolute -top-2 -left-2 z-20">
                <button
                  @click.stop="openRenameModal(game)"
                  class="bg-blue-500 text-white rounded-full p-1 shadow-lg hover:bg-blue-600 transition-colors transform hover:scale-110"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </div>
            </template>

            <!-- card content -->
            <div
              class="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg z-0"
            >
              <img
                v-if="game.cover"
                :src="game.cover"
                alt="Cover"
                class="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent"
              >
                <!-- placeholder svg -->
                <svg
                  class="w-12 h-12 opacity-20 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <!-- title band -->
              <div
                class="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12"
              >
                <h3
                  class="text-white font-medium text-sm truncate drop-shadow-md transform transition-transform translate-y-1 group-hover:translate-y-0"
                >
                  {{ formatName(game.name) }}
                </h3>
              </div>
            </div>
          </div>
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
        class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6"
      >
        <div
          v-for="(game, index) in nonFavorites"
          :key="game.filename"
          @click="openGame(game)"
          @touchstart="startLongPress(game)"
          @touchend="cancelLongPress"
          @touchmove="cancelLongPress"
          @mousedown="handleMouseDown(game, $event)"
          @mouseup="cancelLongPress"
          @mouseleave="cancelLongPress"
          @contextmenu.prevent
          class="group relative aspect-[4/5] rounded-2xl cursor-pointer transition-all duration-500"
          :class="
            deleteMode
              ? 'animate-wiggle'
              : 'hover:scale-[1.03] hover:shadow-2xl hover:shadow-purple-500/20'
          "
        >
          <!-- controls overlay (delete mode) -->
          <template v-if="deleteMode">
            <!-- favorite toggle (gray) -->
            <div class="absolute -top-2 -right-2 z-20">
              <button
                @click.stop="handleFavorite(game, $event)"
                class="rounded-full p-1.5 shadow-lg bg-gray-500/80 text-white/50 hover:bg-pink-500 hover:text-white transition-all transform hover:scale-110"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <!-- rename -->
            <div class="absolute -top-2 -left-2 z-20">
              <button
                @click.stop="openRenameModal(game)"
                class="bg-blue-500 text-white rounded-full p-1 shadow-lg hover:bg-blue-600 transition-colors transform hover:scale-110"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>

            <!-- delete -->
            <div
              class="absolute -bottom-2 -right-2 z-20"
              v-if="nonFavorites.length > 0"
            >
              <button
                @click.stop="handleDelete(game, $event)"
                class="bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors transform hover:scale-110"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </template>

          <!-- card content -->
          <div
            class="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg z-0"
          >
            <img
              v-if="game.cover"
              :src="game.cover"
              alt="Cover"
              class="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent"
            >
              <svg
                class="w-12 h-12 opacity-20 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <!-- title band -->
            <div
              class="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12"
            >
              <h3
                class="text-white font-medium text-sm truncate drop-shadow-md transform transition-transform translate-y-1 group-hover:translate-y-0"
              >
                {{ formatName(game.name) }}
              </h3>
            </div>
          </div>
        </div>
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
            @keyup.enter="confirmRename"
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
        Pocket8 v1.4
      </p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, reactive, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useLibraryStore } from "../stores/library";
import { storeToRefs } from "pinia";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { libraryManager } from "../services/LibraryManager";

const router = useRouter();
const libraryStore = useLibraryStore();
// fix: initialize games as safe computed/ref to prevent crash if store is empty
const { loading, searchQuery, sortBy, swapButtons, useJoystick, rootDir } =
  storeToRefs(libraryStore);
const games = computed(() => libraryStore.games || []);

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

// split lists
const favorites = computed(() => games.value.filter((g) => g.isFavorite));
const nonFavorites = computed(() => games.value.filter((g) => !g.isFavorite));

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

const sortOptions = [
  { label: "Recently Played", value: "lastPlayed" },
  { label: "Name (A-Z)", value: "name" },
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Play Count", value: "playCount" },
];

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
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  fileInput.value.click();
}

function openOfficialBBS() {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  // the magic url provided by zep to set the cookie
  const url =
    "https://www.lexaloffle.com/bbs/?cat=7#sub=2&mode=carts&orderby=featured&ios_player=pocket8";

  // open in system browser to ensure cookies are set globally for safari
  window.open(url, "_system");
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
      Haptics.notification({ type: "success" }).catch(() => {});
      alert(`Success! ${total} cartridges loaded.`);
    } else {
    }
  } catch (e) {
    console.error(e);
    Haptics.notification({ type: "error" }).catch(() => {});
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
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
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
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  deleteMode.value = !deleteMode.value;
}

async function handleFavorite(game, event) {
  event?.stopPropagation(); // optional chaining in case validation triggers locally
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  await toggleFavorite(game);
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

  const success = await renameCartridge(game, newName);
  if (success) {
    Haptics.notification({ type: "success" }).catch(() => {});
    console.log(`[library] renamed via modal -> ${newName}`);
  }
}

async function handleDelete(game, event) {
  event.stopPropagation();

  // ask first
  if (confirm(`Delete ${game.name}? This cannot be undone.`)) {
    // action
    await removeCartridge(game.filename);
    // feedback
    Haptics.notification({ type: "success" }).catch(() => {});
  }
}

function formatName(filename) {
  return filename
    .replace(/\.p8(\.png)?$/, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ");
}

const formatDate = (ms) => new Date(ms).toLocaleDateString();

async function openGame(game) {
  if (deleteMode.value) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});

  // update last played
  await libraryManager.updateLastPlayed(game.name);

  // memory stream handoff
  try {
    const data = await libraryManager.loadCartData(game.filename);

    // stash
    if (data) {
      localStorage.setItem("pico_handoff_payload", data);
      localStorage.setItem("pico_handoff_name", game.filename);
      console.log(
        `[library] stashed ${game.filename} for handoff. payload length: ${data.length}`
      );
    } else {
      console.error(
        `[library] critical: read file but data is null/undefined! path: carts/${game.filename}`
      );
      alert("error: could not read cartridge data.");
      return;
    }

    // navigate
    window.location.href = `index.html?cart=boot&boot=1&t=${Date.now()}`;
  } catch (e) {
    console.error(`[library] pre-load read failed: ${e.message}`);
    alert(`failed to load ${game.name}: ${e.message}`);
  }
}
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
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
.list-leave-active {
  position: absolute;
  width: 100%;
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
