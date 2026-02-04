import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { ScopedStorage } from "@daniele-rolli/capacitor-scoped-storage";

const CARTS_DIR = "Carts";
const CACHE_DIR = Capacitor.getPlatform() === "android" ? "Cache" : "Images";
const SAVES_DIR = "Saves";
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
    if (Capacitor.getPlatform() === "android") {
      // prevent double-prefix
      if (path.startsWith(ANDROID_APPDATA)) return path;
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
          const existingIdx = this.games.findIndex(
            (g) => g.filename === cart.name,
          );
          const existing = existingIdx > -1 ? this.games[existingIdx] : null;

          const entry = {
            filename: cart.name,
            name: cart.name.replace(/\.p8\.png$/i, "").replace(/\.p8$/i, ""),
            folder: source.name,
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

          if (existingIdx > -1) {
            // update existing external entry (preserve metadata)
            if (existing.sourceType === "external") {
              this.games[existingIdx] = {
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

    // save unified cache
    await this._updateCache();

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
    this.games.forEach((game) => {
      if (game.subCarts && Array.isArray(game.subCarts))
        game.subCarts.forEach((sc) => hiddenCarts.add(sc));
    });

    let internalGames = [];

    // scan internal storage
    const scanPath = this.resolvePath(CARTS_DIR);
    internalGames = await this._scanRecursive(scanPath, CARTS_DIR);

    // filter hidden carts
    internalGames = internalGames.filter((g) => !hiddenCarts.has(g.filename));

    // merge metadata
    // preserve existing game data if file mtime matches
    const previousGamesMap = new Map();
    this.games.forEach((g) => previousGamesMap.set(g.filename, g));

    internalGames = internalGames.map((game) => {
      const prev = previousGamesMap.get(game.filename);

      let preservedCover = null;
      if (prev && prev.sourceType === "internal" && prev.mtime === game.mtime) {
        preservedCover = prev.cover;
      }

      return {
        ...game,
        name: prev?.name || game.filename.replace(/\.p8\.png$/i, "").replace(/\.p8$/i, ""),
        lastPlayed: prev?.lastPlayed || 0,
        playCount: prev?.playCount || 0,
        isFavorite: prev?.isFavorite ?? false,
        sourceType: "internal",
        cover: preservedCover,
        subCarts: prev?.subCarts || [],
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

    // save unified cache
    await this._updateCache();

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
      const data = JSON.parse(result.data);

      // Handle v2.0 unified schema
      if (data.version === "2.0") {
        this.syncSources = data.syncSources || [];
        console.log(`[LibraryManager] Loaded ${data.games.length} games from unified index v2.0.`);
        return data.games;
      }

      // Legacy format (v1.0 - array of games)
      console.log(`[LibraryManager] Loaded ${data.length} games from legacy index v1.0.`);
      return data;
    } catch (e) {
      console.log("[LibraryManager] No index found, will scan.");
      return null;
    }
  }

  // Legacy method - kept for backward compatibility
  // New code should use _updateCache() instead
  async _saveIndex(games) {
    try {
      const indexPath = this.resolvePath(INDEX_FILE);
      // strip non serializable fields
      const serializable = games.map((g) => ({
        filename: g.filename, // Primary key
        name: g.name,
        folder: g.folder || "",
        mtime: g.mtime || 0,
        lastPlayed: g.lastPlayed || 0,
        playCount: g.playCount || 0,
        isFavorite: g.isFavorite ?? false,
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

  // v2.0 unified index format (includes metadata)
  async _saveUnifiedIndex(data) {
    try {
      const indexPath = this.resolvePath(INDEX_FILE);
      const games = data.games || this.games;

      // Serialize game objects directly (no separate metadata)
      const unifiedGames = games.map((g) => {
        return {
          // File identity
          filename: g.filename, // Primary key
          name: g.name, // Display name
          folder: g.folder || "",
          mtime: g.mtime || 0,

          // Source tracking
          sourceType: g.sourceType || "internal",
          sourceId: g.sourceId || null,
          relativePath: g.relativePath || null,

          // Metadata
          lastPlayed: g.lastPlayed || 0,
          playCount: g.playCount || 0,
          isFavorite: g.isFavorite ?? false,
          subCarts: g.subCarts || [],
        };
      });

      await Filesystem.writeFile({
        path: indexPath,
        data: JSON.stringify({
          version: "2.0",
          games: unifiedGames,
          syncSources: data.syncSources || this.syncSources,
        }),
        directory: getAppDataDir(),
        encoding: Encoding.UTF8,
      });

      console.log(`[LibraryManager] Saved unified index v2.0 with ${games.length} games.`);
    } catch (e) {
      console.warn("[LibraryManager] Failed to save unified index:", e);
    }
  }

  // Single cache update method - replaces 8+ scattered sync points
  async _updateCache() {
    try {
      // Save to disk (single source of truth)
      await this._saveUnifiedIndex({
        games: this.games,
        syncSources: this.syncSources,
      });

      console.log(`[LibraryManager] Cache updated: ${this.games.length} games synced.`);
    } catch (e) {
      console.error("[LibraryManager] Cache update failed:", e);
    }
  }

  async _scanRecursive(basePath, relativePath, accumulated = []) {
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
          await this._scanRecursive(subPath, subRelative, accumulated);
        } else if (file.name.endsWith(".p8.png") || file.name.endsWith(".p8")) {
          // found a cart
          let filePath = file.uri;
          if (filePath && filePath.startsWith("file://")) {
            filePath = filePath.replace("file://", "");
          }

          accumulated.push({
            filename: file.name, // Primary identifier
            folder: relativePath.split("/").pop() || "",
            mtime: parseInt(file.mtime) || 0,
            cover: null,
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
            const baseName = this.getStemName(game.filename);
            cacheName = `${baseName}.png`;

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
                  const targetPath = game.relativePath || game.filename;

                  const { data } = await ScopedStorage.readFile({
                    folder: folderRef,
                    path: targetPath,
                    encoding: "base64",
                  });
                  base64Data = data;
                } catch (readErr) {
                  console.warn(
                    `[LibraryManager] External read failed for cover: ${game.filename}`,
                    readErr,
                  );
                }
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
                  console.log(
                    `[LibraryManager] Generated cache for ${game.filename}`,
                  );
                } catch (e) {
                  console.warn(
                    `[LibraryManager] Cache write failed for ${game.filename}`,
                    e,
                  );
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
    await this._updateCache();
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
        /(_[1-9]|_title|_boot|_sfx|_data|_main|_cart|_font|game|title)$/i,
        "",
      );
    }

    // clean up - convert spaces to underscores
    return stem.replace(/ /g, "_").trim();
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
        // look for existing game with same stem
        let matchedGame = null;

        for (const game of this.games) {
          const existingStem = this.getStemName(game.filename);
          if (existingStem === stem) {
            matchedGame = game;
            break;
          }
        }

        if (matchedGame) {
          console.log(
            `[library_manager] merge detected! merging '${stem}' into existing '${matchedGame.filename}'`,
          );

          // load leader data
          const leaderData = await this.loadCartData(matchedGame.filename);
          if (leaderData) {
            groups[stem].push({
              name: matchedGame.filename,
              data: leaderData,
              isP8: matchedGame.filename.toLowerCase().endsWith(".p8"),
              isPng: matchedGame.filename.toLowerCase().endsWith(".png"),
            });
          }

          // load existing subcarts data
          if (matchedGame.subCarts && matchedGame.subCarts.length > 0) {
            for (const sub of matchedGame.subCarts) {
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
      file.name = file.name.toLowerCase();
      if (!file.name.endsWith(".png") && !file.name.endsWith(".p8")) {
        console.log(`[library_manager] skipping non-cart file: ${file.name}`);
        continue;
      }

      // check if file.name is .png but not .p8.png, rename it to .p8.png
      if (file.name.endsWith(".png") && !file.name.endsWith(".p8.png")) {
        const newName = file.name.replace(/\.png$/i, ".p8.png");
        console.log(`[library_manager] renaming image file "${file.name}" to "${newName}"`);
        file.name = newName;
      }

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

    // update game entry or create new one
    let gameIdx = this.games.findIndex((g) => g.filename === leader.name);
    if (gameIdx === -1) {
      // create new game entry
      this.games.push({
        filename: leader.name,
        name: leader.name.replace(/\.p8\.png$/i, "").replace(/\.p8$/i, ""),
        folder: CARTS_DIR,
        mtime: Date.now(),
        lastPlayed: 0,
        playCount: 0,
        isFavorite: false,
        sourceType: "internal",
        cover: null,
        subCarts: subCarts,
      });
    } else {
      // update existing
      this.games[gameIdx].name = leader.name
        .replace(/\.p8\.png$/i, "")
        .replace(/\.p8$/i, "");
      this.games[gameIdx].subCarts = subCarts;
    }

    // cleanup demoted leaders (remove from games array)
    for (const sub of subCarts) {
      const subIdx = this.games.findIndex((g) => g.filename === sub);
      if (subIdx !== -1) {
        console.log(`[library_manager] demoting previous leader: ${sub}`);
        this.games.splice(subIdx, 1);
      }
    }

    await this._updateCache();

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
    return this.games.find((g) => g.filename === cartName);
  }

  // deprecated/wrapper for single file
  async importFile(blob, filename) {
    // mock a file object
    const file = new File([blob], filename);
    return this.importBundle([file]);
  }

  async updateLastPlayed(filename) {
    const gameIdx = this.games.findIndex((g) => g.filename === filename);
    if (gameIdx !== -1) {
      this.games[gameIdx].lastPlayed = Date.now();
      this.games[gameIdx].playCount = (this.games[gameIdx].playCount || 0) + 1;

      // re-sort games by lastPlayed to maintain proper ordering
      this.games.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    } else {
      console.warn(`[LibraryManager] updateLastPlayed: game not found: ${filename}`);
    }

    await this._updateCache();
  }

  async renameCartridge(filename, newName) {
    const gameIdx = this.games.findIndex((g) => g.filename === filename);
    if (gameIdx !== -1) {
      this.games[gameIdx].name = newName;
    }
    await this._updateCache();
    return true;
  }

  async toggleFavorite(filename) {
    const gameIdx = this.games.findIndex((g) => g.filename === filename);
    if (gameIdx !== -1) {
      this.games[gameIdx].isFavorite = !this.games[gameIdx].isFavorite;
      await this._updateCache();
      return this.games[gameIdx].isFavorite;
    } else {
      console.warn(`[LibraryManager] toggleFavorite: game not found: ${filename}`);
    }
    return false;
  }

  async deleteCartridge(filename, deleteExternalFile = false) {
    try {
      // find game entry & check source type
      const game = this.games.find((g) => g.filename === filename);
      const isExternal = game && game.sourceType === "external";

      // recursive bundle deletion (clean up sub-carts)
      const subCarts = game?.subCarts || [];
      if (subCarts.length > 0) {
        console.log(
          `[library_manager] deleting sub-carts for ${filename}: ${subCarts.join(
            ", ",
          )}`,
        );
        for (const sub of subCarts) {
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

      // update internal state w/o rescan
      this.games = this.games.filter((g) => g.filename !== filename);
      await this._updateCache();

      console.log(`[library_manager] removed ${filename} from internal state`);
      return true;
    } catch (e) {
      console.warn("Delete failed", e);
      return false;
    }
  }

  async downloadCart(game) {
    if (!game) {
      throw new Error("Invalid game data");
    }

    console.log(`[LibraryManager] Downloading ${game.title}... URL: ${game.cart_url}`);

    try {
      let downloadUrl = game.cart_url;
      let fileName;

      // If cart_url is missing, try to find it on the forum post page
      if (!downloadUrl) {
        console.log(`[LibraryManager] cart_url missing, trying to find cartridge link on forum post page ${game.source_page_url}...`);
        const pageRes = await fetch(game.source_page_url);
        const pageHtml = await pageRes.text();
        const cart_found = pageHtml.match(
          /Module\.arguments\s*=\s*\[\s*["']([^"']+)["']/i
        );
        if (!cart_found) {
          throw new Error("Could not find cartridge link on BBS page.");
        }
        downloadUrl = `https://www.lexaloffle.com${cart_found[1]}`;
        console.log(`[LibraryManager] 🎯 SOURCE LOCKED: ${downloadUrl}`);
        fileName = game.title.replace(/[^a-z0-9_\-]/gi, "_").substring(0, 30);
      } else {
        fileName = downloadUrl.split("/").pop().split("?")[0];
      }

      if (!fileName.endsWith(".p8.png")) {
        fileName += ".p8.png";
      }
      fileName = fileName.toLowerCase();

      const response = await fetch(downloadUrl, {
        headers: {
          Accept: "image/png,image/*;q=0.8",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (blob.size < 1000) {
        throw new Error(`404/Incomplete Data`);
      }
      console.log(`[LibraryManager] 📥 Downloaded Size: ${blob.size}`);

      // Save to library
      const file = new File([blob], fileName, { type: "image/png" });
      const saved = await this.importBundle([file]);

      if (!saved) {
        throw new Error("Failed to save to library");
      }

      return { success: true, fileName };
    } catch (e) {
      console.error("[LibraryManager] Download failed:", e);
      throw e;
    }
  }

  async handleDeepLink(cartId) {
    const targetFilename = `${cartId}.p8.png`;

    // check if it exists
    try {
      const cartData = await this.loadCartData(targetFilename);
      return { exists: true, filename: targetFilename, cartData: cartData.data };
    } catch (e) {
      console.warn(`[library_manager] local cart load failed: ${e.message}`);
    }

    // else download
    try {
      console.log(`[library_manager] downloading deep link: ${targetFilename}`);
      const game = { title: cartId, cart_url: `https://carts.lexaloffle.com/${targetFilename}`};
      await this.downloadCart(game);
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

        // reset games
        this.games = [];
      } catch (e) {
        console.error("Full wipe failed", e);
      }
    }

    // save state
    await this._updateCache();

    return true;
  }
}

export const libraryManager = new LibraryManager();
