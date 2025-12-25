import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { libraryManager } from "../services/LibraryManager";

export const useLibraryStore = defineStore("library", () => {
  // # state
  const rawGames = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // # ui state
  const searchQuery = ref("");
  const sortBy = ref("lastPlayed"); // 'lastPlayed', 'name', 'newest'
  const swapButtons = ref(localStorage.getItem("pico_swap_buttons") === "true");

  function toggleSwapButtons() {
    swapButtons.value = !swapButtons.value;
    localStorage.setItem("pico_swap_buttons", swapButtons.value);
  }

  const filteredGames = computed(() => {
    let result = [...rawGames.value];

    // # filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q));
    }

    // # sort
    result.sort((a, b) => {
      if (sortBy.value === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy.value === "lastPlayed") {
        return (b.lastPlayed || 0) - (a.lastPlayed || 0);
      } else if (sortBy.value === "newest") {
        // # note: assuming dateadded fallback
        return 0;
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
    } catch (e) {
      error.value = e.message;
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

  async function removeCartridge(filename) {
    const success = await libraryManager.deleteCartridge(filename);
    if (success) {
      // # optimistic update
      rawGames.value = rawGames.value.filter((g) => g.name !== filename);
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
    toggleSwapButtons,
    loadLibrary,
    addCartridge,
    removeCartridge,
  };
});
