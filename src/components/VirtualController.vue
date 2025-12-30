<template>
  <div
    class="relative w-full h-full flex justify-between items-center px-6 pb-6 landscape:grid landscape:grid-cols-[240px_1fr_240px] landscape:p-0 landscape:items-stretch pointer-events-auto select-none"
    style="
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      touch-action: none;
    "
    @touchstart.prevent="handleTouch"
    @touchmove.prevent="handleTouch"
    @touchend.prevent="handleTouchEnd"
    @touchcancel.prevent="handleTouchEnd"
    @mousedown.prevent="handleTouch"
    @mousemove.prevent="handleTouch"
    @mouseup.prevent="handleTouchEnd"
    @mouseleave.prevent="handleTouchEnd"
  >
    <!-- d-pad container left -->
    <!-- landscape: center left -->
    <template v-if="!useJoystick">
      <div
        ref="dpadRef"
        class="relative w-40 h-40 small:w-36 small:h-36 ml-2 active:scale-95 transition-transform duration-100 ease-out landscape:ml-0 landscape:self-center landscape:justify-self-center touch-action-none landscape:col-start-1"
        style="
          -webkit-tap-highlight-color: transparent;
          touch-action: none;
          -webkit-user-select: none;
          user-select: none;
          will-change: transform;
        "
      >
        <!-- glow effect -->
        <div
          class="absolute inset-0 bg-white/5 blur-3xl rounded-full transform -translate-y-4"
        ></div>

        <!-- d-pad svg -->
        <svg
          viewBox="0 0 100 100"
          class="w-full h-full drop-shadow-2xl pointer-events-none"
        >
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
              :class="{ 'fill-white/30': activeKeys.has(38) }"
              class="transition-colors duration-150"
            />
            <path
              d="M36 66 V88 A4 4 0 0 0 64 88 V66 H36"
              fill="url(#glass-gradient)"
              :class="{ 'fill-white/30': activeKeys.has(40) }"
              class="transition-colors duration-150"
            />
            <path
              d="M34 36 H12 A4 4 0 0 0 12 64 H34 V36"
              fill="url(#glass-gradient)"
              :class="{ 'fill-white/30': activeKeys.has(37) }"
              class="transition-colors duration-150"
            />
            <path
              d="M66 36 H88 A4 4 0 0 1 88 64 H66 V36"
              fill="url(#glass-gradient)"
              :class="{ 'fill-white/30': activeKeys.has(39) }"
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
      </div>
    </template>

    <!-- joystick container -->
    <template v-else>
      <div
        ref="dpadRef"
        class="relative w-40 h-40 small:w-36 small:h-36 ml-2 landscape:ml-0 landscape:self-center landscape:justify-self-center touch-action-none landscape:col-start-1 flex items-center justify-center"
        style="
          -webkit-tap-highlight-color: transparent;
          touch-action: none;
          -webkit-user-select: none;
          user-select: none;
        "
      >
        <!-- glow -->
        <div
          class="absolute inset-0 bg-white/5 blur-3xl rounded-full transform -translate-y-4"
        ></div>

        <!-- joystick base -->
        <div
          class="w-full h-full rounded-full border border-white/20 bg-white/5 backdrop-blur-md shadow-2xl relative"
        >
          <!-- inner stick -->
          <div
            ref="joystickStickRef"
            class="absolute top-1/2 left-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full bg-white shadow-[0_4px_15px_rgba(0,0,0,0.3)] will-change-transform"
          >
            <!-- stick highlight -->
            <div
              class="absolute top-0 left-0 w-full h-full rounded-full bg-gradient-to-br from-white to-gray-300"
            ></div>
          </div>
        </div>
      </div>
    </template>

    <!-- menu button -->
    <button
      class="hidden landscape:flex absolute top-6 left-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] active:bg-white/20 active:scale-95 transition-all duration-300 items-center justify-center z-50 pointer-events-auto"
      @click="openMenu"
      @touchstart.stop.prevent="openMenu"
    >
      <!-- home icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="w-5 h-5 text-white/80 pointer-events-none"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    </button>

    <!-- portrait home button -->
    <button
      class="landscape:hidden absolute top-2 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] active:bg-white/20 active:scale-95 transition-all duration-300 flex items-center justify-center z-40 pointer-events-auto"
      @click="openMenu"
      @touchstart.stop.prevent="openMenu"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="w-5 h-5 text-white/80 pointer-events-none"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    </button>

    <!-- center controls -->
    <div
      class="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-8 pointer-events-auto landscape:hidden"
    >
      <!-- portrait select -->
      <button
        class="group flex flex-col items-center gap-2 active:scale-95 transition-transform duration-300 min-w-[44px] min-h-[44px] justify-center pointer-events-auto"
        @click="openMenu"
        @touchstart.stop.prevent="openMenu"
      >
        <div
          class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg] pointer-events-none"
        ></div>
        <span
          class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans pointer-events-none"
          >select</span
        >
      </button>

      <!-- portrait start -->
      <button
        class="group flex flex-col items-center gap-2 active:scale-95 transition-transform duration-300 min-w-[44px] min-h-[44px] justify-center"
        @touchstart.stop.prevent="pressKey(13)"
        @touchend.stop.prevent="releaseKey(13)"
        @mousedown.stop.prevent="pressKey(13)"
        @mouseup.stop.prevent="releaseKey(13)"
      >
        <div
          class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg] pointer-events-none"
        ></div>
        <span
          class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans pointer-events-none"
          >start</span
        >
      </button>
    </div>

    <!-- action buttons -->
    <div
      ref="actionZoneRef"
      class="relative w-36 h-48 landscape:w-full landscape:h-full small:w-36 small:h-48 pointer-events-auto mr-0 flex items-end justify-end landscape:items-center landscape:justify-center landscape:col-start-3"
      @touchstart.prevent="handleActionTouch"
      @touchmove.prevent="handleActionTouch"
      @touchend.prevent="handleActionTouch"
      @touchcancel.prevent="handleActionTouch"
    >
      <!-- button container -->
      <div
        class="relative w-full h-full select-none touch-none pointer-events-none landscape:w-40 landscape:h-40"
      >
        <!-- button 1 (right) -->
        <button
          ref="btn1Ref"
          class="absolute bottom-24 right-1 landscape:bottom-auto landscape:top-0 landscape:right-0 w-20 h-20 small:w-16 small:h-16 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] backdrop-blur-md transition-transform duration-75 flex items-center justify-center border pointer-events-none overflow-hidden will-change-transform"
          :class="[
            btn1.label === 'o'
              ? 'bg-[rgba(255,0,77,0.15)] border-[#FF004D]/80'
              : 'bg-[rgba(41,173,255,0.15)] border-[#29ADFF]/80',
            activeKeys.has(btn1.code) ? 'scale-95' : '',
          ]"
        >
          <!-- active overlay -->
          <div
            class="absolute inset-0 bg-white/20 transition-opacity duration-75"
            :class="activeKeys.has(btn1.code) ? 'opacity-100' : 'opacity-0'"
          ></div>

          <span
            class="text-white font-bold text-3xl font-pico opacity-90 flex items-center justify-center translate-x-[2px] -translate-y-[3px] z-10"
            :class="{ 'opacity-100': activeKeys.has(btn1.code) }"
            >{{ btn1.label }}</span
          >
        </button>

        <!-- button 2 (left) -->
        <button
          ref="btn2Ref"
          class="absolute bottom-4 right-16 landscape:bottom-0 landscape:left-0 w-20 h-20 small:w-16 small:h-16 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] backdrop-blur-md transition-transform duration-75 flex items-center justify-center border pointer-events-none overflow-hidden will-change-transform"
          :class="[
            btn2.label === 'o'
              ? 'bg-[rgba(255,0,77,0.15)] border-[#FF004D]/80'
              : 'bg-[rgba(41,173,255,0.15)] border-[#29ADFF]/80',
            activeKeys.has(btn2.code) ? 'scale-95' : '',
          ]"
        >
          <!-- active overlay -->
          <div
            class="absolute inset-0 bg-white/20 transition-opacity duration-75"
            :class="activeKeys.has(btn2.code) ? 'opacity-100' : 'opacity-0'"
          ></div>

          <span
            class="text-white font-bold text-3xl font-pico opacity-90 flex items-center justify-center translate-x-[2px] -translate-y-[3px] z-10"
            :class="{ 'opacity-100': activeKeys.has(btn2.code) }"
            >{{ btn2.label }}</span
          >
        </button>
      </div>
    </div>

    <!-- landscape navigation -->
    <!-- positioned inward to be closer to game view corners and away from controls -->

    <!-- landscape select -->
    <button
      class="hidden landscape:flex absolute bottom-4 left-6 w-16 h-16 pointer-events-auto items-center justify-center flex-col gap-1 active:scale-95 transition-transform duration-300 z-50 pointer-events-auto"
      @click="openMenu"
      @touchstart.stop.prevent="openMenu"
    >
      <div
        class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg] pointer-events-none"
      ></div>
      <span
        class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans mt-1 pointer-events-none"
        >select</span
      >
    </button>

    <!-- landscape start -->
    <button
      class="hidden landscape:flex absolute bottom-4 right-6 w-16 h-16 pointer-events-auto items-center justify-center flex-col gap-1 active:scale-95 transition-transform duration-300 z-50 pointer-events-auto"
      @touchstart.stop.prevent="pressKey(13)"
      @touchend.stop.prevent="releaseKey(13)"
      @mousedown.stop.prevent="pressKey(13)"
      @mouseup.stop.prevent="releaseKey(13)"
    >
      <div
        class="w-12 h-4 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm active:bg-white/40 transition-colors -rotate-[25deg] pointer-events-none"
      ></div>
      <span
        class="text-[10px] font-bold text-white/50 tracking-widest uppercase font-sans mt-1 pointer-events-none"
        >start</span
      >
    </button>
  </div>
