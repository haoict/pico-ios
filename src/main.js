import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount("#app");

// force router push if boot flag is present
if (window.location.search.includes("boot")) {
  console.log("[main.js]: boot flag detected. forcing navigation to /play...");
  router.push({
    name: "player",
    query: Object.fromEntries(new URLSearchParams(window.location.search)),
  });
}
