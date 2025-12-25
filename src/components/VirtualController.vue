<template>
  <div
    class="relative w-full h-full flex justify-between items-center pointer-events-none select-none px-6 pb-6 landscape:items-end landscape:pb-16 landscape:px-12"
  >
    <!-- D-PAD CONTAINER (Left) -->
    <div
      class="relative w-40 h-40 small:w-32 small:h-32 ml-2 pointer-events-auto active:scale-95 transition-transform duration-100 ease-out landscape:ml-2"
      @touchstart.prevent="handleDpadInput"
      @touchmove.prevent="handleDpadInput"
      @touchend.prevent="handleDpadEnd"
      @mousedown.prevent="handleDpadInput"
      @mousemove.prevent="handleDpadInput"
      @mouseup.prevent="handleDpadEnd"
      @mouseleave.prevent="handleDpadEnd"
    >
      <!-- Glow effect -->
      <div
        class="absolute inset-0 bg-white/5 blur-3xl rounded-full transform -translate-y-4"
      ></div>

      <!-- D-Pad SVG -->
      <svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient
            id="glass-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stop-color="rgba(255, 255, 255, 0.2)" />
            <stop offset="50%" stop-color="rgba(255, 255, 255, 0.05)" />
            <stop offset="100%" stop-color="rgba(255, 255, 255, 0.15)" />
          </linearGradient>
        </defs>

        <g stroke="rgba(255,255,255,0.2)" stroke-width="0.5">
          <path
            d="M36 34 V12 A4 4 0 0 1 64 12 V34 H36"
            fill="url(#glass-gradient)"
            :class="{ 'fill-white/30': currentDirection === 38 }"
            class="transition-colors duration-150"
          />
          <path
            d="M36 66 V88 A4 4 0 0 0 64 88 V66 H36"
            fill="url(#glass-gradient)"
            :class="{ 'fill-white/30': currentDirection === 40 }"
            class="transition-colors duration-150"
          />
          <path
            d="M34 36 H12 A4 4 0 0 0 12 64 H34 V36"
            fill="url(#glass-gradient)"
            :class="{ 'fill-white/30': currentDirection === 37 }"
            class="transition-colors duration-150"
          />
          <path
            d="M66 36 H88 A4 4 0 0 1 88 64 H66 V36"
            fill="url(#glass-gradient)"
            :class="{ 'fill-white/30': currentDirection === 39 }"
            class="transition-colors duration-150"
          />
          <rect
            x="36"
            y="36"
            width="28"
            height="28"
            fill="url(#glass-gradient)"
          />
        </g>
      </svg>

      <!-- LANDSCAPE SELECT BUTTON (Inside Left Container, Bottom Right) -->
      <button
        class="hidden landscape:flex absolute -bottom-8 -right-8 w-16 h-16 pointer-events-auto items-center justify-center flex-col gap-1 active:scale-95 transition-transform duration-300"
        @touchstart.prevent="pressKey(27)"
        @touchend.prevent="releaseKey(27)"
        @mousedown.prevent="pressKey(27)"
        @mouseup.prevent="releaseKey(27)"
      >
        <div
          class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg]"
        ></div>
        <span
          class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans mt-1"
          >SELECT</span
        >
      </button>
    </div>

    <!-- MENU BUTTON (Responsive) -->
    <!-- Portrait: Centered Bottom (in flow with center controls? No, let's keep it separate) -->
    <!-- Actually, better to duplicate or use strict absolute positioning relative to root -->

    <!-- LANDSCAPE HOME BUTTON (Top Left) -->
    <button
      class="hidden landscape:flex absolute top-6 left-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] active:bg-white/20 active:scale-95 transition-all duration-300 items-center justify-center z-50 pointer-events-auto"
      @click="openMenu"
      @touchstart.prevent="openMenu"
    >
      <!-- Home Icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="w-5 h-5 text-white/80"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    </button>

    <!-- CENTER CONTROLS (Portrait Only) -->
    <div
      class="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-auto pb-4 landscape:hidden"
    >
      <!-- PORTRAIT MENU BUTTON -->
      <button
        class="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[inner_0_0_10px_rgba(255,255,255,0.05)] active:bg-white/20 active:scale-95 transition-all duration-300 flex items-center justify-center mb-6"
        @click="openMenu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="w-5 h-5 text-white/80"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
      </button>

      <!-- START / SELECT PILLS -->
      <div class="flex gap-8">
        <!-- PORTRAIT SELECT (Escape/27) -->
        <button
          class="group flex flex-col items-center gap-2 active:scale-95 transition-transform duration-300 min-w-[44px] min-h-[44px] justify-center"
          @touchstart.prevent="pressKey(27)"
          @touchend.prevent="releaseKey(27)"
          @mousedown.prevent="pressKey(27)"
          @mouseup.prevent="releaseKey(27)"
        >
          <div
            class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg]"
          ></div>
          <span
            class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans"
            >SELECT</span
          >
        </button>

        <!-- PORTRAIT START (Enter/13) -->
        <button
          class="group flex flex-col items-center gap-2 active:scale-95 transition-transform duration-300 min-w-[44px] min-h-[44px] justify-center"
          @touchstart.prevent="pressKey(13)"
          @touchend.prevent="releaseKey(13)"
          @mousedown.prevent="pressKey(13)"
          @mouseup.prevent="releaseKey(13)"
        >
          <div
            class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg]"
          ></div>
          <span
            class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans"
            >START</span
          >
        </button>
      </div>
    </div>

    <!-- ACTION BUTTONS (Right) -->
    <div
      class="relative w-36 h-48 small:w-28 small:h-40 pointer-events-auto mr-2 flex items-end justify-end landscape:mr-2"
    >
      <!-- Button Container for grouping -->
      <div class="relative w-full h-full">
        <!-- O Button -->
        <button
          class="absolute bottom-24 right-2 w-20 h-20 small:w-16 small:h-16 rounded-full bg-[rgba(255,0,77,0.15)] shadow-[0_0_15px_rgba(255,255,255,0.3)] backdrop-blur-md active:translate-y-1 active:shadow-none transition-all duration-75 flex items-center justify-center group border border-[#FF004D]/80"
          @touchstart.prevent="pressKey(90)"
          @touchend.prevent="releaseKey(90)"
          @mousedown.prevent="pressKey(90)"
          @mouseup.prevent="releaseKey(90)"
        >
          <span
            class="text-white font-bold text-3xl font-pico opacity-90 group-active:opacity-100 flex items-center justify-center translate-x-[2px] -translate-y-[3px]"
            >O</span
          >
        </button>

        <!-- X Button -->
        <button
          class="absolute bottom-4 right-14 w-20 h-20 small:w-16 small:h-16 rounded-full bg-[rgba(41,173,255,0.15)] shadow-[0_0_15px_rgba(255,255,255,0.3)] backdrop-blur-md active:translate-y-1 active:shadow-none transition-all duration-75 flex items-center justify-center group border border-[#29ADFF]/80"
          @touchstart.prevent="pressKey(88)"
          @touchend.prevent="releaseKey(88)"
          @mousedown.prevent="pressKey(88)"
          @mouseup.prevent="releaseKey(88)"
        >
          <span
            class="text-white font-bold text-3xl font-pico opacity-90 group-active:opacity-100 flex items-center justify-center translate-x-[2px] -translate-y-[3px]"
            >X</span
          >
        </button>

        <!-- LANDSCAPE START BUTTON (Inside Right Container, Bottom Left) -->
        <button
          class="hidden landscape:flex absolute -bottom-8 -left-20 w-16 h-16 pointer-events-auto items-center justify-center flex-col gap-1 active:scale-95 transition-transform duration-300"
          @touchstart.prevent="pressKey(13)"
          @touchend.prevent="releaseKey(13)"
          @mousedown.prevent="pressKey(13)"
          @mouseup.prevent="releaseKey(13)"
        >
          <div
            class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg]"
          ></div>
          <span
            class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans mt-1"
            >START</span
          >
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { picoBridge } from "../services/PicoBridge";
import { ref } from "vue";