</template>

<script setup>
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { picoBridge } from "../services/PicoBridge";
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useLibraryStore } from "../stores/library";
import { storeToRefs } from "pinia";

// # store access
const libraryStore = useLibraryStore();
const { swapButtons, useJoystick } = storeToRefs(libraryStore);

// # joystick state
const joystickState = reactive({
  active: false,
});
const joystickBaseRef = ref(null);

// # active keys tracking
const activeKeys = reactive(new Set());

// # button mapping
const btn1 = computed(() =>
  swapButtons.value
    ? { label: "x", code: 88, color: "#29ADFF" }
    : { label: "o", code: 90, color: "#FF004D" }
);

const btn2 = computed(() =>
  swapButtons.value
    ? { label: "o", code: 90, color: "#FF004D" }
    : { label: "x", code: 88, color: "#29ADFF" }
);

const dpadRef = ref(null);
const actionZoneRef = ref(null);
const btn1Ref = ref(null);
const btn2Ref = ref(null);
const joystickStickRef = ref(null);

let dpadTouchId = null;
let isMouseDown = false;
let audioResumed = false;
let currentDirection = null;

// internal state
let dpadState = {
  x: 0, // logical center x
  y: 0, // logical center y
  visualX: 0, // svg center x
  visualY: 0, // svg center y
  rect: null,
  startX: 0, // touch start x
  startY: 0, // touch start y
  lastTouchX: 0,
  lastTouchY: 0,
  lastInputTime: 0,
  driftFrameId: null,
};

