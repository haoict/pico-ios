<template>
  <div
    class="virtual-controller relative w-full h-full select-none"
    @touchstart.prevent="handleTouch"
    @touchmove.prevent="handleTouch"
    @touchend.prevent="handleTouchEnd"
    @touchcancel.prevent="handleTouchEnd"
    @mousedown.prevent="handleTouch"
    @mousemove.prevent="handleTouch"
    @mouseup.prevent="handleTouchEnd"
    @mouseleave.prevent="handleTouchEnd"
  >
    <div
      class="portrait-layout absolute inset-0 flex flex-col z-10 pointer-events-none pb-[max(env(safe-area-inset-bottom),20px)]"
    >
      <div class="flex-grow"></div>

      <div
        class="flex flex-row items-center justify-between px-6 w-full max-w-[480px] min-[600px]:max-w-none min-[600px]:px-16 mx-auto flex-shrink-0"
      >
        <div
          class="control-group relative w-[42vmin] max-w-[180px] aspect-square pointer-events-auto"
          ref="dpadRef"
          @touchstart.prevent="handleDPadTouch"
          @touchmove.prevent="handleDPadTouch"
          @touchend.prevent="handleTouchEnd"
        >
          <template v-if="!useJoystick">
            <div class="relative w-full h-full">
              <!-- D-PAD -->
              <svg viewBox="0 0 110 110" class="w-full h-full drop-shadow-2xl">
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
                    <stop
                      offset="100%"
                      stop-color="rgba(255, 255, 255, 0.15)"
                    />
                  </linearGradient>
                </defs>
                <g
                  transform="translate(5,5)"
                  fill="url(#glass-gradient)"
                  stroke="rgba(255,255,255,0.1)"
                  stroke-width="0.5"
                >
                  <path
                    d="M36 34 V12 A4 4 0 0 1 64 12 V34 H36"
                    :class="{ 'fill-white/40': activeKeys.has(38) }"
                  />
                  <path
                    d="M36 66 V88 A4 4 0 0 0 64 88 V66 H36"
                    :class="{ 'fill-white/40': activeKeys.has(40) }"
                  />
                  <path
                    d="M34 36 H12 A4 4 0 0 0 12 64 H34 V36"
                    :class="{ 'fill-white/40': activeKeys.has(37) }"
                  />
                  <path
                    d="M66 36 H88 A4 4 0 0 1 88 64 H66 V36"
                    :class="{ 'fill-white/40': activeKeys.has(39) }"
                  />
                  <rect x="36" y="36" width="28" height="28" />
                </g>
              </svg>
            </div>
          </template>
          <template v-else>
            <div
              class="relative w-full h-full rounded-full border-2 border-white/10 bg-white/5 small:w-full small:h-full"
            >
              <div
                ref="joystickStickRef"
                class="absolute w-1/3 h-1/3 rounded-full bg-white/20 shadow-lg border border-white/10 pointer-events-none"
                :style="{
                  transform: `translate3d(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px), 0)`,
                  top: '50%',
                  left: '50%',
                }"
              ></div>
            </div>
          </template>
        </div>

        <!-- ACTION BUTTONS -->
        <div
          class="control-group relative w-[42vmin] max-w-[180px] aspect-square pointer-events-auto"
          ref="actionZoneRef"
          @touchstart.prevent="handleActionTouch"
          @touchmove.prevent="handleActionTouch"
          @touchend.prevent="handleActionTouch"
        >
          <!-- button 1 (top right) -->
          <div
            ref="btn1Ref"
            class="absolute top-[2%] right-[2%] w-[48%] h-[48%] rounded-full shadow-lg border"
            :class="[
              btn1.label === 'o'
                ? 'bg-red-500/20 border-red-500/50'
                : 'bg-blue-500/20 border-blue-500/50',
              { '!bg-white/40 !scale-95': activeKeys.has(btn1.code) },
            ]"
          >
            <span
              class="text-white font-bold font-pico absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(1.5rem,5vw,2.25rem)]"
              >{{ btn1.label }}</span
            >
          </div>
          <!-- button 2 (bottom left) -->
          <div
            ref="btn2Ref"
            class="absolute bottom-[2%] left-[2%] w-[48%] h-[48%] rounded-full shadow-lg border"
            :class="[
              btn2.label === 'o'
                ? 'bg-red-500/20 border-red-500/50'
                : 'bg-blue-500/20 border-blue-500/50',
              { '!bg-white/40 !scale-95': activeKeys.has(btn2.code) },
            ]"
          >
            <span
              class="text-white font-bold font-pico absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(1.5rem,5vw,2.25rem)]"
              >{{ btn2.label }}</span
            >
          </div>
        </div>
      </div>

      <!-- start / select (bottom center) -->
      <div
        class="w-full flex justify-center pb-4 mt-12 pointer-events-auto gap-8 min-[850px]:mt-20 transition-[margin] duration-300"
      >
        <button
          class="flex flex-col items-center gap-1"
          @click="openMenu"
          @touchstart.stop.prevent="openMenu"
        >
          <div
            class="w-12 h-4 rounded-full bg-white/20 border border-white/10 shadow-sm -rotate-12"
          ></div>
          <span class="text-[10px] font-bold text-white/50 tracking-widest"
            >SELECT</span
          >
        </button>
        <button
          class="flex flex-col items-center gap-1"
          @touchstart.stop.prevent="inputManager.dispatchKey(80, 'keydown')"
          @touchend.stop.prevent="inputManager.dispatchKey(80, 'keyup')"
        >
          <div
            class="w-12 h-4 rounded-full bg-white/20 border border-white/10 shadow-sm -rotate-12"
          ></div>
          <span class="text-[10px] font-bold text-white/50 tracking-widest"
            >START</span
          >
        </button>
      </div>
    </div>

    <!-- landscape layout -->
    <div
      class="landscape-layout absolute inset-0 flex-row justify-between items-end px-[max(env(safe-area-inset-left),30px)] pr-[max(env(safe-area-inset-right),30px)] pb-[max(env(safe-area-inset-bottom),40px)] pointer-events-none z-10"
      style="display: none"
    >
      <!-- left: dpad + select -->
      <div
        class="flex flex-col items-center justify-end gap-5 min-[850px]:gap-20 pointer-events-auto h-full"
      >
        <div
          ref="dpadRefLS"
          class="relative w-[min(32vh,38vw)] max-w-[180px] aspect-square"
        >
          <template v-if="!useJoystick">
            <svg viewBox="0 0 110 110" class="w-full h-full drop-shadow-2xl">
              <defs>
                <linearGradient
                  id="glass-gradient-ls"
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
              <g
                transform="translate(5,5)"
                fill="url(#glass-gradient-ls)"
                stroke="rgba(255,255,255,0.1)"
                stroke-width="0.5"
              >
                <path
                  d="M36 34 V12 A4 4 0 0 1 64 12 V34 H36"
                  :class="{ 'fill-white/40': activeKeys.has(38) }"
                />
                <path
                  d="M36 66 V88 A4 4 0 0 0 64 88 V66 H36"
                  :class="{ 'fill-white/40': activeKeys.has(40) }"
                />
                <path
                  d="M34 36 H12 A4 4 0 0 0 12 64 H34 V36"
                  :class="{ 'fill-white/40': activeKeys.has(37) }"
                />
                <path
                  d="M66 36 H88 A4 4 0 0 1 88 64 H66 V36"
                  :class="{ 'fill-white/40': activeKeys.has(39) }"
                />
                <rect x="36" y="36" width="28" height="28" />
              </g>
            </svg>
          </template>
          <template v-else>
            <div
              class="relative w-full h-full rounded-full border-2 border-white/10 bg-white/5"
            >
              <div
                class="absolute w-1/3 h-1/3 top-1/3 left-1/3 rounded-full bg-white/20 shadow-lg border border-white/10 pointer-events-none"
                :style="{
                  transform: `translate3d(${thumbX}px, ${thumbY}px, 0)`,
                }"
              ></div>
            </div>
          </template>
        </div>

        <button
          class="flex flex-col items-center gap-1"
          @click="openMenu"
          @touchstart.stop.prevent="openMenu"
        >
          <div
            class="w-12 h-4 rounded-full bg-white/20 border border-white/10 shadow-sm -rotate-12"
          ></div>
          <span class="text-[10px] font-bold text-white/50 tracking-widest"
            >SELECT</span
          >
        </button>
      </div>

      <!-- right: buttons + start -->
      <div
        class="flex flex-col items-center gap-6 min-[850px]:gap-16 pointer-events-auto"
      >
        <div
          ref="actionZoneRefLS"
          class="relative w-[min(32vh,38vw)] max-w-[180px] aspect-square"
          @touchstart.prevent="handleActionTouch"
          @touchmove.prevent="handleActionTouch"
          @touchend.prevent="handleActionTouch"
        >
          <!-- button 1 (top right) -->
          <div
            ref="btn1RefLS"
            class="absolute top-[2%] right-[2%] w-[48%] h-[48%] rounded-full shadow-lg border flex items-center justify-center"
            :class="[
              btn1.label === 'o'
                ? 'bg-red-500/20 border-red-500/50'
                : 'bg-blue-500/20 border-blue-500/50',
              { '!bg-white/40 !scale-95': activeKeys.has(btn1.code) },
            ]"
          >
            <span
              class="text-white font-bold font-pico select-none text-[min(2.5rem,8vmin)] translate-x-[2px] -translate-y-[2px]"
              >{{ btn1.label }}</span
            >
          </div>
          <!-- button 2 (bottom left) -->
          <div
            ref="btn2RefLS"
            class="absolute bottom-[2%] left-[2%] w-[48%] h-[48%] rounded-full shadow-lg border flex items-center justify-center"
            :class="[
              btn2.label === 'o'
                ? 'bg-red-500/20 border-red-500/50'
                : 'bg-blue-500/20 border-blue-500/50',
              { '!bg-white/40 !scale-95': activeKeys.has(btn2.code) },
            ]"
          >
            <span
              class="text-white font-bold font-pico select-none text-[min(2.5rem,8vmin)] translate-x-[2px] -translate-y-[2px]"
              >{{ btn2.label }}</span
            >
          </div>
        </div>

        <button
          class="flex flex-col items-center gap-1"
          @touchstart.stop.prevent="inputManager.dispatchKey(80, 'keydown')"
          @touchend.stop.prevent="inputManager.dispatchKey(80, 'keyup')"
        >
          <div
            class="w-12 h-4 rounded-full bg-white/20 border border-white/10 shadow-sm -rotate-12"
          ></div>
          <span class="text-[10px] font-bold text-white/50 tracking-widest"
            >START</span
          >
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { haptics } from "../utils/haptics";
import { ImpactStyle } from "@capacitor/haptics";
import { inputManager } from "../services/InputManager";
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
const joystickStickRef = ref(null);
const thumbX = ref(0);
const thumbY = ref(0);

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

