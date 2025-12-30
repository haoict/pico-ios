import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { libraryManager } from "../services/LibraryManager";

export const useLibraryStore = defineStore("library", () => {
  // state
  const rawGames = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // ui state
  const searchQuery = ref("");
  const sortBy = ref("lastPlayed"); // 'lastPlayed', 'name', 'newest'
  const swapButtons = ref(localStorage.getItem("pico_swap_buttons") === "true");
  const useJoystick = ref(localStorage.getItem("pico_use_joystick") === "true");

  function toggleSwapButtons() {
    swapButtons.value = !swapButtons.value;
    localStorage.setItem("pico_swap_buttons", swapButtons.value);
  }

  function toggleJoystick() {
    useJoystick.value = !useJoystick.value;
    localStorage.setItem("pico_use_joystick", useJoystick.value);
  }

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

  async function loadLibrary() {
    loading.value = true;
    error.value = null;
    try {
      await libraryManager.init();
      rawGames.value = await libraryManager.scan();
      return rawGames.value;
    } catch (e) {
      error.value = e.message;
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function addCartridge(file) {
    loading.value = true;
    try {
      const success = await libraryManager.importFile(file, file.name);
      if (success) {
        rawGames.value = await libraryManager.scan();
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
      }
      return success;
    } catch (e) {
      error.value = e.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function removeCartridge(filename) {
    // backend uses filename
    const success = await libraryManager.deleteCartridge(filename);
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
      newName
    );
    if (success) {
      const idx = rawGames.value.findIndex((g) => g.filename === game.filename);
      if (idx !== -1) {
        rawGames.value[idx].name = newName; // optimistic update of display name
        // refresh for full sync
        rawGames.value = await libraryManager.scan();
      }
    }
    return success;
  }

  return {
    games: filteredGames,
    rawGames,
    loading,
    error,
    searchQuery,
    sortBy,
    swapButtons,
    useJoystick,
    toggleSwapButtons,
    toggleJoystick,
    loadLibrary,
    loadLibrary,
    addCartridge,
    addBundle,
    removeCartridge,
    toggleFavorite,
    renameCartridge,
  };
});
