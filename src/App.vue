<template>
  <div
    class="antialiased min-h-screen bg-oled-dark text-white selection:bg-purple-500 selection:text-white"
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
        class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-8 py-3 min-w-[280px] rounded-full shadow-2xl backdrop-blur-md bg-neutral-900/90 border border-white/10 !pointer-events-none text-center"
      >
        <span class="text-white font-medium text-sm tracking-wide">{{
          toast.message.value
        }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { App } from "@capacitor/app";
import { Fullscreen } from "@boengli/capacitor-fullscreen";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Dialog } from "@capacitor/dialog";
import { RouterView, useRouter } from "vue-router";

// native permission plugin
const Permission = registerPlugin("Permission");
import { useToast } from "./composables/useToast";
import BiosImporter from "./components/BiosImporter.vue";
import { EngineLoader } from "./utils/EngineLoader";
import { libraryManager } from "./services/LibraryManager";
import { inputManager } from "./services/InputManager";
import { useLibraryStore } from "./stores/library";

const toast = useToast();
const router = useRouter();
const isEngineReady = ref(false);
const isCheckingEngine = ref(true);

onMounted(async () => {
  inputManager.init();

  // android immersive mode
  if (Capacitor.getPlatform() === "android") {
    try {
      await Fullscreen.activateImmersiveMode();

      // check file access
      const status = await Permission.check();
      console.log("[App] File Permission Status:", status.granted);

      if (!status.granted) {
        await Dialog.alert({
          title: "Setup Required",
          message:
            "Pocket8 needs 'All files access' to save cartridges to your Documents folder. Please grant this permission in the next screen.",
          buttonTitle: "Open Settings",
        });
        await Permission.request();
      }
    } catch (e) {
      console.warn("[App] Android setup error:", e);
    }
  }

  // check engine existence
  isEngineReady.value = await EngineLoader.check();
  isCheckingEngine.value = false;

  if (!isEngineReady.value) {
    console.warn("[App.vue] Bios missing. Prompting import.");
  } else {
    console.log("[App.vue] Engine ready. Waiting for Player to inject.");
  }

  // helper: process deep link url
  const processDeepLink = async (urlString) => {
    console.log("[App] Processing deep link:", urlString);
    const url = new URL(urlString);
    // handle example: pocket8://play?id=sphero_a1-0
    if (url.protocol.includes("pocket8") && url.host === "play" && url.searchParams.get("id")) {
      try {
        if (Capacitor.getPlatform() !== "android") {
          toast.showToast("Loading Cartridge...", "info");
        }

        // create the Carts/Images/Saves directories if they don't exist
        await libraryManager.init();

        // use centralized handler
        const result = await libraryManager.handleDeepLink(url.searchParams.get("id"));

        if (result.exists) {
          console.log("[App] Cart exists locally.");
        } else if (result.downloaded) {
          console.log("[App] Downloaded successfully.");
          toast.showToast("Saved Cart to Library", "success");
        }

        // android kickback
        if (Capacitor.getPlatform() === "android") {
          // refresh ui
          const libraryStore = useLibraryStore();
          await libraryStore.rescanLibrary();
          toast.showToast("Cart Loaded", "success");
        }

        // unify launch logic
        await router.push({
          name: "player",
          query: { cart: result.filename, t: Date.now() },
        });
      } catch (err) {
        console.error("[App] handleDeepLink failed:", err.message);
        toast.showToast("Failed to handle deep link: " + err.message, "error");
      }
    }
  };

  // deep link listener
  try {
    App.addListener("appUrlOpen", async (event) => {
      console.log("[App] appUrlOpen event received:", event.url);
      // debounce handler
      if (window.handleOpenUrl) {
        window.handleOpenUrl(event.url);
      } else {
        processDeepLink(event.url);
      }
    });
  } catch (e) {
    console.warn("[App] Deep links not supported in this environment:", e);
  }

  // check launch url (cold start)
  try {
    const launchUrl = await App.getLaunchUrl();
    console.log("[App] getLaunchUrl result:", launchUrl);

    if (launchUrl && launchUrl.url) {
      // prevent loop & debounce conflict
      const lastLaunch = localStorage.getItem("pico_last_launch_url");
      if (lastLaunch !== launchUrl.url) {
        console.log("[App] Cold start launch url detected:", launchUrl.url);
        localStorage.setItem("pico_last_launch_url", launchUrl.url);

        if (window.handleOpenUrl) {
          window.handleOpenUrl(launchUrl.url);
        } else {
          processDeepLink(launchUrl.url);
        }
      } else {
        console.log("[App] Ignoring duplicate launch URL (already processed).");
      }
    }
  } catch (e) {
    console.error("[App] getLaunchUrl failed:", e);
  }

  // test helper
  window.testDeepLink = (id) => {
    console.log(`[debug] simulating deep link for id: ${id}`);
    const mockUrl = `pocket8://play?id=${id}`;
    if (window.handleOpenUrl) window.handleOpenUrl(mockUrl);
  };

  let lastProcessedUrl = "";
  let lastProcessedTime = 0;

  window.handleOpenUrl = (url) => {
    const now = Date.now();

    // debounce: 3s
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

onUnmounted(() => {
  inputManager.destroy();
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
  min-height: 100vh;
}
</style>