let actionState = {
  btn1Rect: null,
  btn2Rect: null,
};

const emit = defineEmits(["menu"]);

const cacheDpadMetrics = () => {
  if (dpadRef.value) {
    const rect = dpadRef.value.getBoundingClientRect();
    dpadState.rect = rect;
    dpadState.visualX = rect.left + rect.width / 2;
    dpadState.visualY = rect.top + rect.height / 2;
  }
  if (btn1Ref.value)
    actionState.btn1Rect = btn1Ref.value.getBoundingClientRect();
  if (btn2Ref.value)
    actionState.btn2Rect = btn2Ref.value.getBoundingClientRect();
};

const isInsideRect = (x, y, rect, padding = 20) => {
  if (!rect) return false;
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  );
};

const updateKey = (code, isPressed) => {
  const wasPressed = activeKeys.has(code);
  if (isPressed && !wasPressed) pressKey(code);
  else if (!isPressed && wasPressed) releaseKey(code);
};

// add piano push
const handleActionTouch = (e) => {
  if (!actionState.btn1Rect) cacheDpadMetrics();

  const touches = e.touches;
  let isBtn1 = false;
  let isBtn2 = false;

  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const x = t.clientX;
    const y = t.clientY;

    if (isInsideRect(x, y, actionState.btn1Rect)) isBtn1 = true;
    if (isInsideRect(x, y, actionState.btn2Rect)) isBtn2 = true;
  }

  updateKey(btn1.value.code, isBtn1);
  updateKey(btn2.value.code, isBtn2);
};

