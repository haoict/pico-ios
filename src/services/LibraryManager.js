import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const ROOT = "";
const CARTS_DIR = "Carts";
const IMAGES_DIR = "Images";
const SAVES_DIR = "Saves";
const LIBRARY_FILE = "library.json";

export class LibraryManager {
  constructor() {
    this.games = [];
    this.metadata = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      // ensure pocket8 directories exist
      const ensureDir = async (path) => {
        try {
          // check existence first
          await Filesystem.stat({
            path,
            directory: Directory.Documents,
          });
        } catch (e) {
          // # try to create if missing
          try {
            await Filesystem.mkdir({
              path,
              directory: Directory.Documents,
              recursive: true,
            });
          } catch (mkdirError) {
            // silently fail
          }
        }
      };

      await ensureDir(CARTS_DIR);
      await ensureDir(IMAGES_DIR);
      await ensureDir(SAVES_DIR);

      // load metadata
      try {
        const result = await Filesystem.readFile({
          path: LIBRARY_FILE,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        this.metadata = JSON.parse(result.data);
      } catch (e) {
        this.metadata = {};
      }

      await this.cleanupLegacy();
      await this.scan();
      this.initialized = true;
    } catch (e) {
      // silent failure
    }
  }

  async cleanupLegacy() {
    // legacy cleanup logic removed
  }

  async scan() {
    const games = [];
    const scanPath = CARTS_DIR;

    try {
      const result = await Filesystem.readdir({
        path: scanPath,
        directory: Directory.Documents,
      });

      // build set of hidden sub-carts from metadata to exclude them from the shelf
      const hiddenCarts = new Set();
      Object.values(this.metadata).forEach((meta) => {
        if (meta.subCarts && Array.isArray(meta.subCarts)) {
          meta.subCarts.forEach((sc) => hiddenCarts.add(sc));
        }
      });

      const scanPromises = result.files
        .filter(
          (file) =>
            (file.name.endsWith(".p8.png") || file.name.endsWith(".p8")) &&
            !hiddenCarts.has(file.name)
        )
        .map(async (file) => {
          const id = file.name;
          const meta = this.metadata[id] || { playCount: 0, lastPlayed: 0 };
          const baseName = file.name.replace(/\.p8(\.png)?$/, "");
          const imagePath = `${IMAGES_DIR}/${baseName}.png`;
          let coverUri = null;

          // handle image loading (web vs native)
          if (Capacitor.getPlatform() === "web") {
            try {
              const fileData = await Filesystem.readFile({
                path: imagePath,
                directory: Directory.Documents,
              });

              // data is base64 string on web
              const blob = await (
                await fetch(`data:image/png;base64,${fileData.data}`)
              ).blob();

              coverUri = URL.createObjectURL(blob);
            } catch (err) {
              // image might not exist
            }
          } else {
            // native: use direct uri
            try {
              const stat = await Filesystem.getUri({
                path: imagePath,
                directory: Directory.Documents,
              });
              coverUri = Capacitor.convertFileSrc(stat.uri);
            } catch (e) {
              // ignore
            }
          }

          let path = file.uri;
          if (path.startsWith("file://")) {
            path = path.replace("file://", "");
          }

          return {
            name: meta.displayName || this.getStemName(file.name),
            filename: file.name, // or metadata lookups
            id: id,
            path: path,
            lastPlayed: meta.lastPlayed,
            playCount: meta.playCount,
            cover: coverUri || null,
            mtime: parseInt(file.mtime) || 0,
            isFavorite: !!meta.isFavorite,
          };
        });

      const loadedGames = await Promise.all(scanPromises);
      games.push(...loadedGames);
      console.log(
        `[shelf] ${games.length} games ready (hidden: ${hiddenCarts.size}).`
      );
    } catch (e) {
      // silent catch
    }

    // sort by last played descending
    games.sort((a, b) => b.lastPlayed - a.lastPlayed);

    this.games = games;
    return games;
  }

  // helper: stem logic (tail-stripper)
  getStemName(filename) {
    let stem = filename.toLowerCase();
    // remove extensions
    stem = stem.replace(/(\.p8\.png|\.p8|\.png|\.lua|\.txt)$/i, "");

    // remove tail suffixes (anchored to end $)
    // loop until no more suffixes are removed to handle chains
    let previousStem = "";
    while (stem !== previousStem) {
      previousStem = stem;
      stem = stem.replace(
        /(_\d+|_title|_boot|_sfx|_data|_main|_cart|_font|game|title)$/i,
        ""
      );
    }

    // clean up
    return stem.replace(/_/g, " ").trim();
  }

  async importBundle(fileList) {
    return this.processImportBatch(fileList);
  }

  async processImportBatch(fileList) {
    try {
      console.log(
        `[library_manager] processing batch of ${fileList.length} files...`
      );

      // pre-process & grouping
      const groups = {};

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        // binary enforcement protocol
        // wasm engine lacks compiler, require .p8.png
        // reject text carts
        if (
          file.name.toLowerCase().endsWith(".p8") &&
          !file.name.toLowerCase().endsWith(".p8.png")
        ) {
          throw new Error(
            `Text cartridges (.p8) are not supported.\nPlease open "${file.name}" in PICO-8 and save it as a .p8.png (Image Cart) to play.`
          );
        }

        const base64 = await this.fileToBase64(file);
        const stem = this.getStemName(file.name);

        if (!groups[stem]) {
          groups[stem] = [];
        }

        groups[stem].push({
          name: file.name,
          data: base64,
          isP8: file.name.toLowerCase().endsWith(".p8"),
          isPng: file.name.toLowerCase().endsWith(".png"),
        });

        // mark group as derived if stem resulted from stripping suffixes
        const baseName = file.name
          .replace(/(\.p8\.png|\.p8|\.png|\.lua|\.txt)$/i, "")
          .toLowerCase();
        if (stem !== baseName.trim()) {
          groups[stem].isDerived = true;
        }
      }

      // cluster merge - smart prefix
      const rawKeys = Object.keys(groups);
      for (const keyA of rawKeys) {
        if (!groups[keyA]) continue; // already merged away

        for (const keyB of rawKeys) {
          if (keyA === keyB) continue;
          if (!groups[keyB]) continue;

          // check if b is a prefix of a
          // enforce min length 3
          if (
            keyA.startsWith(keyB) &&
            keyB.length >= 3 &&
            keyA.length > keyB.length &&
            groups[keyB].isDerived
          ) {
            console.log(
              `[library_manager] cluster merge: '${keyB}' -> '${keyA}'`
            );
            groups[keyA].push(...groups[keyB]);
            delete groups[keyB];
          }
        }
      }

      // shelf check - retroactive merge
      const stemNames = Object.keys(groups);

      for (const stem of stemNames) {
        // look for existing game with same stem in metadata
        const existingKeys = Object.keys(this.metadata);
        let matchKey = null;

        for (const key of existingKeys) {
          const existingStem = this.getStemName(key);
          if (existingStem === stem) {
            matchKey = key;
            break;
          }
        }

        if (matchKey) {
          console.log(
            `[library_manager] merge detected! merging '${stem}' into existing '${matchKey}'`
          );

          // load leader data
          const leaderData = await this.loadCartData(matchKey);
          if (leaderData) {
            groups[stem].push({
              name: matchKey,
              data: leaderData,
              isP8: matchKey.toLowerCase().endsWith(".p8"),
              isPng: matchKey.toLowerCase().endsWith(".png"),
            });
          }

          // load existing subcarts data
          const meta = this.metadata[matchKey];
          if (meta && meta.subCarts) {
            for (const sub of meta.subCarts) {
              const sData = await this.loadCartData(sub);
              if (sData) {
                groups[stem].push({
                  name: sub,
                  data: sData,
                  isP8: sub.toLowerCase().endsWith(".p8"),
                  isPng: sub.toLowerCase().endsWith(".png"),
                });
              }
            }
          }

          // de-dupe based on filename
          const map = new Map();
          groups[stem].forEach((f) => map.set(f.name, f));
          groups[stem] = Array.from(map.values());
        }
      }

      // process each group
      const results = [];
      console.log(
        `[library_manager] identified ${
          stemNames.length
        } bundles (after merge checks): ${stemNames.join(", ")}`
      );

      for (const [stemName, files] of Object.entries(groups)) {
        results.push(await this.createBundle(stemName, files));
      }

      return results.every((r) => r === true);
    } catch (e) {
      console.error("[library_manager] batch process failed:", e);
      return false;
    }
  }