// Portrait refs
const dpadRef = ref(null);
const actionZoneRef = ref(null);
const btn1Ref = ref(null);
const btn2Ref = ref(null);

// Landscape refs
const dpadRefLS = ref(null);
const actionZoneRefLS = ref(null);
const btn1RefLS = ref(null);
const btn2RefLS = ref(null);

let dpadTouchId = null;
let isMouseDown = false;
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

const openMenu = () => {
  haptics.impact(ImpactStyle.Heavy);
  emit("menu");
};

const cacheDpadMetrics = () => {
  // determine active refs based on visibility (offsetParent check)
  const activeDpadRef = dpadRefLS.value?.offsetParent
    ? dpadRefLS.value
    : dpadRef.value;

  if (activeDpadRef) {
    const rect = activeDpadRef.getBoundingClientRect();
    dpadState.rect = rect;
    // For joystick, visual center is the rect center
    dpadState.visualX = rect.left + rect.width / 2;
    dpadState.visualY = rect.top + rect.height / 2;
  }
};

// # touch handling

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

const handleMouseInput = (e) => {
  if (e.type === "mousedown") {
    isMouseDown = true;
    cacheDpadMetrics();
    dpadState.lastInputTime = Date.now();

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

    if (useJoystick.value) {
      processJoystickCoordinates(e.clientX, e.clientY);
    } else {
      processDpadCoordinates(e.clientX, e.clientY);
    }
  } else if (e.type === "mouseup") {
    clearDpadState();
  } else if (isMouseDown) {
    dpadState.lastInputTime = Date.now();
    dpadState.lastTouchX = e.clientX;
    dpadState.lastTouchY = e.clientY;
    if (useJoystick.value) {
      processJoystickCoordinates(e.clientX, e.clientY);
    } else {
      processDpadCoordinates(e.clientX, e.clientY);
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
  handleActionTouch(e); // pass through to action touch end
};

const clearDpadState = () => {
  dpadTouchId = null;
  isMouseDown = false;
  currentDirection = null;

  // reset joystick visual
  thumbX.value = 0;
  thumbY.value = 0;
  joystickState.active = false;

  for (const k of DPAD_CODES) {
    if (activeKeys.has(k)) {
      releaseKey(k);
    }
  }
};

const isInsideDpad = (x, y) => {
  const r = dpadState.rect;
  if (!r) return false;
  const PAD = 10;
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
  thumbX.value = clampX;
  thumbY.value = clampY;
  joystickState.active = true;

  // logic: angle & deadzone
  if (dist < 10) {
    // deadzone
    if (currentDirection) {
      currentDirection = null;
      triggerKeys([]); // release all
    }
    return;
  }

  let angle = Math.atan2(dy, dx) * RAD_TO_DEG;
  if (angle < 0) angle += 360;

  // snap to cardinal 8-way
  const newDirection = getDirectionFromAngle(angle, currentDirection);

  if (newDirection !== currentDirection) {
    currentDirection = newDirection;
    haptics.impact(ImpactStyle.Light).catch(() => {});
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
    haptics.impact(ImpactStyle.Light).catch(() => {});
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
      releaseKey(k);
    }
  }
  // press new D-pad keys
  for (const k of keyCodes) {
    if (!activeKeys.has(k)) {
      pressKey(k);
    }
  }
};

const handleActionTouch = (e) => {
  const touches = e.touches ? Array.from(e.touches) : [e];

  const activeZone = actionZoneRefLS.value?.offsetParent
    ? actionZoneRefLS.value
    : actionZoneRef.value;
  if (!activeZone) return;

  // determine button refs based on orientation (offsetParent)
  const isLandscape = !!actionZoneRefLS.value?.offsetParent;
  const b1Exp = isLandscape ? btn1RefLS.value : btn1Ref.value;
  const b2Exp = isLandscape ? btn2RefLS.value : btn2Ref.value;

  const checkButton = (btnEl, code) => {
    if (!btnEl) return false;
    const rect = btnEl.getBoundingClientRect();
    const hitSlop = 10;

    return touches.some((t) => {
      return (
        t.clientX >= rect.left - hitSlop &&
        t.clientX <= rect.right + hitSlop &&
        t.clientY >= rect.top - hitSlop &&
        t.clientY <= rect.bottom + hitSlop
      );
    });
  };

  if (checkButton(b1Exp, btn1.value.code)) pressKey(btn1.value.code);
  else releaseKey(btn1.value.code);

  if (checkButton(b2Exp, btn2.value.code)) pressKey(btn2.value.code);
  else releaseKey(btn2.value.code);
};

const pressKey = (code) => {
  if (!activeKeys.has(code)) {
    activeKeys.add(code);
    haptics.impact(ImpactStyle.Light);
    inputManager.setVirtualKey(code, true);
  }
};

const releaseKey = (code) => {
  if (activeKeys.has(code)) {
    activeKeys.delete(code);
    inputManager.setVirtualKey(code, false);
  }
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
});
</script>

<style scoped>
/* force portrait layout when height > width and height > 570px */
@media (max-aspect-ratio: 3/4) and (min-height: 571px) {
  .portrait-layout {
    display: flex !important;
  }
  .landscape-layout {
    display: none !important;
  }
}

/* force landscape layout when width >= height or height <= 570px */
@media (min-aspect-ratio: 3/4), (max-height: 570px) {
  .portrait-layout {
    display: none !important;
  }
  .landscape-layout {
    display: flex !important;
  }
}

/* GPU layer promotion for buttery smooth controls */
.control-group {
  will-change: transform;
  contain: layout paint;
  transform: translateZ(0);
}
</style>
