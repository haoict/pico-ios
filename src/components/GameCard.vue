<template>
  <div @click="$emit('click', game)" @touchstart="$emit('long-press-start', game)"
    @touchend="$emit('long-press-cancel')" @touchmove="$emit('long-press-cancel')"
    @mousedown="(e) => $emit('mousedown', game, e)" @mouseup="$emit('long-press-cancel')"
    @mouseleave="$emit('long-press-cancel')" @contextmenu.prevent
    class="group relative aspect-[4/5] rounded-2xl cursor-pointer transition-all duration-500" :class="[
      deleteMode
        ? 'animate-wiggle'
        : isFavorite
          ? 'hover:shadow-2xl hover:shadow-pink-500/20'
          : 'hover:shadow-2xl hover:shadow-purple-500/20',
      isFocused
        ? isFavorite
          ? 'ring-4 ring-pink-500 shadow-2xl z-20'
          : 'ring-4 ring-purple-500 shadow-2xl z-20'
        : '',
    ]">
    <!-- heart icon (always visible for favorites or if card menu open or delete mode) -->
    <div class="absolute -top-2 -right-2 z-20 transition-transform duration-300" :class="{
      'scale-110':
        cardMenuOpen && cardMenuBtnIndex === 0,
      'scale-125 ring-2 ring-white rounded-full':
        cardMenuOpen && cardMenuBtnIndex === 0,
    }" v-if="isFavorite || deleteMode || cardMenuOpen">
      <button @click.stop="$emit('favorite', game)" class="rounded-full p-1.5 shadow-lg transition-colors" :class="isFavorite
          ? 'bg-pink-500 text-white'
          : cardMenuOpen && cardMenuBtnIndex === 0
            ? 'ring-2 ring-white !bg-pink-500 !text-white'
            : 'bg-gray-500/80 text-white/50 hover:text-white transition-all transform hover:scale-110'
        ">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd"
            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
            clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <!-- edit controls overlay -->
    <template v-if="deleteMode || cardMenuOpen">
      <!-- rename -->
      <div class="absolute -top-2 -left-2 z-20" :class="{
        'scale-125': cardMenuOpen && cardMenuBtnIndex === 1,
      }">
        <button @click.stop="$emit('rename', game)"
          class="bg-blue-500 text-white rounded-full p-1 shadow-lg hover:bg-blue-600 transition-colors transform hover:scale-110"
          :class="{
            'ring-2 ring-white': cardMenuOpen && cardMenuBtnIndex === 1,
          }">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      <!-- delete -->
      <div class="absolute -bottom-2 -right-2 z-20" :class="{
        'scale-125': cardMenuOpen && cardMenuBtnIndex === 2,
      }">
        <button @click.stop="$emit('delete', game)"
          class="bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors transform hover:scale-110"
          :class="{
            'ring-2 ring-white': cardMenuOpen && cardMenuBtnIndex === 2,
          }">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </template>

    <!-- card content -->
    <div
      class="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg z-0">
      <img v-if="game.cover" :src="game.cover" :alt="game.name"
        class="w-full h-full object-cover opacity-90 transition-transform duration-500"
        :class="isFavorite ? 'pixelated' : ''" />
      <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
        <!-- placeholder svg -->
        <svg class="w-12 h-12 opacity-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <!-- title band -->
      <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-6">
        <h3
          class="text-white font-medium text-xs truncate drop-shadow-md transform transition-transform translate-y-1 group-hover:translate-y-0">
          {{ formatName(game.name) }}
        </h3>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  game: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  isFocused: {
    type: Boolean,
    default: false,
  },
  deleteMode: {
    type: Boolean,
    default: false,
  },
  cardMenuOpen: {
    type: Boolean,
    default: false,
  },
  cardMenuBtnIndex: {
    type: Number,
    default: 0,
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
});

defineEmits([
  'click',
  'long-press-start',
  'long-press-cancel',
  'favorite',
  'rename',
  'delete',
  'mousedown',
]);

const formatName = (filename) => {
  return filename.replace(/\.p8(\.png)?$/, '');
};
</script>

<style scoped>
/* ios jiggle animation */
@keyframes wiggle {
  0% {
    transform: rotate(0deg);
  }

  25% {
    transform: rotate(-0.5deg);
  }

  75% {
    transform: rotate(0.5deg);
  }

  100% {
    transform: rotate(0deg);
  }
}

.animate-wiggle {
  animation: wiggle 0.3s linear infinite;
}
</style>
