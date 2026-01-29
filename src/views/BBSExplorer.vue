<template>
  <div class="min-h-screen bg-[var(--color-oled-black)] relative overflow-y-auto no-scrollbar">
    <!-- mesh gradient background -->
    <div class="fixed inset-0 z-0 pointer-events-none">
      <div
        class="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-pink-900/30 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow">
      </div>
      <div
        class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[100px] mix-blend-screen">
      </div>
    </div>

    <!-- content -->
    <div class="relative z-10 p-6 pt-16 pb-32 max-w-7xl mx-auto w-full">
      <!-- header -->
      <div class="flex flex-col gap-4 mb-4 px-2">
        <!-- title & back -->
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-4">
            <button @click="router.back()"
              class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div class="flex flex-col">
              <h1 class="font-pico-crisp text-white drop-shadow-md text-[clamp(1.5rem,5vw,3rem)]">
                BBS Explorer
              </h1>
              <span class="font-pico-crisp text-xs font-medium text-white/40 tracking-wider uppercase mt-1">
                Lexaloffle PICO-8
              </span>
            </div>
          </div>
        </div>

        <!-- search & filter -->
        <div class="flex flex-col md:flex-row gap-3">
          <!-- main search -->
          <div class="relative flex-1 group">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-4 w-4 text-white/40 group-focus-within:text-pink-400 transition-colors"
                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clip-rule="evenodd" />
              </svg>
            </div>
            <input v-model="searchQuery" @keydown.enter="performSearch" type="text"
              class="block w-full pl-10 pr-3 py-2.5 border border-white/10 rounded-xl leading-5 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 sm:text-sm transition-all"
              placeholder="Search BBS..." />
          </div>

          <!-- segmented control -->
          <div class="bg-white/5 p-1 rounded-xl flex border border-white/10">
            <button v-for="tab in ['Featured', 'New', 'Popular', 'Lucky']" :key="tab" @click="switchTab(tab)"
              class="flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all" :class="activeTab === tab
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
                ">
              {{ tab }}
            </button>
          </div>
        </div>
      </div>

      <!-- loading state -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20">
        <div class="w-8 h-8 rounded-full border-2 border-white/20 border-t-pink-500 animate-spin mb-4"></div>
        <span class="text-white/30 text-sm tracking-widest uppercase">
          Fetching Cartridges
        </span>
      </div>

      <!-- empty state -->
      <div v-if="!loading && games.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
        <p class="text-white/60 font-medium">No results found</p>
        <p class="text-white/30 text-sm mt-1">Try a different search term</p>
      </div>

      <!-- pagination top -->
      <div v-if="!loading" class="flex items-center justify-center gap-3 mb-4">
        <button @click="previousPage" :disabled="currentPage === 1"
          class="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-medium transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">
          ← Prev
        </button>

        <input v-model.number="pageInput" @keydown.enter="goToPage" @blur="goToPage" @focus="$event.target.select()"
          type="number" min="1"
          class="w-[70px] px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium text-center focus:outline-none focus:border-pink-500/50 focus:bg-white/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />

        <button @click="nextPage" :disabled="games.length <= 0"
          class="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-medium transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">
          Next →
        </button>

        <button @click="cycleGridSize"
          class="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white transition-all active:scale-95 hover:bg-white/20 flex items-center justify-center"
          :title="`Grid: ${gridSize === 'S' ? '3 columns' : gridSize === 'M' ? '2 columns' : '1 column'}`">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <rect v-if="gridSize === 'S'" x="3" y="8" width="5" height="8" rx="1" />
            <rect v-if="gridSize === 'S'" x="9.5" y="8" width="5" height="8" rx="1" />
            <rect v-if="gridSize === 'S'" x="16" y="8" width="5" height="8" rx="1" />
            <rect v-if="gridSize === 'M'" x="3" y="3" width="8" height="18" rx="1" />
            <rect v-if="gridSize === 'M'" x="13" y="3" width="8" height="18" rx="1" />
            <rect v-if="gridSize === 'L'" x="3" y="3" width="18" height="18" rx="1" />
          </svg>
        </button>
      </div>

      <!-- grid -->
      <div class="grid gap-6" :class="{
        'grid-cols-3': gridSize === 'S',
        'grid-cols-2': gridSize === 'M',
        'grid-cols-1': gridSize === 'L'
      }">
        <div v-for="(game, index) in games" :key="game.id" 
          @click.stop.prevent="showContextMenu(game, $event)"
          @touchstart="handleTouchStart(game, $event)"
          @touchend="handleTouchEnd"
          @touchmove="handleTouchEnd"
          class="group relative aspect-[5/5] rounded-2xl cursor-pointer transition-all duration-300"
          :style="{ '--index': index }">
          <!-- card container -->
          <div
            class="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg z-0">
            <!-- cover art -->
            <img :src="game.thumb_url" alt="Cover"
              class="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
              loading="lazy" />

            <!-- title band -->
            <div
              class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-6">
              <h3 class="text-white font-medium text-xs truncate drop-shadow-md">
                {{ game.title }}
              </h3>
              <p class="text-white/50 text-[10px] truncate">
                {{ game.author }}
              </p>
            </div>

            <!-- download overlay -->
            <div v-if="downloadingId === game.id"
              class="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
              <div class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- pagination bottom -->
      <div v-if="!loading && games.length > 0" class="flex items-center justify-center gap-3 mt-8">
        <button @click="previousPage" :disabled="currentPage === 1"
          class="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-medium transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">
          ← Prev
        </button>

        <input v-model.number="pageInput" @keydown.enter="goToPage" @blur="goToPage" @focus="$event.target.select()"
          type="number" min="1"
          class="w-[70px] px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium text-center focus:outline-none focus:border-pink-500/50 focus:bg-white/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />

        <button @click="nextPage" :disabled="games.length <= 0"
          class="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-medium transition-all active:scale-95">
          Next →
        </button>

        <button @click="cycleGridSize"
          class="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white transition-all active:scale-95 hover:bg-white/20 flex items-center justify-center"
          :title="`Grid: ${gridSize === 'S' ? '3 columns' : gridSize === 'M' ? '2 columns' : '1 column'}`">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <rect v-if="gridSize === 'S'" x="3" y="8" width="5" height="8" rx="1" />
            <rect v-if="gridSize === 'S'" x="9.5" y="8" width="5" height="8" rx="1" />
            <rect v-if="gridSize === 'S'" x="16" y="8" width="5" height="8" rx="1" />
            <rect v-if="gridSize === 'M'" x="3" y="3" width="8" height="18" rx="1" />
            <rect v-if="gridSize === 'M'" x="13" y="3" width="8" height="18" rx="1" />
            <rect v-if="gridSize === 'L'" x="3" y="3" width="18" height="18" rx="1" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <div v-if="contextMenu.visible" @click="closeContextMenu" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div @click.stop class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl min-w-[200px]">
        <div class="p-2 bg-gradient-to-b from-white/5 to-transparent border-b border-white/10">
          <p class="text-white/90 font-medium text-sm px-3 py-1 truncate">{{ contextMenu.game?.title }}</p>
        </div>
        <div class="p-2 space-y-1">
          <button @click="handleContextAction('download')"
            class="w-full px-4 py-3 text-left text-white/90 hover:bg-white/10 rounded-xl transition-all active:scale-95 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span class="text-sm font-medium">Download</span>
          </button>
          <button @click="handleContextAction('play')"
            class="w-full px-4 py-3 text-left text-white/90 hover:bg-white/10 rounded-xl transition-all active:scale-95 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm font-medium">Download and Play</span>
          </button>
          <button @click="handleContextAction('open-bbs')"
            class="w-full px-4 py-3 text-left text-white/90 hover:bg-white/10 rounded-xl transition-all active:scale-95 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span class="text-sm font-medium">Open BBS Page</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Browser } from "@capacitor/browser";
