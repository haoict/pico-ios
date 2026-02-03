import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { libraryManager } from "../services/LibraryManager";

export const DEFAULT_BIOS_URL = "https://www.lexaloffle.com/play/pico8_0207.js";

const BIOS_PATCHES = [
  {
    name: "VFS Intercept Patch (from 2.0.6)",
    mandatory: true,
    old: `Module["readAsync"]=function readAsync(url,onload,onerror){var xhr=new XMLHttpRequest;`,
    new: `Module["readAsync"]=function readAsync(url,onload,onerror){
// PHASE 73 PATCH: Check VFS First
console.log("⚡️ [PicoBridge] Module.readAsync url: " + url);
if (url.startsWith("/bbs/")) {
  // Download from BBS server, this case is used for multicart cartridges (for example: adventcalendar2025: https://www.lexaloffle.com/bbs/cposts/ad/advent2025-41.p8.png)
  url = "https://www.lexaloffle.com" + url;
} else if (typeof FS !== "undefined") {
  try {
    var path = url.startsWith("/") ? url : "/" + url;
    var content = FS.readFile(path); // Returns Uint8Array
    if (content) {
      console.log("⚡️ [PicoBridge] Module.readAsync intercepted path from VFS: " + path);
      // Simulate async callback
      setTimeout(function () {
        onload(content.buffer);
      }, 1);
      return;
    }
  } catch (e) {}
}
var xhr=new XMLHttpRequest;`,
  },
];

export const EngineLoader = {
  inject: async () => {
    // load pico8_bios.js from BIOS/ directory
    try {
      const biosPath = libraryManager.resolvePath("BIOS/pico8_bios.js");
      const result = await Filesystem.readFile({
        path: biosPath,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });

      const existing = document.getElementById("pico8-engine-script");
      if (existing) existing.remove();

      // create blob URL from the bios content
      const blob = new Blob([result.data], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);

      const script = document.createElement("script");
      script.id = "pico8-engine-script";
      script.src = blobUrl;
      script.async = true;
      document.body.appendChild(script);
      console.log("[EngineLoader] injected BIOS/pico8_bios.js from filesystem");
    } catch (e) {
      console.error("[EngineLoader] Failed to load BIOS file:", e);
      throw e;
    }
  },
  check: async () => {
    try {
      const biosPath = libraryManager.resolvePath("BIOS/pico8_bios.js");
      await Filesystem.stat({
        path: biosPath,
        directory: Directory.Documents,
      });
      return true;
    } catch (e) {
      console.warn("[EngineLoader] Engine check failed:", e);
      return false;
    }
  },
  delete: async () => {
    try {
      const biosPath = libraryManager.resolvePath("BIOS/pico8_bios.js");
      await Filesystem.deleteFile({
        path: biosPath,
        directory: Directory.Documents,
      });
      console.log("[EngineLoader] Removed BIOS/pico8_bios.js from filesystem");
    } catch (e) {
      console.error("[EngineLoader] Failed to remove BIOS file:", e.message);
      throw e;
    }
  },
  downloadAndInstall: async (url = DEFAULT_BIOS_URL) => {
    // Download the BIOS file from the specified URL
    console.log("[EngineLoader] Downloading BIOS from:", url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to download BIOS file");
    }

    let text = await response.text();

    // Apply all patches
    for (const patch of BIOS_PATCHES) {
      const patternFound = text.includes(patch.old);

      if (patch.mandatory && !patternFound) {
        throw new Error(
          `[EngineLoader] Mandatory patch "${patch.name}" pattern not found. The BIOS file may be incompatible.`,
        );
      }

      if (patternFound) {
        text = text.replaceAll(patch.old, patch.new);
        console.log(`[EngineLoader] Applied patch: ${patch.name}`);
      } else {
        console.log(`[EngineLoader] Skipped optional patch: ${patch.name}`);
      }
    }

    // Ensure BIOS directory exists
    const biosPath = libraryManager.resolvePath("BIOS");
    try {
      await Filesystem.mkdir({
        path: biosPath,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (e) {
      // Directory might already exist
    }

    // Save the patched BIOS file
    await Filesystem.writeFile({
      path: libraryManager.resolvePath("BIOS/pico8_bios.js"),
      data: text,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    console.log("[EngineLoader] Successfully installed BIOS to BIOS/pico8_bios.js");
  },
};
