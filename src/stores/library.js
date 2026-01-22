import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { libraryManager } from "../services/LibraryManager";

export const useLibraryStore = defineStore("library", () => {
  // state
  const rawGames = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const scanProgress = ref({ current: 0, total: 0, show: false });

  // ui state
  const searchQuery = ref("");
  const sortBy = ref("lastPlayed"); // 'lastPlayed', 'name'
  const swapButtons = ref(localStorage.getItem("pico_swap_buttons") === "true");
  const useJoystick = ref(
    localStorage.getItem("pico_use_joystick") !== "false",
  ); // default true
  const hapticsEnabled = ref(
    localStorage.getItem("pico_haptics_enabled") !== "false",
  ); // default true
  const rootDir = ref(localStorage.getItem("pico_root_dir") || "");

  const toggleSwapButtons = () => {
    swapButtons.value = !swapButtons.value;
    localStorage.setItem("pico_swap_buttons", swapButtons.value);
  };

  const toggleJoystick = () => {
    useJoystick.value = !useJoystick.value;
    localStorage.setItem("pico_use_joystick", useJoystick.value);
  };

  const toggleHaptics = () => {
    hapticsEnabled.value = !hapticsEnabled.value;
    localStorage.setItem("pico_haptics_enabled", hapticsEnabled.value);
  };

  const fullscreen = ref(localStorage.getItem("pico_fullscreen") === "true");

  const toggleFullscreen = () => {
    fullscreen.value = !fullscreen.value;
    localStorage.setItem("pico_fullscreen", fullscreen.value);
  };

  const filteredGames = computed(() => {
    let result = [...rawGames.value];

    // filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q));
    }

    // sort
    result.sort((a, b) => {
      // favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      // selected sort strategy
      if (sortBy.value === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy.value === "lastPlayed") {
        return (b.lastPlayed || 0) - (a.lastPlayed || 0);
      } else if (sortBy.value === "newest") {
        return (b.mtime || 0) - (a.mtime || 0);
      } else if (sortBy.value === "oldest") {
        return (a.mtime || 0) - (b.mtime || 0);
      }
      return 0;
    });

    return result;
  });

  async function loadLibrary(forceRefresh = false) {
    loading.value = true;
    error.value = null;
    scanProgress.value = { current: 0, total: 0, show: false };

    // attach progress callback
    libraryManager.onProgress = (current, total) => {
      scanProgress.value = { current, total, show: true };
    };

    try {
      await libraryManager.init();
      rootDir.value = libraryManager.rootDir; // sync state

      // cache first
      if (libraryManager.games.length > 0 && !forceRefresh) {
        console.log(
          `[useLibraryStore] Using ${libraryManager.games.length} cached games. Skipping scan.`,
        );
        rawGames.value = libraryManager.games;
        // trigger background image load
        libraryManager.loadCovers(rawGames.value);
      } else {
        console.log(
          "[useLibraryStore] Cache empty or force refresh. Scanning...",
        );
        rawGames.value = await libraryManager.scan();
        libraryManager.loadCovers(rawGames.value);
      }

      return rawGames.value;
    } catch (e) {
      error.value = e.message;
      return [];
    } finally {
      loading.value = false;
      setTimeout(() => {
        scanProgress.value.show = false; // hide after delay
      }, 1000);
    }
  }

  async function addCartridge(file) {
    loading.value = true;
    try {
      const success = await libraryManager.importFile(file, file.name);
      if (success) {
        rawGames.value = await libraryManager.scan();
        libraryManager.loadCovers(rawGames.value);
      }
      return success;
    } catch (e) {
      error.value = e.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function addBundle(files) {
    loading.value = true;
    try {
      const success = await libraryManager.importBundle(files);
      if (success) {
        rawGames.value = await libraryManager.scan();
        libraryManager.loadCovers(rawGames.value);
      }
      return success;
    } catch (e) {
      error.value = e.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function removeCartridge(filename, deleteExternalFile = false) {
    // backend uses filename
    const success = await libraryManager.deleteCartridge(
      filename,
      deleteExternalFile,
    );
    if (success) {
      // optimistic update
      rawGames.value = rawGames.value.filter((g) => g.filename !== filename);
    }
    return success;
  }

  async function toggleFavorite(game) {
    // optimistic update (immediate)
    // Use unique filename to find index
    const idx = rawGames.value.findIndex((g) => g.filename === game.filename);
    if (idx !== -1) {
      rawGames.value[idx].isFavorite = !rawGames.value[idx].isFavorite;
    }

    // perform actual
    // use filename for metadata lookup
    const isFav = await libraryManager.toggleFavorite(game.filename);

    // reconcile if mismatch
    if (idx !== -1 && rawGames.value[idx].isFavorite !== isFav) {
      rawGames.value[idx].isFavorite = isFav;
    }
    return isFav;
  }

  async function renameCartridge(game, newName) {
    // use filename for metadata lookup
    const success = await libraryManager.renameCartridge(
      game.filename,
      newName,
    );
    if (success) {
      // update local state
      const idx = rawGames.value.findIndex((g) => g.filename === game.filename);
      if (idx !== -1) {
        rawGames.value[idx].name = newName;
      }
      // persist in localStorage
      localStorage.setItem("pico_cached_games", JSON.stringify(rawGames.value));
    }
    return success;
  }

  async function addExternalSource(folderObj) {
    loading.value = true;
    scanProgress.value = {
      current: 0,
      total: 0,
      show: true,
      label: "Syncing...",
    };

    try {
      // sync progress callback
      const onProgress = (sourceName, current, total) => {
        scanProgress.value = {
          current,
          total,
          show: true,
          label: `Indexing ${sourceName} (${current}/${total})`,
        };
      };

      const success = await libraryManager.addSyncSource(folderObj, onProgress);
      if (success) {
        // re-scan
        rawGames.value = await libraryManager.scan();
        libraryManager.loadCovers(rawGames.value);
      }
      return success;
    } catch (e) {
      error.value = e.message;
      return false;
    } finally {
      loading.value = false;
      setTimeout(() => {
        scanProgress.value.show = false;
      }, 1000);
    }
  }

  async function rescanLibrary() {
    loading.value = true;
    error.value = null;
    scanProgress.value = { current: 0, total: 0, show: true };

    libraryManager.onProgress = (current, total) => {
      scanProgress.value = { current, total, show: true };
    };

    try {
      console.log("[useLibraryStore] Force rescan requested.");
      rawGames.value = await libraryManager.scan();
      libraryManager.loadCovers(rawGames.value);
      return true;
    } catch (e) {
      error.value = e.message;
      return false;
    } finally {
      loading.value = false;
      setTimeout(() => {
        scanProgress.value.show = false;
      }, 1000);
    }
  }

  return {
    games: filteredGames,
    rawGames,
    loading,
    error,
    scanProgress,
    searchQuery,
    sortBy,
    swapButtons,
    useJoystick,
    hapticsEnabled,
    rootDir,
    toggleSwapButtons,
    toggleJoystick,
    toggleHaptics,
    addExternalSource,
    loadLibrary,
    rescanLibrary,
    addCartridge,
    addBundle,
    removeCartridge,
    toggleFavorite,
    renameCartridge,
    toggleFullscreen,
    fullscreen: computed(() => fullscreen.value),
    resetLibrary: async (fullWipe) => {
      const res = await libraryManager.resetLibrary(fullWipe);
      rawGames.value = libraryManager.games;
      return res;
    },
  };
});
