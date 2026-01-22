<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[80] flex justify-end pointer-events-none"
  >
    <!-- drawer container -->
    <div
      class="pointer-events-auto w-screen h-screen md:w-full md:max-w-sm md:h-full bg-[#111]/90 backdrop-blur-3xl saturate-150 border-l border-white/10 flex flex-col shadow-2xl transition-transform duration-300 transform slide-in-right"
    >
      <!-- header -->
      <div
        class="flex items-center justify-between px-6 pb-4 border-b border-white/10 bg-white/5 pt-[calc(env(safe-area-inset-top)+1rem)]"
      >
        <h2 class="text-white font-pico-crisp text-lg drop-shadow-md">SAVES</h2>
        <button
          @click="closeDrawer"
          class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 text-white/60 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <!-- content -->
      <div class="flex-1 overflow-y-auto overscroll-contain p-4 safe-pb">
        <div
          v-if="loading"
          class="flex flex-col items-center justify-center py-12 gap-3"
        >
          <div
            class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"
          ></div>
          <span class="text-xs text-white/40 tracking-widest">SCANNING...</span>
        </div>

        <div
          v-else-if="saves.length === 0"
          class="flex flex-col items-center justify-center py-12 gap-3 text-white/30"
        >
          <span class="text-4xl">💾</span>
          <span class="text-xs font-mono">NO SAVE FILES</span>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="(save, index) in saves"
            :key="save.name"
            :ref="(el) => (saveItemsRef[index] = el)"
            @click="loadSave(save.name)"
            class="group relative bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all rounded-xl p-3 border border-white/5 hover:border-white/20 cursor-pointer overflow-hidden"
            :class="{
              '!bg-white/20 !border-white/40 ring-2 ring-white/50':
                focusedIndex === index,
            }"
          >
            <!-- save icon & info -->
            <div class="flex items-start gap-3">
              <div
                class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 shrink-0"
              >
                <span class="text-xl">💾</span>
              </div>
              <div class="flex-1 min-w-0">
                <h3
                  class="text-white font-medium text-sm truncate font-pico leading-tight mb-1"
                >
                  {{ save.name.replace(".state", "").replace(/_/g, " ") }}
                </h3>
                <div
                  class="flex items-center gap-2 text-[10px] text-white/40 font-mono"
                >
                  <span>{{ formatSize(save.size) }}</span>
                  <span>•</span>
                  <span>{{ formatDate(save.mtime) }}</span>
                </div>
              </div>
            </div>

            <!-- chevron -->
            <div
              class="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white/40 group-hover:translate-x-1 transition-all"
            >
              ›
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- overlay backdrop -->
  <Transition name="fade">
    <div
      v-if="isOpen"
      @click="closeDrawer"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
    ></div>
  </Transition>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { haptics } from "../utils/haptics";
import { ImpactStyle } from "@capacitor/haptics";

const props = defineProps(["isOpen", "cartName"]);
const emit = defineEmits(["close", "load"]);
const saves = ref([]);
const loading = ref(false);

const closeDrawer = () => {
  emit("close");
  haptics.impact(ImpactStyle.Light).catch(() => {});
};

const refreshSaves = async () => {
  if (!props.isOpen) return;
  loading.value = true;
  saves.value = [];

  try {
    console.log("📂 [Drawer] Scanning 'Saves' folder...");

    // get platform
    const platform = Capacitor.getPlatform();
    let path = "Saves";
    if (platform === "android") path = "Pocket8/Saves";

    const ret = await Filesystem.readdir({
      path: path,
      directory: Directory.Documents,
    });

    // normalize name for filtering
    const targetName = (props.cartName || "")
      .toLowerCase()
      .replace(".p8.png", "")
      .replace(".p8", "");

    // filter relevant saves
    saves.value = ret.files
      .filter(
        (f) =>
          f.name.endsWith(".state") &&
          f.name.toLowerCase().includes(targetName),
      )
      .sort((a, b) => (b.mtime || 0) - (a.mtime || 0)); // newest first
  } catch (e) {
    console.error("📂 [Drawer] Read Failed:", e);
  } finally {
    loading.value = false;
  }
};

const scrollToFocused = () => {
  const el = saveItemsRef.value[focusedIndex.value];
  if (el) {
    el.scrollIntoView({ block: "start", behavior: "smooth" });
  }
};

// gamepad / keyboard nav
const focusedIndex = ref(-1);
const saveItemsRef = ref([]);
const inputCleanup = ref(null);

const loadSave = (filename) => {
  haptics.impact(ImpactStyle.Medium).catch(() => {});
  console.log("⚡️ [Drawer] Selected:", filename);
  emit("load", filename);
  emit("close");
};

import { inputManager } from "../services/InputManager";

const handleInput = (action) => {
  if (!props.isOpen || loading.value) return;

  if (action === "back") {
    closeDrawer();
    return;
  }

  if (saves.value.length === 0) return;

  if (action === "nav-down") {
    focusedIndex.value = (focusedIndex.value + 1) % saves.value.length;
    scrollToFocused();
    haptics.impact(ImpactStyle.Light).catch(() => {});
  } else if (action === "nav-up") {
    focusedIndex.value =
      (focusedIndex.value - 1 + saves.value.length) % saves.value.length;
    scrollToFocused();
    haptics.impact(ImpactStyle.Light).catch(() => {});
  } else if (action === "confirm") {
    if (focusedIndex.value >= 0 && saves.value[focusedIndex.value]) {
      loadSave(saves.value[focusedIndex.value].name);
    }
  }
};

const setupInputListener = () => {
  if (inputCleanup.value) return;
  inputCleanup.value = inputManager.addListener(handleInput);
};

const removeInputListener = () => {
  if (inputCleanup.value) {
    inputCleanup.value();
    inputCleanup.value = null;
  }
};

onMounted(() => {
  if (props.isOpen) {
    refreshSaves();
    setupInputListener();
  }
});

onUnmounted(() => {
  removeInputListener();
});

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      refreshSaves();
      focusedIndex.value = -1;
      setupInputListener();
    } else {
      removeInputListener();
    }
  },
);

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};
const formatDate = (ms) =>
  new Date(ms).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide in animation */
@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.slide-in-right {
  animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