const currentDirection = ref(null);
let isMouseDown = false;

const handleDpadInput = (e) => {
  // Handle Mouse vs Touch
  let clientX, clientY;

  if (e.type.startsWith("touch")) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    // Mouse
    if (e.type === "mousedown") isMouseDown = true;
    if (e.type === "mousemove" && !isMouseDown) return;
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const target = e.currentTarget;
  const rect = target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Calculate angle
  const deltaX = clientX - centerX;
  const deltaY = clientY - centerY;
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  // Map to Direction (Cones)
  let newDirection = null;

  // Right: -45 to 45
  if (angle > -45 && angle <= 45) newDirection = 39;
  // Down: 45 to 135
  else if (angle > 45 && angle <= 135) newDirection = 40;
  // Up: -135 to -45
  else if (angle > -135 && angle <= -45) newDirection = 38;
  // Left: 135 to 180 OR -180 to -135
  else newDirection = 37;

  if (newDirection !== currentDirection.value) {
    if (currentDirection.value) releaseKey(currentDirection.value);
    if (newDirection) pressKey(newDirection);
    currentDirection.value = newDirection;
  }
};

const handleDpadEnd = () => {
  isMouseDown = false;
  if (currentDirection.value) {
    releaseKey(currentDirection.value);
    currentDirection.value = null;
  }
};

