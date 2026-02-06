import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { EngineLoader } from '../utils/EngineLoader';
import { haptics } from '../utils/haptics';

/*
 * architecture:
 * 1. prepares window.module with poison protocol
 * 2. injects cartridge into vfs via poller
 * 3. clears _cartdat to bypass embedded loader
 * 4. forces offline mode
 * 5. boots engine via callmain
 */

class Pico8Bridge {
  constructor() {
    this.isActive = false;
    this.isInitialSyncDone = false;
    this.isSyncingInProgress = false;
    this.initGlobalState();
  }

  initGlobalState() {
    // required by game.js schema
    window.pico8_gpio = new Array(128);
    window.p8_is_running = false;
  }

  /**
   * boot a cartridge
   * @param {string} cartName - filename
   * @param {Uint8Array} cartData - binary data
   */
  async boot(cartName, cartData) {
    if (this.isActive) {
      this.shutdown();
    }

    this.isActive = true;
    this.currentCartName = cartName;
    console.log(`[pico_bridge] booting: ${cartName}`);

    // silence internal engine
    localStorage.setItem('pico8_debug', '0');

    // prepare global state for injection
    window._cartdat = cartData;
    // force name: fixes boot timeout by ensuring engine finds the expected file
    // regardless of what the user called it (e.g. "My Game.p8.png")
    const safeCartName = 'cart.png';
    window._cartname = [safeCartName];

    window.pico8_is_web = Capacitor.getPlatform() === 'web';

    // configure emscripten module
    window.Module = {
      // dynamic canvas getter
      get canvas() {
        return document.getElementById('canvas');
      },

      // force pico-8 to use /appdata for saves/config
      // and force load the specific file we inject (cart.png)
      arguments: ['-p', '/cart.png'],

      // race condition fix
      noInitialRun: true,

      preRun: [
        function () {
          console.log('[pico_bridge] prerun: starting...');

          // determine directory based on platform
          const platform = Capacitor.getPlatform();

          try {
            // ensure saves dir exists
            const dir = Directory.Documents;
            let path = 'Saves';
            if (platform === 'android') path = 'Pocket8/Saves';

            Filesystem.mkdir({
              path: path,
              directory: dir,
              recursive: true,
            }).catch(() => {});
          } catch (e) {}

          console.log('[pico_bridge] pulse-starting engine...');
          window.pico8_buttons = [0];
          window.pico8_gpio = new Array(128);

          // force fs release logic
          if (!Module.FS && typeof FS !== 'undefined') {
            Module.FS = FS;
            console.log('[pico_bridge] module.fs = fs (global) forced.');
          }
          // fallback to window.fs
          if (!Module.FS && window.FS) {
            Module.FS = window.FS;
            console.log('[pico_bridge] module.fs = window.fs forced.');
          }

          console.log('[pico_bridge] prerun: starting vfs poller...');
          let pollCount = 0;
          const MAX_POLLS = 1500;

          // clear previous if exists to prevent zombies
          if (window.pico8_poller) clearInterval(window.pico8_poller);

          window.pico8_poller = setInterval(async () => {
            pollCount++;

            // if engine is already running stop polling
            if (window.p8_is_running && window.pico8_engine_ready) {
              console.log('[pico_boot] engine running stable, killing poller.');
              clearInterval(window.pico8_poller);
              window.pico8_poller = null;
              return;
            }

            // the one true fs check
            const mod = window.Module;
            const engineReady = mod && mod.FS && typeof mod.callMain === 'function';

            let fs = null;
            if (engineReady) {
              fs = mod.FS;
              if (!window.pico8_engine_ready) {
                window.FS = fs;
                window.pico8_engine_ready = true;
                console.log('[pico_boot] engine ready (module.fs checks out)');
              }
            }

            const canvasEl = document.getElementById('canvas');
            const hasCallMain = engineReady;

            // poller to 'true'
            let cartExists = false;
            try {
              if (fs && fs.analyzePath('/cart.png').exists) {
                cartExists = true;
                if (pollCount % 100 === 0) console.log('[pico_boot] poller confirmed /cart.png exists on vfs.');
              }
            } catch (e) {}

            const hasCart = !!window._cartdat || cartExists;

            // debug heartbeat every 1s
            if (pollCount % 100 === 0) {
              console.log(`[pico_boot] poll #${pollCount}: fs=${!!fs}, canvas=${!!canvasEl}, callmain=${hasCallMain}, cart=${hasCart}`);
            }

            // timeout failsafe
            if (pollCount > MAX_POLLS) {
              console.error('[error] timeout: engine failed to initialize.');
              clearInterval(window.pico8_poller);
              window.pico8_poller = null;
              haptics.error();
              return;
            }

            // inject cartridge
            if (window._cartdat) {
              try {
                // ensure clean slate
                try {
                  fs.unlink('/cart.png');
                } catch (e) {}

                // the offline patch
                window.lexaloffle_bbs_player = 0;

                // launch logic
                // ensure canvas in dom and engine ready
                if (canvasEl && hasCallMain) {
                  console.log('[pico_bridge] poller: launching engine...');

                  // determine boot target & write file
                  let bootTarget = '';
                  const data = window._cartdat;

                  // check for single file (binary/string) vs bundle (object)
                  const isSingle = typeof data === 'string' || data.byteLength !== undefined || Array.isArray(data);

                  if (isSingle) {
                    console.log('[pico_boot] single cart. writing to /cart.png (fixes timeout)');
                    bootTarget = '/cart.png'; // <--- critical fix
                    const writeData = typeof data === 'string' ? data : new Uint8Array(data);
                    fs.writeFile(bootTarget, writeData);
                  } else {
                    console.log('[pico_boot] bundle detected. writing files...');
                    // write all files with original names
                    for (const [fname, content] of Object.entries(data)) {
                      // write file as-is
                      const path = fname.startsWith('/') ? fname : '/' + fname;
                      const writeData = typeof content === 'string' ? content : new Uint8Array(content);
                      fs.writeFile(path, writeData);

                      // shotgun aliasing safety net
                      if (path.endsWith('.p8.png')) {
                        const p8Path = path.replace('.p8.png', '.p8');
                        const noExtPath = path.replace('.p8.png', '');

                        try {
                          fs.writeFile(p8Path, writeData);
                        } catch (e) {}
                        try {
                          fs.writeFile(noExtPath, writeData);
                        } catch (e) {}
                      }

                      // update boot target (heuristic: title > shortest)
                      const nameLower = path.toLowerCase();
                      const currentTargetLower = bootTarget ? bootTarget.toLowerCase() : '';
                      const currentHasTitle = currentTargetLower.includes('title');

                      if (!bootTarget) {
                        bootTarget = path;
                        console.log(`[pico_boot] initial candidate: ${bootTarget}`);
                      }
                      // if we find a 'title' cart, it automatically wins
                      else if (nameLower.includes('title') && !currentHasTitle) {
                        bootTarget = path;
                        console.log(`[pico_boot] title priority! updating candidate to: ${bootTarget}`);
                      }
                      // if neither has 'title', picking the shorter name is safest bet
                      else if (!currentHasTitle && !nameLower.includes('title') && path.length < bootTarget.length) {
                        bootTarget = path;
                        console.log(`[pico_boot] shorter name found. updating candidate to: ${bootTarget}`);
                      }
                    }
                  }

                  // launch
                  if (!bootTarget.startsWith('/')) bootTarget = '/' + bootTarget;

                  try {
                    console.log('[vfs debug] final file list in root:');
                    const files = window.Module.FS.readdir('/');
                    console.table(files);
                  } catch (e) {
                    console.log('vfs read failed', e);
                  }

                  console.log(`[pico_boot] manually calling main with: ${bootTarget}`);

                  // kill poller
                  clearInterval(window.pico8_poller);
                  window.pico8_poller = null;
                  // handle potential strict mode error safely
                  try {
                    delete window._cartdat;
                  } catch (e) {
                    window._cartdat = null;
                  }

                  // execute
                  window.Module.arguments = ['-p', bootTarget, '-run', bootTarget];
                  window.Module.callMain(window.Module.arguments);
                }
              } catch (e) {
                console.error('[error] vfs/boot error:', e);
              }
            }
          }, 10); // poll every 10ms
        },
      ],

      print: text => {},
      printErr: text => {},
      onRuntimeInitialized: () => {
        // # force fs exposure
        if (window.Module && window.Module.FS) {
          window.FS = window.Module.FS;
          console.log('[pico_bridge] window.fs exposed');
        }

        // # expose ram pointer if available
        try {
          if (typeof window._pico8_ram_ptr === 'function') {
            window.pico_ram_ptr = window._pico8_ram_ptr();
            window.pico8_ram_ptr = window.pico_ram_ptr;
          }
        } catch (e) {}

        window.p8_is_running = true;
      },
    };

    // inject script
    await EngineLoader.inject();
  }

