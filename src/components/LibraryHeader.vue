<template>
  <div
    class="flex flex-col gap-6 mb-8 px-2 !relative !z-[100] !pointer-events-auto"
  >
    <!-- title & actions -->
    <div class="flex justify-between items-center mb-1">
      <div class="flex flex-col">
        <h1
          class="font-pico-crisp text-white drop-shadow-md text-[clamp(1.5rem,5vw,3rem)]"
        >
          Library
        </h1>
        <span
          class="text-xs font-medium text-white/40 tracking-wider uppercase mt-1"
        >
          {{ gamesCount }} Cartridges
        </span>
      </div>

      <div class="flex gap-3">
        <!-- import button -->
        <button
          @click="$emit('import')"
          class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105 !relative !z-[9999] !pointer-events-auto"
          :class="{
            'ring-2 ring-purple-500 bg-white/20': headerFocusIndex === 2,
          }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>

        <!-- bbs button -->
        <button
          @click="$emit('open-bbs')"
          class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105"
          :class="{
            'ring-2 ring-purple-500 bg-white/20': headerFocusIndex === 3,
          }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
        </button>

        <!-- bbs explorer button -->
        <button
          @click="$emit('open-bbs-explorer')"
          class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105"
          :class="{
            'ring-2 ring-purple-500 bg-white/20': headerFocusIndex === 5,
          }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </button>

        <!-- settings button -->
        <button
          @click="$emit('open-settings')"
          class="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-all hover:scale-105"
          :class="{
            'ring-2 ring-purple-500 bg-white/20': headerFocusIndex === 4,
          }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- search & filter -->
    <div class="flex gap-3">
      <div class="relative flex-1 group">
        <div
          class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
        >
          <svg
            class="h-4 w-4 text-white/40 group-focus-within:text-purple-400 transition-colors"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          type="text"
          class="block w-full pl-10 pr-3 py-2.5 border border-white/10 rounded-xl leading-5 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 sm:text-sm transition-all"
          :class="{
            'ring-2 ring-purple-500 bg-white/20': headerFocusIndex === 0,
          }"
          placeholder="Search cartridges..."
          @keydown="$emit('keydown', $event)"
          @keydown.escape.stop.prevent="$emit('keydown', $event)"
        />
      </div>

      <div class="relative min-w-[140px] z-[200]">
        <button
          @click="$emit('update:sortDropdownOpen', !sortDropdownOpen)"
          @keydown.escape.stop.prevent="handleSortEscape"
          class="w-full h-full flex items-center justify-between appearance-none bg-white/5 border border-white/10 text-white py-2.5 pl-4 pr-3 rounded-xl focus:outline-none focus:bg-white/10 text-sm transition-all"
          :class="{
            'ring-2 ring-purple-500 bg-white/20': headerFocusIndex === 1,
            '!bg-black z-[201] ring-2 ring-purple-500': sortDropdownOpen,
          }"
        >
          <span class="truncate">{{
            sortOptions.find((o) => o.value === sortBy)?.label
          }}</span>
          <div class="pointer-events-none flex items-center text-white/40">
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        <!-- dropdown menu -->
        <transition name="fade">
          <div
            v-if="sortDropdownOpen"
            class="absolute top-full right-0 mt-2 w-full bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[9999] max-h-60 overflow-y-auto custom-scrollbar"
          >
            <div
              v-for="opt in sortOptions"
              :key="opt.value"
              class="px-4 py-3 text-sm cursor-pointer transition-colors border-b border-white/5 last:border-0"
              :class="
                sortBy === opt.value
                  ? 'bg-purple-500/20 text-purple-300 font-bold'
                  : 'text-white/60'
              "
              @click="handleSortSelect(opt.value)"
            >
              {{ opt.label }}
            </div>
          </div>
        </transition>
      </div>

      <button
        @click="$emit('update:gridSize', cycleGridSizeValue())"
        class="w-10 h-10 rounded-xl bg-white/10 border border-white/10 text-white transition-all active:scale-95 hover:bg-white/20 flex items-center justify-center"
        :title="`Grid: ${gridSize === 'S' ? '3 columns' : gridSize === 'M' ? '2 columns' : '1 column'}`"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect v-if="gridSize === 'S'" x="3" y="8" width="5" height="8" rx="1" />
          <rect
            v-if="gridSize === 'S'"
            x="9.5"
            y="8"
            width="5"
            height="8"
            rx="1"
          />
          <rect
            v-if="gridSize === 'S'"
            x="16"
            y="8"
            width="5"
            height="8"
            rx="1"
          />
          <rect v-if="gridSize === 'M'" x="3" y="3" width="8" height="18" rx="1" />
          <rect
            v-if="gridSize === 'M'"
            x="13"
            y="3"
            width="8"
            height="18"
            rx="1"
          />
          <rect v-if="gridSize === 'L'" x="3" y="3" width="18" height="18" rx="1" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  gamesCount: {
    type: Number,
    required: true,
  },
  searchQuery: {
    type: String,
    required: true,
  },
  sortBy: {
    type: String,
    required: true,
  },
  sortDropdownOpen: {
    type: Boolean,
    required: true,
  },
  headerFocusIndex: {
    type: Number,
    required: true,
  },
  gridSize: {
    type: String,
    required: true,
  },
});

const emit = defineEmits([
  'update:searchQuery',
  'update:sortBy',
  'update:sortDropdownOpen',
  'update:headerFocusIndex',
  'update:gridSize',
  'import',
  'open-bbs',
  'open-bbs-explorer',
  'open-settings',
  'keydown',
  'scroll-to-top',
]);

const sortOptions = [
  { label: 'Recently Played', value: 'lastPlayed' },
  { label: 'Name (A-Z)', value: 'name' },
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Play Count', value: 'playCount' },
];

const handleSortSelect = (value) => {
  emit('update:sortBy', value);
  emit('update:sortDropdownOpen', false);
  emit('scroll-to-top');
};

const handleSortEscape = (event) => {
  emit('update:sortDropdownOpen', false);
  emit('update:headerFocusIndex', -1);
  event.target.blur();
};

const cycleGridSizeValue = () => {
  const modes = ['S', 'M', 'L'];
  const currentIndex = modes.indexOf(props.gridSize);
  return modes[(currentIndex + 1) % modes.length];
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
