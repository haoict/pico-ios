import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { ScopedStorage } from "@daniele-rolli/capacitor-scoped-storage";

const ROOT = "";
const CARTS_DIR = "Carts";
const CACHE_DIR = Capacitor.getPlatform() === "android" ? "Cache" : "Images";
const SAVES_DIR = "Saves";
const LIBRARY_FILE = "library.json";
const INDEX_FILE = "library_index.json";

// skip during recursive scan
const SKIP_FOLDERS = new Set([
  "Cache",
  "Images",
  "Saves",
  ".Trash",
  ".DS_Store",
  "__MACOSX",
]);

// internal appdata path for android
const ANDROID_APPDATA = "Pocket8";
const SYNC_SOURCES_KEY = "pico_sync_sources";

const getAppDataDir = () => {
  return Directory.Documents;
};

export class LibraryManager {
  constructor() {
    this.games = [];
    this.metadata = {};
    this.initialized = false;
    this.rootDir = ""; // always "" for internal logic
    this.syncSources = []; // external SAF folders to sync from
  }

  async init() {
    if (this.initialized) return;

    try {
      // load sync sources (SAF folders)
      try {
        const sources = localStorage.getItem(SYNC_SOURCES_KEY);
        this.syncSources = sources ? JSON.parse(sources) : [];
      } catch (e) {
        this.syncSources = [];
      }

      // ================
      // DIRECTORY SETUP
      // ================

      const ensureInternalDir = async (subPath) => {
        // determine the actual path based on platform
        let targetPath = subPath;
        if (Capacitor.getPlatform() === "android") {
          targetPath = `${ANDROID_APPDATA}/${subPath}`;
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
      // iOS: No image/cache folder needed
      if (Capacitor.getPlatform() === "android") {
        await ensureInternalDir(CACHE_DIR);
      }

      await ensureInternalDir(SAVES_DIR);
      await ensureInternalDir(CARTS_DIR);

      // load metadata
      try {
        let libPath = this.resolvePath(LIBRARY_FILE);

        const result = await Filesystem.readFile({
          path: libPath,
          directory: getAppDataDir(),
          encoding: Encoding.UTF8,
        });
        this.metadata = JSON.parse(result.data);
      } catch (e) {
        this.metadata = {};
      }

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
          `[LibraryManager] Fast boot: ${this.games.length} games from index.`,
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
              `[LibraryManager] Loaded ${this.games.length} games from session cache.`,
            );
          } catch (e) {
            console.warn("Invalid cache", e);
          }
        }
      }

