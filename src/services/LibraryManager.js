import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { ScopedStorage } from "@daniele-rolli/capacitor-scoped-storage";

const ROOT = "";
const CARTS_DIR = "Carts";
const CACHE_DIR = "Cache";
const SAVES_DIR = "Saves";
const LIBRARY_FILE = "library.json";
const INDEX_FILE = "library_index.json";

// skip during recursive scan
const SKIP_FOLDERS = new Set([
  "Cache",
  "Saves",
  ".Trash",
  ".DS_Store",
  "__MACOSX",
]);

// internal appdata path for android
const ANDROID_APPDATA = "Pocket8";

const getAppDataDir = () => {
  return Capacitor.getPlatform() === "android"
    ? Directory.Data
    : Directory.Documents;
};

export class LibraryManager {
  constructor() {
    this.games = [];
    this.metadata = {};
    this.initialized = false;
    this.rootDir = "";
    this.isScoped = false; // true if using scoped storage
    this.scopedFolder = null;
  }

  async init() {
    if (this.initialized) return;

    try {
      // Load saved root directory (Cart Source)
      const savedRoot = localStorage.getItem("pico_root_dir");

      // Check if it's a JSON folder object ASF
      this.scopedFolder = null;
      this.isScoped = false;

      if (savedRoot && savedRoot.startsWith("{")) {
        try {
          this.scopedFolder = JSON.parse(savedRoot);
          this.rootDir = this.scopedFolder.id; // content:// URI
          this.isScoped = true;
          console.log(
            "[LibraryManager] Loaded scoped folder:",
            this.scopedFolder
          );
        } catch (e) {
          console.error("[LibraryManager] Failed to parse folder JSON:", e);
        }
      } else {
        this.rootDir = savedRoot;
      }

      const isAndroid = Capacitor.getPlatform() === "android";

      if (!this.rootDir) {
        if (isAndroid) {
          this.rootDir = null; // android requires user to pick a folder
        } else {
          this.rootDir = ""; // iOS: Documents root (flat sandbox)
        }
      }

      // ==============================
      // -------DIRECTORY SETUP-------
      // ==============================
      // android: appdata (cache, saves, library.json) lives in documents/pocket8/
      // ios: everything lives together in documents/ (rootdir is "" or subfolder)

      const ensureInternalDir = async (subPath) => {
        // Determine the actual path based on platform
        let targetPath;
        if (isAndroid) {
          // android: always use internal pocket8 folder for appdata
          targetPath = `${ANDROID_APPDATA}/${subPath}`;
        } else {
          // ios: use rootdir prefix if set
          targetPath = this.rootDir ? `${this.rootDir}/${subPath}` : subPath;
        }

        try {
          await Filesystem.stat({
            path: targetPath,
            directory: getAppDataDir(),
          });
        } catch (e) {
          try {
            await Filesystem.mkdir({
              path: targetPath,
              directory: getAppDataDir(),
              recursive: true,
            });
          } catch (err) {
            /* silent */
          }
        }
      };

      // ensure appdata dirs
      await ensureInternalDir(CACHE_DIR);
      await ensureInternalDir(SAVES_DIR);

      // ensure carts dir
      await ensureInternalDir(CARTS_DIR);

      // load metadata
      try {
        let libPath = this.isScoped
          ? `Pocket8/${LIBRARY_FILE}`
          : this.resolvePath(LIBRARY_FILE);

        const result = await Filesystem.readFile({
          path: libPath,
          directory: getAppDataDir(),
          encoding: Encoding.UTF8,
        });
        this.metadata = JSON.parse(result.data);
      } catch (e) {
        this.metadata = {};
      }

      await this.cleanupLegacy();

      // fast boot: try persistent index first
      let loadedFromIndex = false;

      // try persistent
      const indexedGames = await this._loadIndex();
      if (indexedGames && indexedGames.length > 0) {
        this.games = indexedGames;
        // clear invalid blobs
        this.games.forEach((g) => {
          if (g.cover && g.cover.startsWith("blob:")) g.cover = null;
        });
        loadedFromIndex = true;
        console.log(
          `[LibraryManager] Fast boot: ${this.games.length} games from index.`
        );
      }

      // fallback: localStorage
      if (!loadedFromIndex) {
        const cached = localStorage.getItem("pico_cached_games");
        if (cached) {
          try {
            this.games = JSON.parse(cached);
            this.games.forEach((g) => {
              if (g.cover && g.cover.startsWith("blob:")) g.cover = null;
            });
            console.log(
              `[LibraryManager] Loaded ${this.games.length} games from session cache.`
            );
          } catch (e) {
            console.warn("Invalid cache", e);
          }
        }
      }

      // last resort: full scan
      if (this.games.length === 0) {
        console.log(
          "[LibraryManager] No cache or index, performing initial scan..."
        );
        await this.scan();
      } else {
        console.log("[LibraryManager] Skipping initial scan (cache/index hit)");
      }

      this.initialized = true;
    } catch (e) {
      console.error("Library init failed", e);
    }
  }

