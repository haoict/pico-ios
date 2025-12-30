import { createRouter, createWebHashHistory } from "vue-router";
import Library from "../views/Library.vue";
import Player from "../views/Player.vue";

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
  ],
});

export default router;
