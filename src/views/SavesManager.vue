<template>
  <div class="min-h-screen bg-[var(--color-oled-black)] text-white p-6 pt-16">
    <!-- header -->
    <div class="flex items-center gap-4 mb-8">
      <button
        @click="$router.back()"
        class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 text-white/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <h1 class="text-3xl font-bold tracking-tight">Saved Data</h1>
    </div>

    <div class="max-w-2xl mx-auto">
      <div v-if="loadingSaves" class="flex justify-center py-20">
        <div
          class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"
        ></div>
      </div>

      <div
        v-else-if="saves.length === 0"
        class="flex flex-col items-center justify-center py-20 text-white/30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 mb-4 opacity-50"
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
        <p>No save files found</p>
      </div>

      <div v-else class="space-y-6 pb-20">
        <div
          v-for="group in groupedSaves"
          :key="group.title"
          class="animate-fade-in"
        >
          <!-- group header -->
          <h4
            class="sticky top-16 z-10 bg-[var(--color-oled-black)]/95 backdrop-blur-md py-2 px-1 text-white/40 text-xs font-bold uppercase tracking-widest mb-2 border-b border-white/5"
          >
            {{ group.title }}
          </h4>

          <!-- group items -->
          <div class="space-y-2">
            <div
              v-for="save in group.files"
              :key="save.name"
              class="group flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
            >
              <div class="flex items-center gap-3 overflow-hidden">
                <div
                  class="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0 border border-white/5"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                </div>
                <div class="flex flex-col min-w-0">
                  <span
                    class="text-white text-sm font-medium truncate font-pico leading-tight uppercase"
                  >
                    {{ save.simpleName }}
                  </span>
                  <span class="text-xs text-white/40 truncate font-mono">
                    {{ formatDate(save.mtime) }}
                  </span>
                </div>
              </div>

              <!-- actions -->
              <div class="flex items-center gap-1">
                <!-- load -->
                <button
                  @click="loadState(save)"
                  class="p-2 rounded-lg hover:bg-green-500/20 text-white/40 hover:text-green-400 transition-all"
                  title="Load State"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                  </svg>
                </button>

                <!-- share -->
                <button
                  @click="shareState(save)"
                  class="p-2 rounded-lg hover:bg-blue-500/20 text-white/40 hover:text-blue-400 transition-all"
                  title="Share File"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </button>

                <!-- delete -->
                <button
                  @click.stop="deleteState(save)"
                  class="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                  title="Delete File"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { haptics } from "../utils/haptics";
import { ImpactStyle } from "@capacitor/haptics";
import { libraryManager } from "../services/LibraryManager";
import { useLibraryStore } from "../stores/library";

const router = useRouter();
const libraryStore = useLibraryStore();
const saves = ref([]);
const loadingSaves = ref(false);

const groupedSaves = computed(() => {
  const groups = {};
  saves.value.forEach((save) => {
    const simpleName = save.cartName;
    if (!groups[simpleName]) groups[simpleName] = [];
    groups[simpleName].push(save);
  });

  return Object.keys(groups)
    .sort()
    .map((key) => ({
      title: key,
      files: groups[key].sort((a, b) => b.mtime - a.mtime),
    }));
});

const formatDate = (ms) => new Date(ms).toLocaleDateString();

onMounted(async () => {
  loadingSaves.value = true;
  try {
    const result = await Filesystem.readdir({
      path: libraryManager.resolvePath("Saves"),
      directory: Directory.Documents,
    });

    const parsedFiles = result.files
      .filter((f) => f.name.endsWith(".state"))
      .map((f) => {
        const match = f.name.match(/(.+?)(_auto|_manual)/);
        let cartName = "Unknown";
        if (match) {
          cartName = match[1];
        } else {
          const parts = f.name.split("_");
          cartName = parts[0] || "Unknown";
        }

        const simpleName = f.name
          .replace(cartName + "_", "")
          .replace(".state", "")
          .replace(/_/g, " ");

        return {
          name: f.name,
          uri: f.uri,
          mtime: f.mtime || Date.now(),
          size: f.size,
          cartName: cartName,
          simpleName: simpleName || "Quick Save",
        };
      });

    saves.value = parsedFiles.sort((a, b) => b.mtime - a.mtime);
  } catch (e) {
    console.error("[saves] failed to list saves:", e);
  } finally {
    loadingSaves.value = false;
  }
});

async function loadState(save) {
  haptics.impact(ImpactStyle.Medium).catch(() => {});

  const matchingGame = libraryStore.games.find((g) =>
    g.name.includes(save.cartName)
  );
  let targetCart = matchingGame
    ? matchingGame.filename
    : save.cartName + ".p8.png";

  try {
    const data = await libraryManager.loadCartData(targetCart);
    if (!data) throw new Error("Cart data not found");

    localStorage.setItem("pico_handoff_payload", data);
    localStorage.setItem("pico_handoff_name", targetCart);

    router.push({
      path: "/play",
      query: {
        cart: targetCart,
        state: save.name,
        t: Date.now(),
      },
    });
  } catch (e) {
    alert("Could not load associated cartridge: " + e.message);
  }
}

async function shareState(save) {
  haptics.impact(ImpactStyle.Light).catch(() => {});
  try {
    await Share.share({
      title: "PICO-8 Save State",
      text: `Share ${save.simpleName}`,
      files: [save.uri],
    });
  } catch (e) {
    // ignore dismissals
  }
}

async function deleteState(save) {
  if (!confirm(`Delete ${save.simpleName}?`)) return;

  try {
    await Filesystem.deleteFile({
      path: libraryManager.resolvePath(`Saves/${save.name}`),
      directory: Directory.Documents,
    });

    saves.value = saves.value.filter((s) => s.name !== save.name);
    haptics.success().catch(() => {});
  } catch (e) {
    alert("Could not delete file: " + e.message);
  }
}
</script>