  resolvePath(path) {
    const isAndroid = Capacitor.getPlatform() === "android";

    // app data - saves always internal
    if (
      path === LIBRARY_FILE ||
      path.startsWith(CACHE_DIR) ||
      path.startsWith(SAVES_DIR) ||
      path.startsWith(CARTS_DIR)
    ) {
      if (path.startsWith(CARTS_DIR) && this.isScoped) {
        if (isAndroid) return `${ANDROID_APPDATA}/${path}`;
      }

      if (
        path === LIBRARY_FILE ||
        path.startsWith(CACHE_DIR) ||
        path.startsWith(SAVES_DIR)
      ) {
        if (isAndroid) {
          return `${ANDROID_APPDATA}/${path}`;
        }
        // ios: use rootDir prefix
        return this.rootDir ? `${this.rootDir}/${path}` : path;
      }
    }

    // carts - external on android (scoped uri), internal on ios
    if (this.isScoped) {
      return this.rootDir;
    }

    // ios / legacy: standard path res
    if (this.rootDir === null) return null;
    if (!path) return this.rootDir || "";
    return this.rootDir ? `${this.rootDir}/${path}` : path;
  }

  async setRootDirectory(newPath) {
    this.rootDir = newPath;
    localStorage.setItem("pico_root_dir", this.rootDir);

    // clear cache when changing root
    localStorage.removeItem("pico_cached_games");
    // clear mem
    this.games = [];

    // re-init / re-scan
    this.initialized = false;
    await this.init();
    return true;
  }

  async cleanupLegacy() {
    // legacy cleanup logic removed
  }

  // updates state only on success
  async scan() {
    const isWeb = Capacitor.getPlatform() === "web";
    console.log("[LibraryManager] Starting full recursive scan...");

    // build hidden carts (multicart sub-files)
    const hiddenCarts = new Set();
    Object.values(this.metadata).forEach((meta) => {
      if (meta.subCarts && Array.isArray(meta.subCarts))
        meta.subCarts.forEach((sc) => hiddenCarts.add(sc));
    });

    let newGames = [];

    // perform recursive scan based on platform
    if (this.isScoped && this.scopedFolder) {
      console.log(
        `[LibraryManager] Scoped recursive scan: ${this.scopedFolder.name}`
      );
      newGames = await this._scanScopedRecursive(
        this.scopedFolder,
        this.scopedFolder
      );
    } else {
      console.log("[LibraryManager] Legacy recursive scan...");
      const scanPath = this.resolvePath(CARTS_DIR);
      newGames = await this._scanLegacyRecursive(scanPath, CARTS_DIR);
    }

    // filter hidden carts
    newGames = newGames.filter((g) => !hiddenCarts.has(g.filename));

    // merge with existing metadata
    newGames = newGames.map((game) => {
      const meta = this.metadata[game.filename] || {};
      return {
        ...game,
        name: meta.displayName || game.name,
        lastPlayed: meta.lastPlayed || 0,
        playCount: meta.playCount || 0,
        isFavorite: !!meta.isFavorite,
      };
    });

    // sort by last played
    newGames.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

    console.log(
      `[LibraryManager] Scan complete: ${newGames.length} games found.`
    );

    // commit to state
    this.games = newGames;

    // save to persistent index and localStorage cache
    await this._saveIndex(newGames);
    localStorage.setItem("pico_cached_games", JSON.stringify(this.games));

    return this.games;
  }

  async _loadIndex() {
    try {
      const indexPath = this.resolvePath(INDEX_FILE);
      const result = await Filesystem.readFile({
        path: indexPath,
        directory: getAppDataDir(),
        encoding: Encoding.UTF8,
      });
      const games = JSON.parse(result.data);
      console.log(`[LibraryManager] Loaded ${games.length} games from index.`);
      return games;
    } catch (e) {
      console.log("[LibraryManager] No index found, will scan.");
      return null;
    }
  }