// KeyCodes:
// Left: 37, Right: 39, Up: 38, Down: 40
// Z (O): 90, X (X): 88
// Enter (Pause): 13
// Escape (Select): 27

let audioResumed = false;

const pressKey = async (code) => {
  // 1. Audio Resume (One-time trigger)
  if (!audioResumed) {
    picoBridge.resumeAudio();
    audioResumed = true;
  }

  // Dispatch 'keydown' to window, document, and canvas
  const event = new KeyboardEvent("keydown", {
    key: getKeyName(code),
    code: getCodeName(code),
    keyCode: code,
    which: code,
    bubbles: true,
    cancelable: true,
    view: window,
  });

  window.dispatchEvent(event);
  document.dispatchEvent(event); // Fallback

  // Also try specific PICO-8 global input array if available (as backup)
  updateBitmask(code, true);

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

const releaseKey = (code) => {
  const event = new KeyboardEvent("keyup", {
    key: getKeyName(code),
    code: getCodeName(code),
    keyCode: code,
    which: code,
    bubbles: true,
    cancelable: true,
    view: window,
  });

  window.dispatchEvent(event);
  document.dispatchEvent(event);

  updateBitmask(code, false);
};

const emit = defineEmits(["menu"]);

// Helpers for robust event generation
function getKeyName(code) {
  if (code === 37) return "ArrowLeft";
  if (code === 39) return "ArrowRight";
  if (code === 38) return "ArrowUp";
  if (code === 40) return "ArrowDown";
  if (code === 90) return "z";
  if (code === 88) return "x";
  if (code === 13) return "Enter";
  if (code === 27) return "Escape";
  return "";
}

function getCodeName(code) {
  if (code === 37) return "ArrowLeft";
  if (code === 39) return "ArrowRight";
  if (code === 38) return "ArrowUp";
  if (code === 40) return "ArrowDown";
  if (code === 90) return "KeyZ";
  if (code === 88) return "KeyX";
  if (code === 13) return "Enter";
  if (code === 27) return "Escape";
  return "";
}

// Legacy global array support (just in case)
function updateBitmask(code, isDown) {
  if (!window.pico8_buttons) return;
  let bit = 0;
  if (code === 37) bit = 1; // Left
  if (code === 39) bit = 2; // Right
  if (code === 38) bit = 4; // Up
  if (code === 40) bit = 8; // Down
  if (code === 90) bit = 16; // Z (O)
  if (code === 88) bit = 32; // X (X)
  if (code === 13) bit = 64; // Pause (Menu)

  if (bit) {
    if (isDown) window.pico8_buttons[0] |= bit;
    else window.pico8_buttons[0] &= ~bit;
  }
}

const openMenu = () => {
  emit("menu");
  try {
    Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {}
};
</script>
