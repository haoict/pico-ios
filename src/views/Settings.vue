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
      <h1 class="text-3xl font-bold tracking-tight">Settings</h1>
    </div>

    <div class="space-y-8 max-w-2xl mx-auto">
      <!-- general controls -->
      <section>
        <h2
          class="text-sm font-medium text-white/50 uppercase tracking-wider mb-4"
        >
          Controls
        </h2>
        <div class="space-y-3">
          <!-- swap buttons -->
          <div
            @click="toggleSwapButtons"
            class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition-colors cursor-pointer"
          >
            <span class="text-white font-medium">Swap Action Buttons</span>
            <div
              class="w-12 h-7 rounded-full transition-colors relative"
              :class="swapButtons ? 'bg-purple-500' : 'bg-white/10'"
            >
              <div
                class="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
                :class="swapButtons ? 'translate-x-5' : 'translate-x-0'"
              ></div>
            </div>
          </div>

          <!-- virtual joystick -->
          <div
            @click="toggleJoystick"
            class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition-colors cursor-pointer"
          >
            <span class="text-white font-medium">Enable Virtual Joystick</span>
            <div
              class="w-12 h-7 rounded-full transition-colors relative"
              :class="useJoystick ? 'bg-purple-500' : 'bg-white/10'"
            >
              <div
                class="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
                :class="useJoystick ? 'translate-x-5' : 'translate-x-0'"
              ></div>
            </div>
          </div>
        </div>
      </section>

      <!-- library settings -->
      <section>
        <h2
          class="text-sm font-medium text-white/50 uppercase tracking-wider mb-4"
        >
          Library
        </h2>
        <div class="space-y-3">
          <!-- library folder -->
          <div class="bg-white/5 rounded-xl border border-white/5 p-4">
            <div class="mb-3">
              <span class="text-white font-medium block">Library Folder</span>
              <p class="text-xs text-white/40 mt-1">
                Folder name within Documents. Leave empty for root.
              </p>
            </div>
            <div class="flex gap-2">
              <input
                v-model="tempRootDir"
                type="text"
                placeholder="e.g. Pocket8"
                class="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                @keyup.enter="saveRootDir"
              />
              <button
                @click="saveRootDir"
                :disabled="tempRootDir === currentRootDir"
                class="px-4 py-2 bg-white/10 rounded-lg text-white/80 text-sm font-medium hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Set
              </button>
            </div>
          </div>

          <!-- manage saves link -->
          <div
            @click="$router.push('/settings/saves')"
            class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition-colors cursor-pointer group"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-full bg-blue-500/20 text-blue-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
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
              <span class="text-white font-medium">Manage Saved Data</span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-white/30 group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </section>

      <!-- app info -->
      <section class="pt-8 flex flex-col items-center opacity-30">
        <p class="text-[10px] font-mono uppercase tracking-widest">
          Pocket8 v1.4
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useLibraryStore } from "../stores/library";
import { storeToRefs } from "pinia";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const libraryStore = useLibraryStore();
const { swapButtons, useJoystick, rootDir } = storeToRefs(libraryStore);
const { toggleSwapButtons, toggleJoystick, updateRootDirectory } = libraryStore;

const tempRootDir = ref("");
const currentRootDir = computed(() => rootDir.value || "");

// init temp state
onMounted(() => {
  tempRootDir.value = currentRootDir.value;
});

watch(rootDir, (val) => {
  tempRootDir.value = val || "";
});

async function saveRootDir() {
  if (tempRootDir.value === currentRootDir.value) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});

  const success = await updateRootDirectory(tempRootDir.value);
  if (success) {
    Haptics.notification({ type: "success" }).catch(() => {});
  } else {
    alert("Failed to update directory setting.");
  }
}
</script>