const handleTouch = (e) => {
  if (e.type.startsWith("mouse")) {
    handleMouseInput(e);
    return;
  }

  const touches = e.changedTouches;
  const now = Date.now();

  // new interaction
  if (dpadTouchId === null) {
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];

      // lazy init cache
      if (!dpadState.rect) cacheDpadMetrics();

      if (isInsideDpad(t.clientX, t.clientY)) {
        dpadTouchId = t.identifier;
        dpadState.startX = t.clientX;
        dpadState.startY = t.clientY;
        dpadState.lastTouchX = t.clientX;
        dpadState.lastTouchY = t.clientY;
        dpadState.lastInputTime = now;

        // joystick mode
        if (useJoystick.value) {
          processJoystickCoordinates(t.clientX, t.clientY);
          return;
        }

        // dpad mode
        // hybrid logic: absolute vs relative start
        const distFromVisualSq = getDistSq(
          t.clientX,
          t.clientY,
          dpadState.visualX,
          dpadState.visualY
        );

        if (distFromVisualSq > 400) {
          dpadState.x = dpadState.visualX;
          dpadState.y = dpadState.visualY;
        } else {
          dpadState.x = t.clientX;
          dpadState.y = t.clientY;
        }

        processDpadCoordinates(t.clientX, t.clientY);
        return;
      }
    }
  }

  if (dpadTouchId !== null) {
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      if (t.identifier === dpadTouchId) {
        dpadState.lastTouchX = t.clientX;
        dpadState.lastTouchY = t.clientY;
        dpadState.lastInputTime = now;

        if (useJoystick.value) {
          processJoystickCoordinates(t.clientX, t.clientY);
        } else {
          processDpadCoordinates(t.clientX, t.clientY);
        }
        return;
      }
    }
  }
};

const handleTouchEnd = (e) => {
  if (e.changedTouches) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === dpadTouchId) {
        clearDpadState();
        return;
      }
    }
  } else {
    clearDpadState();
  }
};

const clearDpadState = () => {
  dpadTouchId = null;
  isMouseDown = false;
  currentDirection = null;

  // reset joystick visual
  if (joystickStickRef.value) {
    joystickStickRef.value.style.transform = `translate3d(0px, 0px, 0)`;
  }
  joystickState.active = false;

  for (const k of DPAD_CODES) {
    if (activeKeys.has(k)) {
      sendKey(k, "keyup");
      activeKeys.delete(k);
    }
  }
};

const handleMouseInput = (e) => {
  if (e.type === "mousedown") {
    isMouseDown = true;
    cacheDpadMetrics();
    dpadState.lastInputTime = Date.now();

    if (dpadState.driftFrameId) {
      cancelAnimationFrame(dpadState.driftFrameId);
      dpadState.driftFrameId = null;
    }

    dpadState.startX = e.clientX;
    dpadState.startY = e.clientY;
    dpadState.lastTouchX = e.clientX;
    dpadState.lastTouchY = e.clientY;

    const distSq = getDistSq(
      e.clientX,
      e.clientY,
      dpadState.visualX,
      dpadState.visualY
    );
    if (distSq > 400) {
      dpadState.x = dpadState.visualX;
      dpadState.y = dpadState.visualY;
    } else {
      dpadState.x = e.clientX;
      dpadState.y = e.clientY;
    }

    processDpadCoordinates(e.clientX, e.clientY);
  } else if (e.type === "mouseup") {
    clearDpadState();
  } else if (isMouseDown) {
    dpadState.lastInputTime = Date.now();
    dpadState.lastTouchX = e.clientX;
    dpadState.lastTouchY = e.clientY;
    processDpadCoordinates(e.clientX, e.clientY);
  }
};

