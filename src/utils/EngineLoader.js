export const EngineLoader = {
  inject: () => {
    // idempotency check
    if (document.getElementById("pico8-engine-script")) {
      console.log("[EngineLoader] script already injected, skipping");
      return;
    }

    console.log("[EngineLoader] injecting pico8.js...");
    // create script tag
    const script = document.createElement("script");
    script.src = "/pico8.js";
    script.async = true;
    script.id = "pico8-engine-script";
    document.body.appendChild(script);
  },
  init: async () => {
    try {
      const response = await fetch("/pico8.js", { method: "HEAD" });
      return response.ok;
    } catch (e) {
      console.warn("[EngineLoader] Engine check failed:", e);
      return false;
    }
  },
};