  async _saveIndex(games) {
    try {
      const indexPath = this.resolvePath(INDEX_FILE);
      // strip non serializable fields
      const serializable = games.map((g) => ({
        id: g.id,
        filename: g.filename,
        name: g.name,
        path: g.path,
        folder: g.folder || "",
        folderPath: g.folderPath || "",
        mtime: g.mtime || 0,
        lastPlayed: g.lastPlayed || 0,
        playCount: g.playCount || 0,
        isFavorite: g.isFavorite || false,
        fileUri: g.fileUri || null,
      }));
      await Filesystem.writeFile({
        path: indexPath,
        data: JSON.stringify(serializable),
        directory: getAppDataDir(),
        encoding: Encoding.UTF8,
      });
      console.log(`[LibraryManager] Saved index with ${games.length} games.`);
    } catch (e) {
      console.warn("[LibraryManager] Failed to save index:", e);
    }
  }

  async _scanLegacyRecursive(basePath, relativePath, accumulated = []) {
    try {
      const result = await Filesystem.readdir({
        path: basePath,
        directory: getAppDataDir(),
      });

      for (const file of result.files) {
        // skip hidden folders
        if (file.name.startsWith(".") || SKIP_FOLDERS.has(file.name)) continue;

        if (file.type === "directory") {
          // recurse into subdir
          const subPath = `${basePath}/${file.name}`;
          const subRelative = `${relativePath}/${file.name}`;
          await this._scanLegacyRecursive(subPath, subRelative, accumulated);
        } else if (file.name.endsWith(".p8.png") || file.name.endsWith(".p8")) {
          // found a cart
          let filePath = file.uri;
          if (filePath && filePath.startsWith("file://")) {
            filePath = filePath.replace("file://", "");
          }

          accumulated.push({
            id: file.uri || `${relativePath}/${file.name}`, // Unique ID
            filename: file.name,
            name: this.getStemName(file.name),
            path: filePath || file.name,
            folder: relativePath.split("/").pop() || "",
            folderPath: relativePath,
            mtime: parseInt(file.mtime) || 0,
            cover: null,
            fileUri: file.uri,
          });
        }
      }
    } catch (e) {
      console.warn(
        `[LibraryManager] Legacy scan error at ${basePath}:`,
        e.message
      );
    }
    return accumulated;
  }

  async _scanScopedRecursive(folderObj, rootFolder, accumulated = []) {
    if (!folderObj) return accumulated;

    try {
      const result = await ScopedStorage.readdir({ folder: folderObj });
      if (!result || !result.entries) return accumulated;

      for (const entry of result.entries) {
        // skip hidden folders
        if (entry.name.startsWith(".") || SKIP_FOLDERS.has(entry.name))
          continue;

        if (entry.isDir) {
          // recurse into subdir
          await this._scanScopedRecursive(entry, rootFolder, accumulated);
        } else if (
          entry.name.endsWith(".p8.png") ||
          entry.name.endsWith(".p8")
        ) {
          // found a cart
          accumulated.push({
            id: entry.uri || entry.name, // unique id
            filename: entry.name,
            name: this.getStemName(entry.name),
            path: entry.uri || entry.name,
            folder: folderObj.name || "",
            folderPath: folderObj.id || "",
            mtime: entry.mtime || 0,
            cover: null,
            scopeParent: folderObj, // CRITICAL: Store parent folder for reading
          });
        }
      }
    } catch (e) {
      console.warn(`[LibraryManager] Scoped scan error:`, e.message);
    }
    return accumulated;
  }