      // last resort: full scan
      if (this.games.length === 0) {
        console.log(
          "[LibraryManager] No cache or index, performing initial scan...",
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
    if (isAndroid) {
      return `${ANDROID_APPDATA}/${path}`;
    }
    return path;
  }

  // add a new external sync source (SAF folder)
  async addSyncSource(folderObj, onProgress) {
    // check for duplicates
    const existingIndex = this.syncSources.findIndex(
      (s) => s.id === folderObj.id || s.uri === folderObj.uri,
    );

    if (existingIndex >= 0) {
      console.log(
        `[LibraryManager] Source already exists, refreshing: ${folderObj.name}`,
      );
      // update ref
      this.syncSources[existingIndex] = folderObj;
    } else {
      this.syncSources.push(folderObj);
    }

    localStorage.setItem(SYNC_SOURCES_KEY, JSON.stringify(this.syncSources));

    // trigger sync immediately
    await this.syncFromExternal(onProgress);
    return true;
  }

  // remove a sync source
  async removeSyncSource(index) {
    if (index >= 0 && index < this.syncSources.length) {
      this.syncSources.splice(index, 1);
      localStorage.setItem(SYNC_SOURCES_KEY, JSON.stringify(this.syncSources));
      return true;
    }
    return false;
  }

  // one-way sync: external SAF -> internal index
  async syncFromExternal(onProgress) {
    console.log("[LibraryManager] Starting external indexing...");
    let newFilesCount = 0;

    for (const source of this.syncSources) {
      try {
        console.log(`[LibraryManager] Indexing source: ${source.name}`);
        // list files in SAF folder
        const { entries } = await ScopedStorage.readdir({ folder: source });

        // filter for carts (excluding hidden)
        const carts = entries.filter(
          (e) =>
            !e.isDir &&
            !e.name.startsWith(".") &&
            (e.name.endsWith(".p8.png") || e.name.endsWith(".p8")),
        );

        console.log(
          `[LibraryManager] Found ${carts.length} carts in ${source.name}`,
        );

        // index them (no copying)
        for (let i = 0; i < carts.length; i++) {
          const cart = carts[i];

          // check if already in library
          const existingId = this.games.findIndex(
            (g) => g.filename === cart.name,
          );

          const entry = {
            id: cart.uri || cart.name,
            filename: cart.name,
            name: this.getStemName(cart.name),
            path: cart.name, // display path
            folder: source.name,
            folderPath: source.id,
            mtime: cart.mtime || 0,
            cover: null,

            // hybrid fields
            sourceType: "external",
            sourceId: source.id,
            relativePath: cart.name,
            lastPlayed: 0,
            playCount: 0,
            isFavorite: false,
          };

          if (existingId > -1) {
            // update existing external entry (preserve metadata)
            const existing = this.games[existingId];
            if (existing.sourceType === "external") {
              this.games[existingId] = {
                ...entry,
                ...existing,
                mtime: entry.mtime,
              };
            }
            // if it was internal, keep it
          } else {
            this.games.push(entry);
            newFilesCount++;
          }

          if (onProgress && i % 10 === 0) {
            onProgress(source.name, i + 1, carts.length);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      } catch (e) {
        console.error(
          `[LibraryManager] Sync failed for source ${source.name}:`,
          e,
        );
      }
    }

    // sort merged list
    this.games.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

    // save index
    await this._saveIndex(this.games);
    localStorage.setItem("pico_cached_games", JSON.stringify(this.games));

    console.log(
      `[LibraryManager] Index update complete. ${newFilesCount} new external refs.`,
    );
    return newFilesCount;
  }

  // updates state only on success
  async scan() {
    console.log("[LibraryManager] Starting internal authority scan...");

    // build hidden carts (multicart sub-files)
    const hiddenCarts = new Set();
    Object.values(this.metadata).forEach((meta) => {
      if (meta.subCarts && Array.isArray(meta.subCarts))
        meta.subCarts.forEach((sc) => hiddenCarts.add(sc));
    });

    let internalGames = [];

    // scan internal storage
    const scanPath = this.resolvePath(CARTS_DIR);
    internalGames = await this._scanLegacyRecursive(scanPath, CARTS_DIR);

    // filter hidden carts
    internalGames = internalGames.filter((g) => !hiddenCarts.has(g.filename));

    // merge metadata
    // preserve existing game data if file mtime matches
    const previousGamesMap = new Map();
    this.games.forEach((g) => previousGamesMap.set(g.filename, g));

    internalGames = internalGames.map((game) => {
      const meta = this.metadata[game.filename] || {};
      const prev = previousGamesMap.get(game.filename);

      let preservedCover = null;
      if (prev && prev.sourceType === "internal" && prev.mtime === game.mtime) {
        preservedCover = prev.cover;
      }

      return {
        ...game,
        name: meta.displayName || game.name,
        lastPlayed: meta.lastPlayed || 0,
        playCount: meta.playCount || 0,
        isFavorite: !!meta.isFavorite,
        sourceType: "internal",
        cover: preservedCover,
      };
    });

    const externalGames = this.games.filter((g) => g.sourceType === "external");

    // dedupe: if internal has same filename, it wins
    const internalSet = new Set(internalGames.map((g) => g.filename));
    const uniqueExternal = externalGames.filter(
      (g) => !internalSet.has(g.filename),
    );

    const merged = [...internalGames, ...uniqueExternal];

    // sort by last played
    merged.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

    console.log(
      `[LibraryManager] Scan complete: ${internalGames.length} internal, ${uniqueExternal.length} external. Total: ${merged.length}`,
    );

    // commit to state
    this.games = merged;

    // save to persistent index and localStorage cache
    await this._saveIndex(merged);
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
        // hybrid fields
        sourceType: g.sourceType || "internal",
        sourceId: g.sourceId || null,
        relativePath: g.relativePath || null,
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
        e.message,
      );
    }
    return accumulated;
  }

  // DEPRECATED: Scoped scan removed in favor of syncFromExternal
  // async _scanScopedRecursive(folderObj, rootFolder, accumulated = []) { ... }

  async loadCovers(games) {
    const isWeb = Capacitor.getPlatform() === "web";
    const CHUNK = 5;

    console.log(
      `[LibraryManager] Starting lazy load for ${games.length} items (File Cache)`,
    );

    for (let i = 0; i < games.length; i += CHUNK) {
      const batch = games.slice(i, i + CHUNK);
      await Promise.all(
        batch.map(async (game) => {
          if (game.cover) return; // already has a URI
          if (game.sourceType === "internal") {
            try {
              // confirm existence primarily
              const cartPath = this.resolvePath(
                `${CARTS_DIR}/${game.filename}`,
              );
              await Filesystem.stat({
                path: cartPath,
                directory: getAppDataDir(),
              });
              const stat = await Filesystem.getUri({
                path: cartPath,
                directory: getAppDataDir(),
              });
              game.cover = Capacitor.convertFileSrc(stat.uri);
            } catch (e) {}
            return;
          }

          try {
            // ios: cart itself is the image
            const isIOS = Capacitor.getPlatform() === "ios";
            if (isIOS) {
              // resolve direct path to cart file
              const cartPath = this.resolvePath(
                `${CARTS_DIR}/${game.filename}`,
              );

              // verify existence + get uri
              try {
                await Filesystem.stat({
                  path: cartPath,
                  directory: getAppDataDir(),
                });
                const stat = await Filesystem.getUri({
                  path: cartPath,
                  directory: getAppDataDir(),
                });

                game.cover = Capacitor.convertFileSrc(stat.uri);
              } catch (e) {}
              return;
            }

            // android logic
            let cacheName;
            if (CACHE_DIR === "Images") {
              const baseName = this.getStemName(game.filename);
              cacheName = `${baseName}.png`;
            } else {
              // cache strategy
              cacheName = `${game.filename}.png`;
            }

            const cachePath = this.resolvePath(`${CACHE_DIR}/${cacheName}`);
            let cacheUri = null;
            let needsWrite = false;
            let base64Data = null;

            // check cache hit
            try {
              await Filesystem.stat({
                path: cachePath,
                directory: getAppDataDir(),
              });
              const uriResult = await Filesystem.getUri({
                path: cachePath,
                directory: getAppDataDir(),
              });
              cacheUri = Capacitor.convertFileSrc(uriResult.uri);
            } catch (e) {
              needsWrite = true;
            }

            // cache miss: fetch data
            if (needsWrite) {
              if (game.sourceType === "external" && game.sourceId) {
                try {
                  const folderRef = { id: game.sourceId };
                  const { data } = await ScopedStorage.readFile({
                    folder: folderRef,
                    path: game.relativePath || game.filename,
                    encoding: "base64",
                  });
                  base64Data = data;
                } catch (e) {}
              } else {
                // INTERNAL
                try {
                  const r = await Filesystem.readFile({
                    path: this.resolvePath(`${CARTS_DIR}/${game.filename}`),
                    directory: getAppDataDir(),
                  });
                  base64Data = r.data;
                } catch (e) {}
              }

              // write to cache & get uri
              if (base64Data) {
                try {
                  await Filesystem.writeFile({
                    path: cachePath,
                    data: base64Data,
                    directory: getAppDataDir(),
                    recursive: true, // ensure cache folder exists if deleted
                  });
                  const stat = await Filesystem.getUri({
                    path: cachePath,
                    directory: getAppDataDir(),
                  });
                  cacheUri = Capacitor.convertFileSrc(stat.uri);
                } catch (e) {
                  if (isWeb) {
                    // web fallback
                    cacheUri = `data:image/png;base64,${base64Data}`;
                  }
                }
              }
            }

            // assign light uri
            if (cacheUri) {
              game.cover = cacheUri;
            }
          } catch (e) {
            console.warn(
              `[LibraryManager] Failed to load cover for ${game.filename}`,
              e,
            );
          }
        }),
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
        "",
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
        `[library_manager] processing batch of ${fileList.length} files...`,
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
            `Text cartridges (.p8) are not supported.\nPlease open "${file.name}" in PICO-8 and save it as a .p8.png (Image Cart) to play.`,
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
              `[library_manager] cluster merge: '${keyB}' -> '${keyA}'`,
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
            `[library_manager] merge detected! merging '${stem}' into existing '${matchKey}'`,
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
        } bundles (after merge checks): ${stemNames.join(", ")}`,
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
        `[library_manager] leader selected by heuristic: ${leader.name}`,
      );
    } else {
      leader = files[0];
    }

    if (!leader) return false;

    console.log(
      `[library_manager] creating bundle "${stemName}" led by: ${leader.name}`,
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

  async loadCartData(gameOrPath) {
    let game =
      typeof gameOrPath === "string"
        ? this.games.find((g) => g.filename === gameOrPath)
        : gameOrPath;

    if (!game) {
      if (typeof gameOrPath === "string") {
        game = { filename: gameOrPath, sourceType: "internal" };
      } else {
        game = gameOrPath || { filename: "unknown", sourceType: "internal" };
      }
    }

    if (game.sourceType === "external" && game.sourceId && game.relativePath) {
      // hybrid: read from saf
      try {
        const folderRef = { id: game.sourceId };
        const { data } = await ScopedStorage.readFile({
          folder: folderRef,
          path: game.relativePath,
          encoding: "base64",
        });
        return data;
      } catch (e) {
        console.warn(
          `[LibraryManager] external read failed for ${game.filename}`,
          e,
        );
        return null;
      }
    } else {
      // internal
      try {
        const isAndroid = Capacitor.getPlatform() === "android";
        const res = await Filesystem.readFile({
          path: this.resolvePath(`${CARTS_DIR}/${game.filename}`),
          directory: getAppDataDir(),
        });
        return res.data; // base64
      } catch (e) {
        console.warn(
          `[LibraryManager] internal load failed: ${game.filename}`,
          e,
        );
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

  async deleteCartridge(filename, deleteExternalFile = false) {
    try {
      // find game entry & check source type
      const game = this.games.find((g) => g.filename === filename);
      const isExternal = game && game.sourceType === "external";

      // recursive bundle deletion (clean up sub-carts)
      const meta = this.metadata[filename];
      if (meta && meta.subCarts && Array.isArray(meta.subCarts)) {
        console.log(
          `[library_manager] deleting sub-carts for ${filename}: ${meta.subCarts.join(
            ", ",
          )}`,
        );
        for (const sub of meta.subCarts) {
          // subcarts follow
          // if external only delete if deleteExternalFile true
          if (isExternal) {
            if (deleteExternalFile && game.sourceId) {
              try {
                await ScopedStorage.deleteFile({
                  folder: { id: game.sourceId },
                  filename: sub,
                });
              } catch (e) {}
            }
          } else {
            // internal delete file
            try {
              await Filesystem.deleteFile({
                path: this.resolvePath(`${CARTS_DIR}/${sub}`),
                directory: getAppDataDir(),
              });
            } catch (e) {
              /* ignore */
            }
          }

          // delete sub-cart metadata
          if (this.metadata[sub]) delete this.metadata[sub];
        }
      }

      // DELETE MAIN CARTRIDGE
      let deleteSuccess = false;

      if (isExternal) {
        if (deleteExternalFile && game.sourceId) {
          try {
            await ScopedStorage.deleteFile({
              folder: { id: game.sourceId },
              filename: game.relativePath || filename,
            });
            deleteSuccess = true;
            console.log(`[LibraryManager] Deleted external file: ${filename}`);
          } catch (e) {
            console.warn("[LibraryManager] Failed to delete external file:", e);
          }
        } else {
          deleteSuccess = true;
          console.log(
            `[LibraryManager] Removed external reference: ${filename}`,
          );
        }
      } else {
        // internal: always delete
        try {
          await Filesystem.deleteFile({
            path: this.resolvePath(`${CARTS_DIR}/${filename}`),
            directory: getAppDataDir(),
          });
          deleteSuccess = true;
        } catch (e) {
          console.warn("[LibraryManager] Failed to delete internal file:", e);
        }
      }

      // delete cached file/cover (android/cache)
      try {
        await Filesystem.deleteFile({
          path: this.resolvePath(`${CACHE_DIR}/${filename}`),
          directory: getAppDataDir(),
        });
      } catch (e) {}

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
      console.warn("Delete failed", e);
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
          "Invalid local file signature (not PNG), re-downloading.",
        );
      }

      // exists and looks valid
      return { exists: true, filename: targetFilename };
    } catch (e) {
      console.warn(
        `[library_manager] local validation/check failed: ${e.message}. Deleting if exists.`,
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
          `https://carts.lexaloffle.com/${targetFilename}`,
        );
      } catch (e1) {
        console.warn(
          "[library_manager] direct download failed, trying proxy...",
          e1,
        );
        // proxy download
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(
          `https://carts.lexaloffle.com/${targetFilename}`,
        )}`;
        blob = await fetchBlob(proxyUrl);
      }

      // WRITE TO DISK
      // blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            const b64 = reader.result.split(",")[1];
            resolve(b64);
          } else {
            reject(new Error("Failed to convert blob to base64"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64Data = await base64Promise;
      try {
        await Filesystem.stat({ path: CARTS_DIR, directory: getAppDataDir() });
      } catch {
        await Filesystem.mkdir({
          path: CARTS_DIR,
          directory: getAppDataDir(),
          recursive: true,
        });
      }

      // write the cart to disk
      const savePath = this.resolvePath(`${CARTS_DIR}/${targetFilename}`);

      await Filesystem.writeFile({
        path: savePath,
        data: base64Data,
        directory: getAppDataDir(),
      });

      console.log(`[library_manager] Saved deep cart to ${savePath}`);

      // update metadata to boost to top (fix sorting)
      if (!this.metadata[targetFilename]) {
        this.metadata[targetFilename] = { playCount: 0, lastPlayed: 0 };
      }
      this.metadata[targetFilename].lastPlayed = Date.now();
      await this.saveMetadata();

      // trigger visual refresh
      await this.scan();

      return { exists: false, downloaded: true, filename: targetFilename };
    } catch (err) {
      console.error(`[library_manager] deep link download failed:`, err);
      throw err;
    }
  }

  async resetLibrary(fullWipe = false) {
    console.log(`[LibraryManager] Resetting library. Full Wipe: ${fullWipe}`);

    // clear external sources
    this.syncSources = [];
    localStorage.removeItem(SYNC_SOURCES_KEY);

    // remove external games from memory
    if (!fullWipe) {
      // just remove from the list
      this.games = this.games.filter((g) => g.sourceType !== "external");
      try {
        await Filesystem.rmdir({
          path: this.resolvePath(CACHE_DIR),
          recursive: true,
          directory: getAppDataDir(),
        });
        await Filesystem.mkdir({
          path: this.resolvePath(CACHE_DIR),
          recursive: true,
          directory: getAppDataDir(),
        });
      } catch (e) {}
    }

    // full wipe
    if (fullWipe) {
      try {
        // delete carts content
        await Filesystem.rmdir({
          path: this.resolvePath(CARTS_DIR),
          recursive: true,
          directory: getAppDataDir(),
        });
        await Filesystem.mkdir({
          path: this.resolvePath(CARTS_DIR),
          recursive: true,
          directory: getAppDataDir(),
        });

        // delete cache content
        try {
          await Filesystem.rmdir({
            path: this.resolvePath(CACHE_DIR),
            recursive: true,
            directory: getAppDataDir(),
          });
          await Filesystem.mkdir({
            path: this.resolvePath(CACHE_DIR),
            recursive: true,
            directory: getAppDataDir(),
          });
        } catch (e) {}

        // reset metadata
        this.metadata = {};
        await Filesystem.deleteFile({
          path: this.resolvePath(LIBRARY_FILE),
          directory: getAppDataDir(),
        }).catch(() => {});

        // reset games
        this.games = [];
      } catch (e) {
        console.error("Full wipe failed", e);
      }
    }

    // save state
    await this._saveIndex(this.games);
    localStorage.setItem("pico_cached_games", JSON.stringify(this.games));

    return true;
  }
}

export const libraryManager = new LibraryManager();