  async createBundle(stemName, files) {
    // determine leader (shortest name heuristic)
    const candidates = files.filter((f) => f.isP8 || f.isPng);
    let leader = null;

    if (candidates.length > 0) {
      // sort by priority: 1. contains "title" (descending priority) 2. length (ascending)
      candidates.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aHasTitle = aName.includes("title");
        const bHasTitle = bName.includes("title");

        if (aHasTitle && !bHasTitle) return -1;
        if (!aHasTitle && bHasTitle) return 1;

        return aName.length - bName.length;
      });
      leader = candidates[0];

      console.log(
        `[library_manager] leader selected by heuristic: ${leader.name}`
      );
    } else {
      leader = files[0];
    }

    if (!leader) return false;

    console.log(
      `[library_manager] creating bundle "${stemName}" led by: ${leader.name}`
    );

    const subCarts = [];

    // write files to disk
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      file.name = lowerName; // update in-memory object to match disk

      // binary enforcement: .p8 files blocked at import
      // only accept valid .p8.png images here

      // write all files to carts
      await Filesystem.writeFile({
        path: `${CARTS_DIR}/${file.name}`, // use updated file.name
        data: file.data,
        directory: Directory.Documents,
      });

      if (file === leader) {
        // extract image for leader
        if (file.isPng || file.name.endsWith(".p8.png")) {
          await this.extractImage(file.name, file.data);
        }
      } else {
        // link sub-cart
        subCarts.push(file.name);
      }
    }

    // metadata & name cleaning
    if (!this.metadata[leader.name]) {
      this.metadata[leader.name] = { playCount: 0, lastPlayed: 0 };
    }

    // simplified display name: title case of stem
    let clean = stemName.replace(/_/g, " ").trim();
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    this.metadata[leader.name].displayName = clean;

    // sub-cart linking
    this.metadata[leader.name].subCarts = subCarts;

    // cleanup demoted leaders
    for (const sub of subCarts) {
      if (this.metadata[sub]) {
        console.log(`[library_manager] demoting previous leader: ${sub}`);
        delete this.metadata[sub];
      }
    }

    await this.saveMetadata();

    // handoff update
    localStorage.setItem("pico_handoff_payload", leader.data);
    localStorage.setItem("pico_handoff_name", leader.name);

    return true;
  }

  // helper: file -> base64
  fileToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // helper: extract/save image
  async extractImage(filename, base64Data) {
    const baseName = filename
      .replace(/\.p8(\.png)?$/, "")
      .replace(/\.png$/, "");
    try {
      await Filesystem.writeFile({
        path: `${IMAGES_DIR}/${baseName}.png`,
        data: base64Data,
        directory: Directory.Documents,
      });
    } catch (e) {}
  }

  async loadCartData(relativePath) {
    try {
      const res = await Filesystem.readFile({
        path: `${CARTS_DIR}/${relativePath}`,
        directory: Directory.Documents,
      });
      return res.data; // base64
    } catch (e) {
      console.warn(`[library_manager] failed to load data: ${relativePath}`);
      return null;
    }
  }

  getMetadata(cartName) {
    return this.metadata[cartName];
  }

  // deprecated/wrapper for single file
  async importFile(blob, filename) {
    // mock a file object
    const file = new File([blob], filename);
    return this.importBundle([file]);
  }

  async updateLastPlayed(cartName) {
    if (!this.metadata[cartName]) {
      this.metadata[cartName] = { playCount: 0, lastPlayed: 0 };
    }
    this.metadata[cartName].lastPlayed = Date.now();
    this.metadata[cartName].playCount =
      (this.metadata[cartName].playCount || 0) + 1;
    await this.saveMetadata();
  }

  async renameCartridge(filename, newName) {
    if (!this.metadata[filename]) {
      this.metadata[filename] = { playCount: 0, lastPlayed: 0 };
    }
    this.metadata[filename].displayName = newName;
    await this.saveMetadata();
    return true;
  }

  async toggleFavorite(filename) {
    if (!this.metadata[filename]) {
      this.metadata[filename] = { playCount: 0, lastPlayed: 0 };
    }
    this.metadata[filename].isFavorite = !this.metadata[filename].isFavorite;
    await this.saveMetadata();
    return this.metadata[filename].isFavorite;
  }

  async deleteCartridge(filename) {
    try {
      // recursive bundle deletion (clean up sub-carts)
      const meta = this.metadata[filename];
      if (meta && meta.subCarts && Array.isArray(meta.subCarts)) {
        console.log(
          `[library_manager] deleting sub-carts for ${filename}: ${meta.subCarts.join(
            ", "
          )}`
        );
        for (const sub of meta.subCarts) {
          // delete sub-cart file
          try {
            await Filesystem.deleteFile({
              path: `${CARTS_DIR}/${sub}`,
              directory: Directory.Documents,
            });
          } catch (e) {
            /* ignore missing file */
          }

          // delete sub-cart metadata
          if (this.metadata[sub]) delete this.metadata[sub];
        }
      }

      // delete main cartridge
      await Filesystem.deleteFile({
        path: `${CARTS_DIR}/${filename}`,
        directory: Directory.Documents,
      });

      // delete cover image
      const baseName = filename.replace(/\.p8(\.png)?$/, "");
      try {
        await Filesystem.deleteFile({
          path: `${IMAGES_DIR}/${baseName}.png`,
          directory: Directory.Documents,
        });
      } catch (e) {
        // image might not exist
      }

      // remove from metadata
      if (this.metadata[filename]) {
        delete this.metadata[filename];
        await this.saveMetadata();
      }

      // rescan to update list
      await this.scan();
      return true;
    } catch (e) {
      return false;
    }
  }

  async saveMetadata() {
    try {
      await Filesystem.writeFile({
        path: LIBRARY_FILE,
        data: JSON.stringify(this.metadata),
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
    } catch (e) {
      // failed to save metadata
    }
  }
  async handleDeepLink(cartId) {
    const targetFilename = `${cartId}.p8.png`;
    const checkPath = `${CARTS_DIR}/${targetFilename}`;

    // check if it exists & validate
    try {
      const stat = await Filesystem.stat({
        path: checkPath,
        directory: Directory.Documents,
      });

      // validate existing file (prevent cached garbage)
      const data = await Filesystem.readFile({
        path: checkPath,
        directory: Directory.Documents,
        // no encoding = get raw base64
      });

      if (stat.size < 100) {
        throw new Error("Local file too small, re-downloading.");
      }

      if (!data.data.startsWith("iVBORw0KGgo")) {
        throw new Error(
          "Invalid local file signature (not PNG), re-downloading."
        );
      }

      // exists and looks valid
      return { exists: true, filename: targetFilename };
    } catch (e) {
      console.warn(
        `[library_manager] local validation/check failed: ${e.message}. Deleting if exists.`
      );
      // if it exists but failed validation, delete it
      try {
        await Filesystem.deleteFile({
          path: checkPath,
          directory: Directory.Documents,
        });
      } catch (delErr) {
        /* ignore */
      }
    }

    // download
    try {
      console.log(`[library_manager] downloading deep link: ${targetFilename}`);

      const fetchBlob = async (url) => {
        let blob;
        if (Capacitor.getPlatform() === "web") {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Status " + response.status);
          blob = await response.blob();
        } else {
          const response = await CapacitorHttp.get({
            url: url,
            responseType: "blob",
          });
          if (response.status !== 200)
            throw new Error("Status " + response.status);

          const base64Data = response.data;
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: "image/png" });
        }
        return blob;
      };

      let blob;
      try {
        // direct download
        blob = await fetchBlob(
          `https://carts.lexaloffle.com/${targetFilename}`
        );
      } catch (e1) {
        console.warn(
          "[library_manager] direct download failed, trying proxy...",
          e1
        );
        // proxy download
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(
          `https://carts.lexaloffle.com/${targetFilename}`
        )}`;
        blob = await fetchBlob(proxyUrl);
      }

      // validate blob
      const headerBuffer = await blob.slice(0, 8).arrayBuffer();
      const headerView = new Uint8Array(headerBuffer);

      // PNG magic number: 137 80 78 71 13 10 26 10
      if (
        headerView[0] !== 0x89 ||
        headerView[1] !== 0x50 ||
        headerView[2] !== 0x4e ||
        headerView[3] !== 0x47
      ) {
        throw new Error("Invalid Cartridge Format: Not a PNG");
      }

      const base64 = await this.fileToBase64(blob);

      await Filesystem.writeFile({
        path: checkPath,
        data: base64,
        directory: Directory.Documents,
      });

      // also extract image for the shelf
      try {
        await this.extractImage(targetFilename, base64);
      } catch (e) {
        /* ignore image extract fail */
      }

      // refresh library so it appears in the list
      await this.scan();

      return { exists: false, downloaded: true, filename: targetFilename };
    } catch (err) {
      console.error(`[library_manager] deep link download failed:`, err);
      throw err;
    }
  }
}

export const libraryManager = new LibraryManager();