  async loadCovers(games) {
    const isWeb = Capacitor.getPlatform() === "web";
    const source = this.isScoped && this.scopedFolder ? "scoped" : "legacy";
    const CHUNK = 5;

    console.log(
      `[LibraryManager] Starting lazy load for ${games.length} items. Source: ${source}`
    );

    for (let i = 0; i < games.length; i += CHUNK) {
      const batch = games.slice(i, i + CHUNK);
      await Promise.all(
        batch.map(async (game) => {
          if (game.cover) return;
          try {
            let coverUri = null;
            if (source === "scoped") {
              const cachePath = `${CACHE_DIR}/${game.filename}`;
              const loadCache = async () => {
                try {
                  const r = await Filesystem.readFile({
                    path: this.resolvePath(cachePath),
                    directory: getAppDataDir(),
                  });
                  return `data:image/png;base64,${r.data}`;
                } catch (e) {
                  return null;
                }
              };
              coverUri = await loadCache();
              if (!coverUri) {
                // use scopeParent for nested folders, fallback to root
                const folderToUse = game.scopeParent || this.scopedFolder;
                if (folderToUse) {
                  try {
                    const { data } = await ScopedStorage.readFile({
                      folder: folderToUse,
                      path: game.filename,
                      encoding: "base64",
                    });
                    await Filesystem.writeFile({
                      path: this.resolvePath(cachePath),
                      data: data,
                      directory: getAppDataDir(),
                      recursive: true,
                    });
                    coverUri = `data:image/png;base64,${data}`;
                  } catch (e) {}
                }
              }
            } else {
              if (isWeb) {
                try {
                  const scanPath = this.resolvePath(CARTS_DIR);
                  const r = await Filesystem.readFile({
                    path: `${scanPath}/${game.filename}`,
                    directory: getAppDataDir(),
                  });
                  const blob = await (
                    await fetch(`data:image/png;base64,${r.data}`)
                  ).blob();
                  coverUri = URL.createObjectURL(blob);
                } catch (e) {}
              } else if (game.fileUri) {
                coverUri = Capacitor.convertFileSrc(game.fileUri);
              }
            }
            if (coverUri) game.cover = coverUri;
          } catch (e) {}
        })
      );
      await new Promise((r) => setTimeout(r, 20)); // yield
    }
    localStorage.setItem("pico_cached_games", JSON.stringify(this.games));
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
        path: this.resolvePath(`${CARTS_DIR}/${file.name}`), // use updated file.name
        data: file.data,
        directory: getAppDataDir(),
      });

      if (file === leader) {
        // Leader: No extra image extraction needed.
        // The .p8.png IS the image.
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

  async loadCartData(relativePath) {
    if (this.isScoped && this.scopedFolder) {
      // scoped storage: read from external uri
      // look up game to get its scopeParent
      const game = this.games.find((g) => g.filename === relativePath);
      const folderToUse =
        game && game.scopeParent ? game.scopeParent : this.scopedFolder;

      try {
        const { data } = await ScopedStorage.readFile({
          folder: folderToUse,
          path: relativePath,
          encoding: "base64",
        });
        return data;
      } catch (e) {
        console.warn(
          `[library_manager] failed to load scoped cart: ${relativePath}`,
          e
        );
        return null;
      }
    } else {
      // legacy / ios / web
      try {
        const isAndroid = Capacitor.getPlatform() === "android";
        const res = await Filesystem.readFile({
          path: this.resolvePath(`${CARTS_DIR}/${relativePath}`),
          directory: isAndroid ? Directory.Data : Directory.Documents,
        });
        return res.data; // base64
      } catch (e) {
        console.warn(`[library_manager] failed to load data: ${relativePath}`);
        return null;
      }
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
              path: this.resolvePath(`${CARTS_DIR}/${sub}`),
              directory: getAppDataDir(),
            });
          } catch (e) {
            /* ignore missing file */
          }

          // delete sub-cart metadata
          if (this.metadata[sub]) delete this.metadata[sub];
        }
      }

      // delete main cartridge
      let deleteSuccess = false;
      if (this.isScoped && this.scopedFolder) {
        // scoped storage (android)
        try {
          // attempt using the plugin's delete method
          await ScopedStorage.deleteFile({
            folder: this.scopedFolder,
            filename: filename,
          });
          deleteSuccess = true;
        } catch (e) {
          console.warn(
            `[library_manager] scoped delete failed for ${filename}`,
            e
          );
        }
      }

      if (!deleteSuccess) {
        // legacy / internal / ios
        await Filesystem.deleteFile({
          path: this.resolvePath(`${CARTS_DIR}/${filename}`),
          directory: getAppDataDir(),
        });
      }

      // delete cached file (android)
      try {
        await Filesystem.deleteFile({
          path: this.resolvePath(`${CACHE_DIR}/${filename}`),
          directory: getAppDataDir(),
        });
      } catch (e) {
        // cache might not exist
      }

      // remove from metadata
      if (this.metadata[filename]) {
        delete this.metadata[filename];
        await this.saveMetadata();
      }

      // update internal state w/o rescan
      this.games = this.games.filter((g) => g.filename !== filename);
      localStorage.setItem("pico_cached_games", JSON.stringify(this.games));

      console.log(`[library_manager] removed ${filename} from internal state`);
      return true;
    } catch (e) {
      return false;
    }
  }

  async saveMetadata() {
    try {
      await Filesystem.writeFile({
        path: this.resolvePath(LIBRARY_FILE),
        data: JSON.stringify(this.metadata),
        directory: getAppDataDir(),
        encoding: Encoding.UTF8,
      });
    } catch (e) {
      // failed to save metadata
    }
  }
  async handleDeepLink(cartId) {
    const targetFilename = `${cartId}.p8.png`;
    const checkPath = this.resolvePath(`${CARTS_DIR}/${targetFilename}`);

    // check if it exists & validate
    try {
      const stat = await Filesystem.stat({
        path: checkPath,
        directory: getAppDataDir(),
      });

      // validate existing file (prevent cached garbage)
      const data = await Filesystem.readFile({
        path: checkPath,
        directory: getAppDataDir(),
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
          directory: getAppDataDir(),
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
        directory: getAppDataDir(),
      });

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