import { useLibraryStore } from "../stores/library";
import { useToast } from "../composables/useToast";

const router = useRouter();
const libraryStore = useLibraryStore();
const toast = useToast();

const games = ref([]);
const loading = ref(false);
const searchQuery = ref("");
const activeTab = ref("Featured");
const downloadingId = ref(null);
const currentPage = ref(1);
const pageInput = ref(1);
const gridSize = ref(localStorage.getItem('pico_bbs_grid_size') || 'M');
const contextMenu = ref({ visible: false, x: 0, y: 0, game: null });
const longPressTimer = ref(null);
const longPressDuration = 500; // ms

onMounted(() => {
  loadGames();
});

watch(gridSize, (newSize) => {
  localStorage.setItem('pico_bbs_grid_size', newSize);
});

async function goToPage() {
  const page = parseInt(pageInput.value);
  if (page && page > 0 && page !== currentPage.value) {
    currentPage.value = page;
    window.scrollTo({ top: 0, behavior: "smooth" });
    await loadGames();
  } else {
    // Reset to current page if invalid
    pageInput.value = currentPage.value;
  }
}

function cycleGridSize() {
  const modes = ['S', 'M', 'L'];
  const currentIndex = modes.indexOf(gridSize.value);
  gridSize.value = modes[(currentIndex + 1) % modes.length];
  Haptics.impact({ style: ImpactStyle.Light });
}

