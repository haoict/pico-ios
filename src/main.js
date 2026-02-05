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

// Register service worker for PWA on web platform
if ('serviceWorker' in navigator && window.Capacitor && window.Capacitor.getPlatform() === 'web') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(registration => {
        console.log('[PWA] Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.log('[PWA] Service Worker registration failed:', error);
      });
  });
}
