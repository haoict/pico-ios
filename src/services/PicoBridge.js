import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { EngineLoader } from '../utils/EngineLoader';
import { haptics } from '../utils/haptics';

/*
 * architecture:
 * 1. prepares window.module with poison protocol
 * 2. injects cartridge into vfs
 * 3. clears _cartdat to bypass embedded loader
 * 4. forces offline mode
 * 5. boots engine via callmain
 */

class Pico8Bridge {
  constructor() {
    this.isActive = false;
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

    // for BIOS_PATCHES
    window.pico8_is_web = Capacitor.getPlatform() === 'web';

    // configure emscripten module
    window.Module = {
      // dynamic canvas getter
      get canvas() {
        return document.getElementById('canvas');
      },

      // race condition fix
      noInitialRun: true,

      preRun: [
        function () {
          console.log('[pico_bridge] prerun: starting...');
          // the one true fs check
          if (typeof FS === 'undefined') {
            console.error('[pico_bridge] FS not found, aborting boot.');
            return;
          }

          // force offline mode
          // window.lexaloffle_bbs_player = 0;

          try {
            console.log('[pico_bridge] launching engine, writing cart files to vfs...');
            let bootTarget;
            // write all files with original names
            for (const [fname, content] of Object.entries(cartData)) {
              // write file as-is
              const path = fname.startsWith('/') ? fname : '/' + fname;
              const writeData = typeof content === 'string' ? content : new Uint8Array(content);
              FS.writeFile(path, writeData);
              bootTarget = bootTarget ?? path;
            }

            /*try {
              console.log('[vfs debug] final file list in root:');
              const files = window.Module.FS.readdir('/');
              console.table(files);
            } catch (e) {
              console.log('vfs read failed', e);
            }*/

            // handle potential strict mode error safely
            try {
              delete window._cartdat;
            } catch (e) {
              window._cartdat = null;
            }

            // execute
            window.Module.arguments = ['-run', bootTarget];
            console.log(`[pico_bridge] calling main with argv: ${window.Module.arguments.join(' ')}`);
            window.Module.callMain(window.Module.arguments);
          } catch (e) {
            console.error('[error] vfs/boot error:', e);
          }
        },
      ],

      print: text => {},
      printErr: text => {},
      onRuntimeInitialized: () => {
        console.log('[pico_bridge] runtime initialized.');
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

export const picoBridge = new Pico8Bridge();

// global access (for debugging)
window.picoBridge = picoBridge;
