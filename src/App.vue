<template>
  <div
    class="antialiased min-h-screen bg-gradient-to-b from-gray-900 to-black text-white selection:bg-purple-500 selection:text-white"
  >
    <!-- # global background effects -->
    <!-- # global background effects -->
    <div v-if="isCheckingEngine" class="fixed inset-0 bg-black z-50"></div>

    <BiosImporter v-else-if="!isEngineReady" />

    <RouterView v-else v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>

    <!-- global dynamic island toast -->
    <Transition name="slide-down">
      <div
        v-if="toast.isVisible.value"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl backdrop-blur-md border border-white/10 transition-all duration-300 !pointer-events-none"
        :class="
          toast.type.value === 'error' ? 'bg-red-500/90' : 'bg-neutral-900/90'
        "
      >
        <!-- icon based on type -->
        <span v-if="toast.type.value === 'success'" class="text-green-400"
          >✓</span
        >
        <span v-else-if="toast.type.value === 'error'" class="text-white"
          >✕</span
        >
        <span v-else class="text-blue-400">ℹ</span>

        <span
          class="text-white font-medium text-sm tracking-wide !pointer-events-auto"
          >{{ toast.message.value }}</span
        >
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"; // Explicit import added
import { Filesystem, Directory } from "@capacitor/filesystem";
import { App } from "@capacitor/app";
import { Dialog } from "@capacitor/dialog";
import { RouterView, useRouter } from "vue-router";
import { useToast } from "./composables/useToast";
import BiosImporter from "./components/BiosImporter.vue";
import { EngineLoader } from "./utils/EngineLoader";
import { libraryManager } from "./services/LibraryManager";

const toast = useToast();
const router = useRouter();
const isEngineReady = ref(false);
const isCheckingEngine = ref(true);
const showImporter = ref(false); // New ref for showing BiosImporter

onMounted(async () => {
  // # 1. Prepare Engine (Check Only)
  // We strictly check if the bios exists. We DO NOT inject here.
  const hasEngine = await EngineLoader.init();

  if (!hasEngine) {
    console.warn("[App.vue] Bios missing. Prompting import.");
    showImporter.value = true;
  } else {
    console.log(
      "[App.vue] Engine ready (cached). Waiting for Player to inject."
    );
    // If engine is ready, we can proceed to the main app, but not necessarily inject yet.
    // The main app (RouterView) will handle injection when a game is selected.
    isEngineReady.value = true; // Indicate that the engine is available for use
  }

  isCheckingEngine.value = false;

  // # helper: process deep link url
  const processDeepLink = async (urlString) => {
    console.log("[App] Processing deep link:", urlString);
    try {
      const url = new URL(urlString);
      // Handle: pocket8://play?id=...
      if (url.protocol.includes("pocket8") && url.host === "play") {
        const cartId = url.searchParams.get("id");
        if (cartId) {
          try {
            toast.showToast("Loading Cartridge...", "info");

            // CRITICAL: ensure libraryManager is initialized before calling handleDeepLink
            // This creates the Carts/Images/Saves directories if they don't exist
            await libraryManager.init();

            // use new centralized handler
            const result = await libraryManager.handleDeepLink(cartId);

            if (result.exists) {
              console.log("[App] Cart exists locally, booting...");
            } else if (result.downloaded) {
              toast.showToast("Saved to Library", "success");
            }

            // boot it
            router.push({
              name: "player",
              query: { cart: result.filename, t: Date.now() },
            });
          } catch (err) {
            console.error("[App] handleDeepLink failed:", err);
            toast.showToast("Failed to download cart", "error");
          }
        }
      }
    } catch (e) {
      console.error("[App] Invalid Deep Link:", e);
    }
  };

  // # deep link listener (hot start)
  try {
    App.addListener("appUrlOpen", async (event) => {
      console.log("[App] appUrlOpen event received:", event.url);
      await processDeepLink(event.url);
    });
  } catch (e) {
    console.warn("[App] Deep links not supported in this environment:", e);
  }

  // # check launch url (cold start)
  try {
    const launchUrl = await App.getLaunchUrl();
    console.log("[App] getLaunchUrl result:", launchUrl);
    if (launchUrl && launchUrl.url) {
      console.log("[App] Cold start launch url detected:", launchUrl.url);
      await processDeepLink(launchUrl.url);
    }
  } catch (e) {
    console.error("[App] getLaunchUrl failed:", e);
  }

  // # test helper
  window.testDeepLink = (id) => {
    console.log(`[debug] simulating deep link for id: ${id}`);
    const mockUrl = `pocket8://play?id=${id}`;
    processDeepLink(mockUrl);
  };

  // # Global fallback for Native iOS injection
  // Swift's SceneDelegate calls this via evaluateJavaScript("window.handleOpenUrl(...)")
  window.handleOpenUrl = (url) => {
    console.log("[App] Native Force-Feed received:", url);
    processDeepLink(url);
  };
});
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* toast slide animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -150%);
}
</style>
