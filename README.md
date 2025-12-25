# Pocket8

A native PICO-8 emulator for iOS that bridges the gap between web flexibility and native filesystem access!

![Demo](assets/demo.gif)

## Features

- **Native Persistence**: Implements a custom "Handoff & Sync" protocol ensuring 100% save-state integrity across app restarts.
- **Quick Save & Load**: The **only** PICO-8 experience with instant save states. Freeze time and resume anywhere, across devices.
- **Adaptive Controls**: Custom Gameboy-esque controls with beautiful haptics. Emulator works in portrait and landscape modes.
- **Smart Library**: Automatically extracts cartridge labels and metadata, presenting your collection in a polished grid.

## Under the Hood: A Rant

The core engineering challenge was **reconciling the asynchronous nature of iOS file I/O with the synchronous requirements of the Emscripten/WASM virtual file system.**

PICO-8 demands a synchronous file system. Bridging this gap required completely reverse-engineering the Emscripten boot sequence.

- **Bootloader Hijacking:** The engine defaults to booting the standard "JELPI" demo cart. To bypass this, I had to intercept the `Module.preRun` lifecycle, manually injecting user code into the WASM heap and forcing the pointer to the correct entry point before the runtime could initialize.
- **True State Persistence:** I architected a system that dumps the _entire simulated RAM_ (not just the cart data) into a serialized blob. I implemented **GZIP** compression to keep these memory snapshots lightweight, allowing for atomic, instant state restoration.

It’s _not_ a browser wrapper; it’s a custom runtime environment built for native iOS, enjoy the speeds!

## Tech Stack

![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)
![Capacitor](https://img.shields.io/badge/Capacitor-1199EE?style=for-the-badge&logo=capacitor&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)
![iOS](https://img.shields.io/badge/iOS-000000?style=for-the-badge&logo=apple&logoColor=white)

## Installation

- opens xcode, click the play button to build and run

```bash
npm install && npx cap sync && npx cap open ios
```