  shutdown() {
    this.isActive = false;
    window.p8_is_running = false;

    // kill switch for pico8.js loop
    window.Pico8Kill = true;

    // stop boot poller if active
    if (window.pico8_poller) {
      clearInterval(window.pico8_poller);
      window.pico8_poller = null;
    }

    // attempt clean engine pause
    try {
      if (window.Module && window.Module.pauseMainLoop) {
        window.Module.pauseMainLoop();
      }
    } catch (e) {}

    // audio context cleanup
    if (window.pico8_audio_context) {
      try {
        window.pico8_audio_context.close();
      } catch (e) {}
      window.pico8_audio_context = null;
    }

    // kill script
    const existing = document.getElementById('pico8-engine-script');
    if (existing) existing.remove();

    // nuke module
    window.Module = null;
  }

  /*
   * helper: standardize save state path
   * strips extensions and appends _manual.state
   */
  getCleanStatePath(cartName) {
    if (!cartName) return 'uknown_cart_manual.state';
    // strip common extensions
    const cleanName = cartName.replace(/(\.p8\.png|\.p8|\.png)$/i, '');
    return `Saves/${cleanName}_manual.state`;
  }

  async captureFullRAMState(pathOverride = null) {
    try {
      if (!window.Module || !window.Module.HEAPU8) throw new Error('Emscripten not ready');

      // full heap snapshot + gzip compression
      console.log('[memory_hunter] capturing full execution heap...');

      // create copy of heap
      const heapData = new Uint8Array(window.Module.HEAPU8);

      // gzip compression
      const b64Promise = new Promise(async (resolve, reject) => {
        try {
          const blob = new Blob([heapData]);
          const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'));
          const compressedBlob = await new Response(compressedStream).blob();

          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.onerror = e => reject(e);
          reader.readAsDataURL(compressedBlob);
        } catch (e) {
          reject(e);
        }
      });

      const b64 = await b64Promise;

      // use provided path or generate default
      const filename = pathOverride || this.getCleanStatePath(this.currentCartName);

      // resolve platform path
      const platform = Capacitor.getPlatform();
      const dir = Directory.Documents;

      let finalPath = filename;
      if (platform === 'android' && !filename.startsWith('Pocket8/')) {
        finalPath = `Pocket8/${filename}`;
      }

      console.log(`[pico_bridge] saving compressed state (${(b64.length / 1024 / 1024).toFixed(2)} mb) to: ${finalPath} (${platform})`);

      await Filesystem.writeFile({
        path: finalPath,
        data: b64,
        directory: dir,
        encoding: platform === 'web' ? Encoding.Base64 : undefined,
        recursive: true,
      });

      console.log(`[native] full state save success`);
      haptics.success();
      return true;
    } catch (e) {
      console.error('[error] full state capture failed:', e);
      haptics.error();
      return false;
    }
  }