async function nextPage() {
  currentPage.value++;
  pageInput.value = currentPage.value;
  window.scrollTo({ top: 0, behavior: "smooth" });
  await loadGames();
}

async function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    pageInput.value = currentPage.value;
    window.scrollTo({ top: 0, behavior: "smooth" });
    await loadGames();
  }
}

async function loadGames() {
  loading.value = true;
  games.value = [];

  try {
    if (searchQuery.value.trim() !== "") {
      games.value = await searchGames({ query: searchQuery.value, page: currentPage.value });
    } else if (activeTab.value === "Featured") {
      games.value = await fetchFeaturedGames(currentPage.value);
    } else if (activeTab.value === "New") {
      games.value = await fetchNewGames(currentPage.value, false);
    } else if (activeTab.value === "Popular") {
      games.value = await fetchNewGames(currentPage.value, true);
    } else if (activeTab.value === "Lucky") {
      games.value = await fetchLuckyGames(currentPage.value);
    }
    console.log(`[bbs_explorer] Loaded ${games.value.length} games for page ${currentPage.value}`);
  } catch (e) {
    toast.showToast(`Failed to load games: ${e.message}`, "error");
  } finally {
    loading.value = false;
  }
}

async function performSearch() {
  // force search mode basically overrides tabs
  if (!searchQuery.value) return;
  Haptics.impact({ style: ImpactStyle.Light });
  activeTab.value = "Search"; // Just visual
  currentPage.value = 1; // Reset to page 1 on new search
  pageInput.value = currentPage.value;
  loadGames();
}

async function switchTab(tab) {
  if (activeTab.value === tab && !searchQuery.value) return;
  Haptics.impact({ style: ImpactStyle.Light });

  activeTab.value = tab;
  searchQuery.value = ""; // Clear search when switching tabs
  currentPage.value = 1; // Reset to page 1 when switching tabs
  pageInput.value = currentPage.value;
  loadGames();
}

function showContextMenu(game, event) {
  contextMenu.value = {
    visible: true,
    x: event.clientX || 0,
    y: event.clientY || 0,
    game: game
  };
  Haptics.impact({ style: ImpactStyle.Medium });
}

function handleTouchStart(game, event) {
  longPressTimer.value = setTimeout(() => {
    const touch = event.touches[0];
    showContextMenu(game, { clientX: touch.clientX, clientY: touch.clientY });
  }, longPressDuration);
}

function handleTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