const isInsideDpad = (x, y) => {
  const r = dpadState.rect;
  if (!r) return false;
  const PAD = 40;
  return (
    x >= r.left - PAD &&
    x <= r.right + PAD &&
    y >= r.top - PAD &&
    y <= r.bottom + PAD
  );
};

const getDistSq = (x1, y1, x2, y2) => {
  const dx = x1 - x2;
  const dy = (y1 - y2) * 1.1;
  return dx * dx + dy * dy;
};

const processJoystickCoordinates = (clientX, clientY) => {
  // center of joystick
  const rect = dpadState.rect;
  if (!rect) return;

  const dx = clientX - dpadState.visualX;
  const dy = clientY - dpadState.visualY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxRadius = 40;

  // calc clamped position for visual stick
  let clampX = dx;
  let clampY = dy;

  if (dist > maxRadius) {
    const ratio = maxRadius / dist;
    clampX = dx * ratio;
    clampY = dy * ratio;
  }

  // update visual state
  if (joystickStickRef.value) {
    joystickStickRef.value.style.transform = `translate3d(${clampX}px, ${clampY}px, 0)`;
  }
  joystickState.active = true;

  // logic: angle & deadzone
  if (dist < 10) {
    // deadzone
    if (currentDirection) {
      currentDirection = null;
      triggerKeys([]);
    }
    return;
  }

  let angle = Math.atan2(dy, dx) * RAD_TO_DEG;
  if (angle < 0) angle += 360;

  // snap to cardinal 8-way
  const newDirection = getDirectionFromAngle(angle, currentDirection);

  if (newDirection !== currentDirection) {
    currentDirection = newDirection;
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    triggerKeys(getKeysForDirection(newDirection));
  }
};

const processDpadCoordinates = (clientX, clientY) => {
  let dx = clientX - dpadState.x;
  let dy = (clientY - dpadState.y) * 1.1;
  const distSq = dx * dx + dy * dy;
  if (distSq < 225) {
    // 15px radius
    if (currentDirection) {
      currentDirection = null;
      triggerKeys([]);
    }
    return;
  }

  // dynamic center shift (ghost follow)
  if (distSq > 3600) {
    // 5% shift
    dpadState.x += dx * 0.05;
    dpadState.y += dy * 0.05;

    // recalc delta
    dx = clientX - dpadState.x;
    dy = (clientY - dpadState.y) * 1.1;
  }

  let angle = Math.atan2(dy, dx) * RAD_TO_DEG;
  if (angle < 0) angle += 360;

  const snap = 8;
  if (angle > 360 - snap || angle < snap) angle = 0;
  else if (angle > 90 - snap && angle < 90 + snap) angle = 90;
  else if (angle > 180 - snap && angle < 180 + snap) angle = 180;
  else if (angle > 270 - snap && angle < 270 + snap) angle = 270;

  let newDirection = getDirectionFromAngle(angle, currentDirection);

  if (newDirection !== currentDirection) {
    currentDirection = newDirection;
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    triggerKeys(getKeysForDirection(newDirection));
  }
};

const getDirectionFromAngle = (angle, currentDir) => {
  // tuned windows
  const stdHW = 32.5;

  // asymmetric top-left
  const reducedHW = 30.0;

  // standard hysteresis
  const buffer = 5;

  // sticky diagonal
  const isDiag = currentDir && currentDir.includes("_");
  const stickyPenalty = isDiag ? 5 : 0;

  const checkSector = (ang, center, hwLeft, hwRight) => {
    let lower = center - hwLeft;
    let upper = center + hwRight;

    // hysteresis: expand if it's the current direction
    if (currentDir === getCardinalName(center)) {
      lower -= buffer;
      upper += buffer;
    } else {
      // if sticky diagonal is active, shrink cardinal target
      lower += stickyPenalty;
      upper -= stickyPenalty;
    }

    if (lower >= 0 && upper < 360) return ang >= lower && ang <= upper;
    // wrap
    if (lower < 0) lower += 360;
    if (upper >= 360) upper -= 360;
    return ang >= lower || ang <= upper;
  };

  // right (0) - standard
  if (checkSector(angle, 0, stdHW, stdHW)) return "RIGHT";

  // down (90) - standard
  if (checkSector(angle, 90, stdHW, stdHW)) return "DOWN";

  // left (180) - asymmetric upper side
  if (checkSector(angle, 180, stdHW, reducedHW)) return "LEFT";

  // up (270) - asymmetric left side
  if (checkSector(angle, 270, reducedHW, stdHW)) return "UP";

  // diagonals (fallback)
  if (angle < 90) return "DOWN_RIGHT";
  if (angle < 180) return "DOWN_LEFT";
  if (angle < 270) return "UP_LEFT";
  return "UP_RIGHT";
};

