<template>
  <div
    class="antialiased min-h-screen bg-gradient-to-b from-gray-900 to-black text-white selection:bg-purple-500 selection:text-white app-root"
  >
    <!-- global background effects -->
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
        class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-full shadow-2xl backdrop-blur-md bg-neutral-900/90 border border-white/10 !pointer-events-none"
      >
        <span class="text-white font-medium text-sm tracking-wide">{{
          toast.message.value
        }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
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
const showImporter = ref(false);

onMounted(async () => {
  // prep engine
  const hasEngine = await EngineLoader.init();

  if (!hasEngine) {
    console.warn("[App.vue] Bios missing. Prompting import.");
    showImporter.value = true;
  } else {
    console.log(
      "[App.vue] Engine ready (cached). Waiting for Player to inject."
    );
    isEngineReady.value = true;
  }

  isCheckingEngine.value = false;

  // helper: process deep link url
  const processDeepLink = async (urlString) => {
    console.log("[App] Processing deep link:", urlString);
    try {
      const url = new URL(urlString);
      // handle: pocket8://play?id=...
      if (url.protocol.includes("pocket8") && url.host === "play") {
        const cartId = url.searchParams.get("id");
        if (cartId) {
          try {
            toast.showToast("Loading Cartridge...", "info");

            // create the Carts/Images/Saves directories if they don't exist
            await libraryManager.init();

            // use centralized handler
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

  // deep link listener
  try {
    App.addListener("appUrlOpen", async (event) => {
      console.log("[App] appUrlOpen event received:", event.url);
      await processDeepLink(event.url);
    });
  } catch (e) {
    console.warn("[App] Deep links not supported in this environment:", e);
  }

  // check launch url (cold start)
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

  // test helper
  window.testDeepLink = (id) => {
    console.log(`[debug] simulating deep link for id: ${id}`);
    const mockUrl = `pocket8://play?id=${id}`;
    processDeepLink(mockUrl);
  };

  let lastProcessedUrl = "";
  let lastProcessedTime = 0;

  window.handleOpenUrl = (url) => {
    const now = Date.now();

    // debounce
    if (url === lastProcessedUrl && now - lastProcessedTime < 3000) {
      console.log("[App] Ignoring duplicate pulse:", url);
      return;
    }

    lastProcessedUrl = url;
    lastProcessedTime = now;

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

.app-root {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
</style>
