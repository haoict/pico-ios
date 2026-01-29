import { createRouter, createWebHashHistory } from "vue-router";
import Library from "../views/Library.vue";
import Player from "../views/Player.vue";
import Settings from "../views/Settings.vue";
import SavesManager from "../views/SavesManager.vue";
import BBSExplorer from "../views/BBSExplorer.vue";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "library",
      component: Library,
    },

    {
      path: "/play",
      name: "player",
      component: Player,
      props: (route) => ({ cartId: route.query.cart }),
    },
    {
      path: "/settings",
      name: "settings",
      component: Settings,
    },
    {
      path: "/settings/saves",
      name: "saves",
      component: SavesManager,
    },
    {
      path: "/bbs",
      name: "bbs",
      component: BBSExplorer,
    },
  ],
});

export default router;
