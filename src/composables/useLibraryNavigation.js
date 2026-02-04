import { ref, computed, watch } from 'vue';

/**
 * Unified navigation composable for Library view
 * Manages focus state, header navigation, and input routing
 */
export function useLibraryNavigation({
  sortOptions,
  sortBy,
  sortDropdownOpen,
  searchQuery,
  games,
  displayGames,
  focusedIndex,
  cardMenuGameId,
  showRenameModal,
  deleteMode,
}) {
  // Navigation state
  const headerFocusIndex = ref(-1);
  const cardMenuBtnIndex = ref(0);
  const isTransitioning = ref(false);
  const headerEntryTime = ref(0);
  const menuCloseTimestamp = ref(0);

  // Header Navigation Graph
  // Indices: 0=search, 1=sort, 2=import, 3=bbs, 4=settings, 5=bbsexp
  const HEADER_NAV_MAP = {
    // Bottom row (search and sort)
    0: {
      up: 2,
      down: 'grid',
      left: 1,
      right: 1,
    },
    1: {
      up: 4,
      down: 'grid',
      left: 0,
      right: 0,
    },
    // Top row (import, bbs, bbsexp, settings)
    2: {
      down: 0,
      left: 4,
      right: 3,
    },
    3: {
      down: 0,
      left: 2,
      right: 5,
    },
    5: {
      down: 1,
      left: 3,
      right: 4,
    },
    4: {
      down: 1,
      left: 5,
      right: 2,
    },
  };

  /**
   * Centralized transition lock
   */
  const lockTransition = (ms = 250) => {
    isTransitioning.value = true;
    setTimeout(() => {
      isTransitioning.value = false;
    }, ms);
  };

  /**
   * Navigate within header using navigation graph
   */
  const navigateHeader = (direction) => {
    if (isTransitioning.value) return false;

    // Debounce check for entering header
    if (Date.now() - headerEntryTime.value < 250) {
      if (['nav-up', 'nav-down', 'nav-left', 'nav-right'].includes(direction)) {
        return false;
      }
    }

    const current = headerFocusIndex.value;
    if (current === -1) return false;

    const mapping = HEADER_NAV_MAP[current];
    if (!mapping) return false;

    let didTransition = false;
    const targetDir = direction.replace('nav-', '');

    if (mapping[targetDir]) {
      if (mapping[targetDir] === 'grid') {
        // Transition to grid
        focusedIndex.value = 0;
        headerFocusIndex.value = -1;
      } else {
        // Move within header
        headerFocusIndex.value = mapping[targetDir];
      }
      didTransition = true;
    }

    if (didTransition) {
      lockTransition(150);
    }

    return didTransition;
  };

  /**
   * Enter header from grid
   */
  const enterHeader = (index = 0) => {
    headerFocusIndex.value = index;
    headerEntryTime.value = Date.now();
    lockTransition(250);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Exit header and return to grid
   */
  const exitHeader = () => {
    headerFocusIndex.value = -1;
    focusedIndex.value = 0;
    lockTransition(250);
  };

  /**
   * Handle sort dropdown navigation
   */
  const handleSortNav = (action) => {
    if (isTransitioning.value) return;

    if (action === 'nav-down' || action === 'ArrowDown') {
      const idx = sortOptions.findIndex((o) => o.value === sortBy.value);
      const next = (idx + 1) % sortOptions.length;
      sortBy.value = sortOptions[next].value;
    } else if (action === 'nav-up' || action === 'ArrowUp') {
      const idx = sortOptions.findIndex((o) => o.value === sortBy.value);
      const prev = (idx - 1 + sortOptions.length) % sortOptions.length;
      sortBy.value = sortOptions[prev].value;
    } else if (action === 'confirm' || action === 'Enter') {
      sortDropdownOpen.value = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      exitHeader();
      lockTransition(350);
    } else if (['back', 'Escape', 'menu', 'wiggle'].includes(action)) {
      sortDropdownOpen.value = false;
      exitHeader();
      if (document.activeElement) document.activeElement.blur();
      lockTransition(350);
    }
  };

  /**
   * Handle card menu navigation
   */
  const navigateCardMenu = (action) => {
    if (action === 'nav-left') {
      if (cardMenuBtnIndex.value === 0) cardMenuBtnIndex.value = 1;
    } else if (action === 'nav-right') {
      if (cardMenuBtnIndex.value === 1) cardMenuBtnIndex.value = 0;
    } else if (action === 'nav-down') {
      if (cardMenuBtnIndex.value !== 2) cardMenuBtnIndex.value = 2;
    } else if (action === 'nav-up') {
      if (cardMenuBtnIndex.value === 2) cardMenuBtnIndex.value = 0;
    }
  };

  /**
   * Open card menu for a game
   */
  const openCardMenu = (game) => {
    cardMenuGameId.value = game.filename;
    cardMenuBtnIndex.value = 0;
  };

  /**
   * Close card menu
   */
  const closeCardMenu = () => {
    cardMenuGameId.value = null;
    cardMenuBtnIndex.value = 0;
    menuCloseTimestamp.value = Date.now();
  };

  /**
   * Handle keyboard navigation when input is focused
   */
  const handleInputKeyboard = (e) => {
    if (headerFocusIndex.value === -1) return false;
    if (isTransitioning.value) return false;

    const isInput = document.activeElement?.tagName === 'INPUT';
    if (!isInput) return false;

    // If sort dropdown is open, input manager handles it
    if (sortDropdownOpen.value) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return true;
    }

    // Debounce check
    if (Date.now() - headerEntryTime.value < 250) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
    }

    // Allow typing keys
    if (
      e.key !== 'Escape' &&
      e.key !== 'Enter' &&
      !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    ) {
      return false;
    }

    if (e.key === 'Escape') {
      document.activeElement.blur();
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }

    let didHandle = false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      exitHeader();
      e.target.blur();
      didHandle = true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      headerFocusIndex.value = 2; // search -> import
      e.target.blur();
      lockTransition(250);
      didHandle = true;
    } else if (e.key === 'ArrowRight') {
      if (e.target.selectionStart < e.target.value.length) return false;
      e.preventDefault();
      e.stopImmediatePropagation();
      headerFocusIndex.value = 1; // search -> sort
      e.target.blur();
      lockTransition(250);
      didHandle = true;
    } else if (e.key === 'ArrowLeft') {
      if (e.target.selectionStart > 0) return false;
      e.preventDefault();
      e.stopImmediatePropagation();
      headerFocusIndex.value = 1; // search -> sort
      e.target.blur();
      lockTransition(250);
      didHandle = true;
    }

    return didHandle;
  };

  /**
   * Handle keyboard navigation in card menu
   */
  const handleCardMenuKeyboard = (e) => {
    if (!cardMenuGameId.value || showRenameModal.value) return false;

    let handled = false;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cardMenuBtnIndex.value === 0) cardMenuBtnIndex.value = 1;
      handled = true;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cardMenuBtnIndex.value === 1) cardMenuBtnIndex.value = 0;
      handled = true;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cardMenuBtnIndex.value !== 2) cardMenuBtnIndex.value = 2;
      handled = true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cardMenuBtnIndex.value === 2) cardMenuBtnIndex.value = 0;
      handled = true;
    } else if (['Escape', 'Backspace', 'b', 'B'].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeCardMenu();
      handled = true;
    }

    return handled;
  };

  /**
   * Main gamepad input router
   */
  const routeGamepadInput = (action, callbacks) => {
    if (showRenameModal.value) return;

    const isTyping = document.activeElement?.tagName === 'INPUT';

    // Global: trap sort dropdown
    if (sortDropdownOpen.value) {
      handleSortNav(action);
      return;
    }

    // Handle typing mode
    if (isTyping) {
      if (action === 'nav-down') {
        if (headerFocusIndex.value !== -1) {
          navigateHeader(action);
        }
      } else if (action === 'wiggle' || action === 'back') {
        document.activeElement.blur();
      }
      return;
    }

    // Global shortcuts
    if (action === 'wiggle') {
      if (cardMenuGameId.value) {
        closeCardMenu();
      } else if (headerFocusIndex.value === -1) {
        const game = displayGames.value[focusedIndex.value];
        if (game) openCardMenu(game);
      }
      return;
    }

    if (action === 'back') {
      // Priority stack
      if (cardMenuGameId.value) {
        closeCardMenu();
        return;
      }
      if (headerFocusIndex.value !== -1) {
        exitHeader();
        return;
      }
      if (deleteMode.value) {
        deleteMode.value = false;
        return;
      }
      return;
    }

    // Delegate to active layer
    if (cardMenuGameId.value) {
      navigateCardMenu(action);
      if (action === 'confirm' && callbacks.onCardMenuConfirm) {
        const game = games.value.find((g) => g.filename === cardMenuGameId.value);
        if (game) {
          callbacks.onCardMenuConfirm(game, cardMenuBtnIndex.value);
        }
      }
      return;
    }

    if (headerFocusIndex.value !== -1) {
      // Header navigation
      if (['nav-up', 'nav-down', 'nav-left', 'nav-right'].includes(action)) {
        navigateHeader(action);
      } else if (action === 'confirm' || action === 'menu') {
        if (headerFocusIndex.value === 1) {
          sortDropdownOpen.value = !sortDropdownOpen.value;
        } else if (callbacks.onHeaderAction) {
          callbacks.onHeaderAction(headerFocusIndex.value);
        }
      }
      return;
    }

    // Grid layer - handled by useFocusable
    // But we need to handle empty state
    if (action === 'confirm' && callbacks.onEmptyStateConfirm) {
      if (displayGames.value.length === 0) {
        callbacks.onEmptyStateConfirm();
      }
    }
  };

  /**
   * Auto-scroll when header is focused
   */
  watch(headerFocusIndex, (newVal) => {
    if (newVal !== -1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  return {
    // State
    headerFocusIndex,
    cardMenuBtnIndex,
    isTransitioning,
    headerEntryTime,
    menuCloseTimestamp,

    // Navigation functions
    navigateHeader,
    enterHeader,
    exitHeader,
    openCardMenu,
    closeCardMenu,
    navigateCardMenu,

    // Input handlers
    handleSortNav,
    handleInputKeyboard,
    handleCardMenuKeyboard,
    routeGamepadInput,

    // Utilities
    lockTransition,
  };
}
