import { Haptics, ImpactStyle } from "@capacitor/haptics";

export const haptics = {
  impact: async (style = ImpactStyle.Light) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // # fail silently on non-supported devices
    }
  },

  success: async () => {
    try {
      await Haptics.notification({ type: "SUCCESS" });
    } catch (e) {}
  },

  error: async () => {
    try {
      await Haptics.notification({ type: "ERROR" });
    } catch (e) {}
  },
};