function handleContextAction(action) {
  const game = contextMenu.value.game;
  closeContextMenu();
  
  if (action === 'download') {
    downloadGameOnly(game);
  } else if (action === 'play') {
    downloadGame(game);
  } else if (action === 'open-bbs') {
    Browser.open({ url: game.source_page_url });
    Haptics.impact({ style: ImpactStyle.Light });
  }
}

async function downloadGameOnly(game) {
  await performDownload(game, false);
}

async function downloadGame(game, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  await performDownload(game, true);
}

async function performDownload(game, andPlay = true) {
  if (!game || !game.id) {
    console.error("Invalid game data");
    return;
  }
  if (downloadingId.value) return;

  downloadingId.value = game.id;
  Haptics.impact({ style: ImpactStyle.Medium });
  console.log(`[bbs_explorer] Downloading ${game.title}... URL: ${game.cart_url}`);

  try {
    let downloadUrl = game.cart_url;
    let fileName;
    if (!downloadUrl) {
      console.log(`[bbs_explorer] cart_url missing, trying to find cartridge link on forum post page ${game.source_page_url}...`);
      const pageRes = await fetch(game.source_page_url);
      const pageHtml = await pageRes.text();
      const cart_found = pageHtml.match(
        /Module\.arguments\s*=\s*\[\s*["']([^"']+)["']/i
      );
      if (!cart_found) {
        throw new Error("Could not find cartridge link on BBS page.");
      };
      downloadUrl = `https://www.lexaloffle.com${cart_found[1]}`;
      console.log(`[bbs_explorer] 🎯 SOURCE LOCKED: ${downloadUrl}`);
      fileName = game.title.replace(/[^a-z0-9_\-]/gi, "_").substring(0, 30);
    } else {
      fileName = downloadUrl.split("/").pop().split("?")[0] || `bbs_game_${game.id}`;
    }

    if (!fileName.endsWith(".p8.png")) {
      fileName += ".p8.png";
    }

    const response = await fetch(downloadUrl, {
      headers: {
        Accept: "image/png,image/*;q=0.8",
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (blob.size < 8000) {
      throw new Error(`404/Incomplete Data`);
    }
    console.log(`[bbs_explorer] 📥 Downloaded Size: ${blob.size}`);

    // save to library persistently
    try {
      const file = new File([blob], fileName, { type: "image/png" });
      const saved = await libraryStore.addCartridge(file);

      if (saved) {
        toast.showToast(`Downloaded ${game.title}`, "success");
      }
    } catch (saveErr) {
      console.error("Save to library failed", saveErr.message);
      toast.showToast(`Save to library failed: ${saveErr.message}`, "error");
    }

    if (andPlay) {
      // store in global stash (using _bbs_cartdat to strictly isolate)
      window._bbs_cartdat = new Uint8Array(await blob.arrayBuffer());
      console.log("[bbs_explorer] 📦 Stashed in window._bbs_cartdat");
      router.push({ name: "player", query: { cart: "bbs_cart" } });
    }
  } catch (e) {
    console.error("Download failed:", e);
    Haptics.notification({ type: "error" });

    if (e.message.includes("404") || e.message.includes("Could not find")) {
      toast.showToast("Cartridge link not found on BBS page.", "error");
    } else {
      toast.showToast(`Download failed: ${e.message}`, "error");
    }
  } finally {
    downloadingId.value = null;
    loading.value = false;
  }
}

async function fetchFeaturedGames(page = 1) {
  const url = `https://www.lexaloffle.com/bbs/lister.php?use_hurl=1&cat=7&sub=2&mode=carts&orderby=featured&page=${page}`;
  return scrapeGames(url);
}

async function fetchNewGames(page = 1, popular = false) {
  const url = `https://www.lexaloffle.com/bbs/lister.php?use_hurl=1&cat=7&sub=2&mode=carts&orderby=ts${popular ? "&popular=1" : ""}&page=${page}`;
  return scrapeGames(url);
}

async function fetchLuckyGames(page = 1) {
  const url = `https://www.lexaloffle.com/bbs/lister.php?use_hurl=1&cat=7&sub=2&mode=carts&orderby=lucky&page=${page}`;
  return scrapeGames(url);
}

async function searchGames(options) {
  const query = encodeURIComponent(options.query || "");
  const page = options.page || 1;
  const url = `https://www.lexaloffle.com/bbs/?mode=carts&cat=7&sub=0&orderby=ts&search=${query}&page=${page}`;
  return scrapeGames(url);
}

async function scrapeGames(targetUrl) {
  console.log(`[bbs_explorer] 🔎 [WebScraper] SEARCHING URL: ${targetUrl}`);
  const response = await fetch(targetUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  return parseHTML(html);
}

function parseHTML(html) {
  const games = [];

  // Parse HTML string into DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extract pdat array from <script id=cart_data_script>
  const scriptElement = doc.getElementById('cart_data_script');

  if (!scriptElement) {
    throw new Error("⚠️ [WebScraper] No cart_data_script found in HTML");
  }

  const scriptContent = scriptElement.textContent;

  // Extract pdat array content
  const pdatMatch = scriptContent.match(/pdat\s*=\s*\[([\s\S]*?)\];/);

  if (!pdatMatch) {
    throw new Error("⚠️ [WebScraper] No pdat array found in script");
  }

  // Parse the pdat array safely by wrapping in valid JSON context
  // The array contains template literals (backticks), so we need to evaluate it
  const pdatArrayStr = `[${pdatMatch[1]}]`;

  // Use Function constructor for safer eval (no access to outer scope)
  const pdat = new Function(`return ${pdatArrayStr}`)();

  console.log(`[bbs_explorer] 🔎 WebScraper Found ${pdat.length} carts in pdat array`);

  for (const entry of pdat) {
    if (!Array.isArray(entry) || entry.length < 9) {
      console.warn("⚠️ [WebScraper] Invalid pdat entry:", entry);
      continue;
    }

    // pdat structure:
    // [0] = uid (string)
    // [1] = id (number) - thread ID
    // [2] = title (string with backticks)
    // [3] = thumbnail path (string)
    // [4-7] = dimension/date info
    // [8] = author (string)
    const uid = entry[0];
    const id = String(entry[1]); // Convert to string for consistency
    const title = entry[2] || `Cart ${id}`;
    const srcPath = entry[3];
    const author = entry[8] || "Unknown";

    addGame(games, id, title, srcPath, author);
  }

  console.log(`[bbs_explorer] ✅ WebScraper Parsed ${games.length} games`);
  return games;
}

function addGame(games, id, title, srcPath, author) {
  const thumb_url = srcPath.startsWith("http")
    ? srcPath
    : `https://www.lexaloffle.com${srcPath}`;
  const source_page_url = `https://www.lexaloffle.com/bbs/?tid=${id}`;

  let cart_url = "";
  if (srcPath.includes("/bbs/thumbs/pico8_")) {
    const cartName = srcPath.replace("/bbs/thumbs/pico8_", "").replace(".p8.png", "").replace(".png", "");
    const subFolder = cartName.substring(0, 2);
    cart_url = `https://www.lexaloffle.com/bbs/cposts/${subFolder}/${cartName}.p8.png`;
  }

  const gameObj = {
    id: id,
    title: title || id,
    author: author,
    thumb_url: thumb_url,
    source_page_url: source_page_url,
    cart_url: cart_url,
  };

  // console.log(`[bbs_explorer] + WebScraper Added game: ${title} (ID: ${id}, Author: ${author}, thumb_url: ${thumb_url}, source_page_url: ${source_page_url}, cart_url: ${cart_url})`);
  games.push(gameObj);
}
</script>

<style scoped>
/* transitions from Library.vue */
.staggered-fade-enter-active,
.staggered-fade-leave-active {
  transition: all 0.5s ease;
}

.staggered-fade-enter-from,
.staggered-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.staggered-fade-enter-active {
  transition-delay: calc(50ms * var(--index));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
