<template>
  <div
    class="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
  >
    <!-- background gradient -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-blue-900/20 pointer-events-none"
    ></div>

    <div class="relative z-10 max-w-md w-full animate-fade-in-up">
      <!-- header -->
      <h1 class="text-3xl font-bold text-white mb-2 tracking-tight">
        Engine Required
      </h1>
      <p class="text-gray-400 mb-8 leading-relaxed">
        To play PICO-8 games, you need to provide the <code>bios.js</code> file
        from your official PICO-8 web export.
      </p>

      <!-- input area -->
      <div
        class="group relative rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition-all hover:border-purple-500/50 hover:bg-white/10"
        @click="triggerFilePicker"
        @dragover.prevent
        @drop.prevent="handleDrop"
      >
        <div class="flex flex-col items-center gap-4">
          <p class="text-sm font-medium text-gray-300 group-hover:text-white">
            Tap to upload <span class="text-purple-400">bios.js</span>
          </p>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".js"
          class="hidden"
          @change="handleFileSelect"
        />
      </div>

      <!-- status/error message -->
      <div v-if="statusMessage" class="mt-6 flex flex-col items-center gap-2">
        <div
          class="px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-md border"
          :class="
            isError
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-green-500/10 border-green-500/30 text-green-400'
          "
        >
          {{ statusMessage }}
        </div>
        <button
          v-if="isSuccess"
          @click="reloadApp"
          class="mt-4 px-6 py-2 bg-white text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all text-sm"
        >
          Reload App
        </button>
      </div>

      <!-- help text -->
      <div
        class="mt-8 text-xs text-gray-500 max-w-sm mx-auto text-center leading-relaxed"
      >
        <p>
          Open PICO-8, and load any cartridge. Type
          <code class="text-purple-400">export bios.html</code>, then type
          <code class="text-purple-400">folder</code> and an explorer window
          will open to the <span class="text-gray-300">bios.js</span> file.
          Pocket8 stores the <span class="text-gray-300">bios.js</span> file in
          <span class="text-gray-300">Pocket8 > Data</span>.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { haptics } from "../utils/haptics";

const fileInput = ref(null);
const statusMessage = ref("");
const isError = ref(false);
const isSuccess = ref(false);

const triggerFilePicker = () => {
  haptics.impact();
  fileInput.value.click();
};

const handleFileSelect = async (event) => {
  const file = event.target.files[0];
  if (file) await processFile(file);
};

const handleDrop = async (event) => {
  const file = event.dataTransfer.files[0];
  if (file) await processFile(file);
};

const processFile = async (file) => {
  // reset state
  statusMessage.value = "Analyzing file...";
  isError.value = false;

  // basic validation
  // .js check is loose, but we mainly care about specific content
  if (!file.name.endsWith(".js")) {
    showError("Invalid file type. Please upload bios.js");
    return;
  }

  try {
    const text = await file.text();

    // content check for PICO-8 signatures
    if (!text.includes("PICO-8") && !text.includes("Module")) {
      showError("This doesn't look like a valid PICO-8 bios file.");
      return;
    }

    statusMessage.value = "Saving engine to sandbox...";

    // ensure data directory exists
    try {
      await Filesystem.mkdir({
        path: "data",
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (e) {}

    // save
    await Filesystem.writeFile({
      path: "data/bios.js",
      data: text,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    isSuccess.value = true;
    isError.value = false;
    statusMessage.value = "Success! Engine installed.";
    haptics.success();

    // auto-reload after short delay
    setTimeout(reloadApp, 1500);
  } catch (err) {
    console.error(err);
    showError("Failed to save file: " + err.message);
  }
};

const showError = (msg) => {
  isError.value = true;
  statusMessage.value = msg;
  haptics.error();
};

const reloadApp = () => {
  window.location.reload();
};
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
