import { Haptics, ImpactStyle } from "@capacitor/haptics";

const isEnabled = () => {
  return localStorage.getItem("pico_haptics_enabled") !== "false";
};

export const haptics = {
  impact: async (style = ImpactStyle.Light) => {
    if (!isEnabled()) return;
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // # fail silently on non-supported devices
    }
  },

  success: async () => {
    if (!isEnabled()) return;
    try {
      await Haptics.notification({ type: "SUCCESS" });
    } catch (e) {}
  },

  error: async () => {
    if (!isEnabled()) return;
    try {
      await Haptics.notification({ type: "ERROR" });
    } catch (e) {}
  },
};