const getCardinalName = (deg) => {
  if (deg === 0) return "RIGHT";
  if (deg === 90) return "DOWN";
  if (deg === 180) return "LEFT";
  if (deg === 270) return "UP";
  return null;
};

const RAD_TO_DEG = 180 / Math.PI;
const DPAD_CODES = new Set([37, 38, 39, 40]);

// static allocations (zero GC)
const KEYS_UP = [38];
const KEYS_DOWN = [40];
const KEYS_LEFT = [37];
const KEYS_RIGHT = [39];
const KEYS_UP_LEFT = [38, 37];
const KEYS_UP_RIGHT = [38, 39];
const KEYS_DOWN_LEFT = [40, 37];
const KEYS_DOWN_RIGHT = [40, 39];
const KEYS_EMPTY = [];

const getKeysForDirection = (dir) => {
  if (!dir) return KEYS_EMPTY;
  switch (dir) {
    case "UP":
      return KEYS_UP;
    case "DOWN":
      return KEYS_DOWN;
    case "LEFT":
      return KEYS_LEFT;
    case "RIGHT":
      return KEYS_RIGHT;
    case "UP_LEFT":
      return KEYS_UP_LEFT;
    case "UP_RIGHT":
      return KEYS_UP_RIGHT;
    case "DOWN_LEFT":
      return KEYS_DOWN_LEFT;
    case "DOWN_RIGHT":
      return KEYS_DOWN_RIGHT;
    default:
      return KEYS_EMPTY;
  }
};

const triggerKeys = (keyCodes) => {
  // release D-pad keys not in new set
  for (const k of activeKeys) {
    if (DPAD_CODES.has(k) && !keyCodes.includes(k)) {
      sendKey(k, "keyup");
      activeKeys.delete(k);
    }
  }
  // press new D-pad keys
  for (const k of keyCodes) {
    if (!activeKeys.has(k)) {
      sendKey(k, "keydown");
      activeKeys.add(k);
    }
  }
};

const sendKey = (keyCode, type) => {
  if (!audioResumed && type === "keydown") {
    picoBridge.resumeAudio();
    audioResumed = true;
  }

  const map = {
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    90: "z",
    88: "x",
    13: "Enter",
    27: "Escape",
  };
  const key = map[keyCode] || "";

  const event = new KeyboardEvent(type, {
    key: key,
    code: getCodeName(keyCode),
    keyCode: keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    view: window,
  });

  window.dispatchEvent(event);
  updateBitmask(keyCode, type === "keydown");
};

const pressKey = async (code) => {
  if (!audioResumed) {
    picoBridge.resumeAudio();
    audioResumed = true;
  }

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
  updateBitmask(code, true);
  activeKeys.add(code);

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
  updateBitmask(code, false);
  activeKeys.delete(code);
};

// # helpers
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

function updateBitmask(code, isDown) {
  if (!window.pico8_buttons) return;
  const bit =
    code === 37
      ? 1
      : code === 39
      ? 2
      : code === 38
      ? 4
      : code === 40
      ? 8
      : code === 90
      ? 16
      : code === 88
      ? 32
      : code === 13
      ? 64
      : 0;

  if (bit) {
    if (isDown) window.pico8_buttons[0] |= bit;
    else window.pico8_buttons[0] &= ~bit;
  }
}

const openMenu = (e) => {
  if (e) {
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }
  emit("menu");
  try {
    Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {}
};

onMounted(() => {
  window.addEventListener("resize", cacheDpadMetrics);
  window.addEventListener("orientationchange", () =>
    setTimeout(cacheDpadMetrics, 300)
  );
  setTimeout(cacheDpadMetrics, 200);
});

onUnmounted(() => {
  window.removeEventListener("resize", cacheDpadMetrics);
  clearDpadState();
});
</script>