  async loadRAMState(pathOverride = null) {
    try {
      if (!window.Module || !window.Module.HEAPU8) throw new Error('Emscripten not ready');

      const rawFilename = pathOverride || this.getCleanStatePath(this.currentCartName);

      // resolve platform path
      const platform = Capacitor.getPlatform();
      const dir = Directory.Documents;
      let finalPath = rawFilename;
      if (platform === 'android' && !rawFilename.startsWith('Pocket8/')) {
        finalPath = `Pocket8/${rawFilename}`;
      }

      console.log(`[pico_bridge] loading state: ${finalPath} (${platform})`);

      const result = await Filesystem.readFile({
        path: finalPath,
        directory: dir,
      });

      // robust decompression (manual stream)
      console.log('[pico_bridge] decompressing (manual mode)...');

      // manual base64 decode
      const binaryString = window.atob(result.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      let loadedHeap;

      try {
        // decompress via stream
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();

        // read chunks
        const reader = ds.readable.getReader();
        const chunks = [];
        let totalSize = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalSize += value.length;
        }

        // flatten
        const rawData = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          rawData.set(chunk, offset);
          offset += chunk.length;
        }

        loadedHeap = rawData;
        console.log('[pico_bridge] decompression success');
      } catch (e) {
        console.warn('[warning] decompression failed, falling back to raw.', e);
        loadedHeap = bytes;
      }

      console.log(`[memory_hunter] heap size: ${loadedHeap.length} bytes`);

      if (loadedHeap.length !== window.Module.HEAPU8.length) {
        console.warn(`[pico_bridge] heap size mismatch! current: ${window.Module.HEAPU8.length}, saved: ${loadedHeap.length}`);
      }

      // memory transplant
      this.pause();

      const target = window.Module.HEAPU8;
      if (loadedHeap.length <= target.length) {
        target.set(loadedHeap);
      } else {
        console.warn('[pico_bridge] clamping saved heap to fit current allocator.');
        target.set(loadedHeap.subarray(0, target.length));
      }

      // force draw
      if (window.Module._pico8_draw) window.Module._pico8_draw();
      else if (window.Module._draw) window.Module._draw();

      this.resume();

      console.log('[pico_bridge] state injection complete');
      haptics.success();
      return true;
    } catch (e) {
      console.error('[error] state load failed:', e);
      haptics.error();
      return false;
    }
  }

  pause() {
    try {
      if (window.Module && window.Module.pauseMainLoop) {
        window.Module.pauseMainLoop();
      }
      // suspend audio
      const ctx = window.pico8_audio_context || (window.Module && window.Module.sdl_audio_context);
      if (ctx && ctx.state === 'running') ctx.suspend();
    } catch (e) {
      console.warn('wm: pause failed', e);
    }
  }

  resume() {
    try {
      if (window.Module && window.Module.resumeMainLoop) {
        window.Module.resumeMainLoop();
      }
      this.resumeAudio();
    } catch (e) {
      console.warn('wm: resume failed', e);
    }
  }

  async resumeAudio() {
    // ios safari audio unlock
    const ctx = window.pico8_audio_context || (window.Module && window.Module.sdl_audio_context);

    if (ctx && ctx.state === 'suspended') {
      // silent buffer kickstart (force thread priority)
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      await ctx.resume().catch(() => {});
      console.log('[pico_bridge] audiocontext resumed (w/ kickstart)');
    }
  }
}

// singleton export
export const picoBridge = new Pico8Bridge();

// global access (for debugging)
window.Pico8Bridge = picoBridge;
window.picoBridge = picoBridge;
