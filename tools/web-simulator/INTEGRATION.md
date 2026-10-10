[简体中文](INTEGRATION.zh_CN.md) · **English**

# Automatically connect the current application

The launcher discovers web-simulator.json in the application root and configures source compilation, include directories, macros, page routing, asset copying and change monitoring. Normally, you do not edit the generic CMakeLists.txt, build.py or simulator.c.

This does not convert arbitrary ESP-IDF firmware into a web application. Shared UI needs browser-callable lifecycle and button interfaces; hardware services need browser implementations. A developer or AI prepares configuration and adapters once, then startup and routine preview are automatic.

## Launch

Activate Emscripten, CMake and Ninja using the [Windows instructions](README.md#windows), then run from the generic simulator:

```bat
python run.py --project "F:\path\your-app" --port 8766
```

Replace the path with the application's actual absolute directory. One generic simulator can serve different projects without copying the entire simulator into each.

Without --project, the root remains two levels above the current tools/web-simulator. Both modes discover that root's web-simulator.json. Without a manifest, the default display/button pages run; arbitrary app_main behavior is not inferred.

Build without serving:

```bat
python build.py --project "F:\path\your-app"
```

The target needs main, components/bsp and its pinned managed_components/lvgl__lvgl. The first firmware build normally prepares Managed Components. Output goes to the target's build/web-simulator. External projects use a separate compiler cache to avoid mixing with their existing simulator cache.

## Minimal configuration

Create web-simulator.json in the application root. Replace these example files and functions with actual implementations:

```json
{
  "version": 1,
  "sources": ["main/app_ui.c", "main/app_services_web.c"],
  "include_dirs": ["main"],
  "defines": ["APP_WEB_SIMULATOR"],
  "pages": [
    {
      "title": "My application",
      "help": "UP / DOWN / OK",
      "enter": "app_ui_enter",
      "exit": "app_ui_exit",
      "step": "app_ui_step",
      "key": "app_ui_key"
    }
  ],
  "watch": ["app-config.json", "assets/generated/*.c"],
  "assets": [
    {"source": "assets/music", "target": "music"}
  ]
}
```

Keep only existing, needed files, directories and macros. Remove the music asset if unused, and remove app-config.json from watch if absent. This example does not create app_ui.c automatically.

| Field | Rule |
| --- | --- |
| version | Currently 1 |
| sources | Required nonempty list of project-relative paths/globs; every pattern must match C/C++ files |
| include_dirs | Optional existing project-relative header directories |
| defines | Optional simple macro names or NAME=value |
| pages | Required nonempty list; array order supplies page numbers and menu entries |
| pages.title / help | Page title and instructions; help is optional |
| pages.enter / exit / key | Required actual C function names |
| pages.step | Optional bounded update called on browser frames |
| watch | Optional project-relative files/globs for configuration, assets or generation scripts |
| assets | Optional existing project-relative source file/directory and output-relative target |

Paths cannot escape the project root. Sources and headers under include_dirs are monitored automatically; asset directories are copied and monitored recursively. New glob matches are recognized on the next check. Monitoring does not execute asset generators; regenerate font/image C arrays through the application workflow after changing images or configuration.

Use output-relative URLs such as music/track.mp3, not local drive paths or file://. Direct overrides of runtime.js, runtime.wasm and build-info.json are rejected. Copy preview assets only, not keys, device data or firmware archives.

## Interfaces needed once

Recommended shared C interfaces; manifest names may differ:

```c
#include "bsp_button.h"
void app_ui_enter(void);
void app_ui_exit(void);
void app_ui_step(void);
void app_ui_key(bsp_btn_t key, bsp_btn_ev_t event);
```

enter creates and loads a page; exit stops timers/callbacks and deletes it; step performs a bounded update; key receives PRESS/CLICK/DOUBLE/LONG. The generic adapter loads parking_screen before exit to avoid deleting an active screen.

The browser is single-threaded: do not execute an infinite app_main loop or block waiting for device tasks, networking or audio. Separate shared UI/services, or isolate device entry points using conditional compilation. C++ entry points need extern "C" to retain matching link names.

Do not link device and browser implementations of the same service together. Keep firmware LVGL locks, input queues, worker lifecycles and error handling; browser no-op locks do not establish device concurrency safety.

## Fonts, images and browser services

Add generated LVGL font/image C files to sources, optionally using globs. Verify Chinese glyph coverage, widget font selection and rendering. Firmware EMBED_FILES symbols are not generated automatically for WASM; provide browser resource implementations.

| Service | Browser implementation | Hardware checks still needed |
| --- | --- | --- |
| Audio | HTMLAudioElement/Web Audio or explicitly unsupported; synchronize progress, pause and ended events | Decoding, I2S, quality, task timing |
| Battery, ADC | Explicit injected values or unavailable | Measurement, calibration |
| Storage | Memory or explicitly designed localStorage; document reload behavior | NVS, persistence |
| Wi-Fi, BLE | Simulated state or unavailable | Connection, provisioning, recovery |
| Brightness | Generic browser_backlight scales Canvas brightness | Backlight hardware, power |

Audio usually requires a user gesture; handle rejected play() and loading failures. Compatibility headers supply needed types/declarations, not unconditional success.

For a custom audio bridge, assets can copy application JS into the output: source main/web/app.mjs with target app.mjs replaces the generic script. Replacement files must preserve generic DOM, WASM and input conventions. An entire custom web directory can target ".". Preserve menu/help initialization from build-info.json pages so web and C page identifiers agree.

The default Canvas has no LVGL touch input. Registering LV_EVENT_CLICKED does not make a settings widget mouse-clickable; use keys or implement a browser-pointer to LVGL input-device adapter.

## Automatic detection scope

Startup discovers configuration. While running, configuration, registered sources, headers and assets trigger incremental builds and successful browser reloads. Adding or editing the manifest does not require restarting if the project/dependencies remain valid. The selected --project is fixed for that server session; restart to switch projects.

Unconfigured hardware services are not replaced automatically. Configuration does not infer functions, create UI, execute asset generators or load firmware .bin. Failed builds retain the previous preview with an error; that old preview is not evidence of a successful new build.

## Verification and troubleshooting

Check configuration parsing and generic default-page WASM interaction:

```bat
python -m unittest test_application.py
node --test test_input.mjs test_runtime.mjs
```

test_runtime.mjs asserts default display/button behavior. For custom applications, use application-specific WASM checks and service mocks, rather than applying default assertions to new pages. Actual browser audio still needs interactive verification.

Check initial UI, fonts/images, CLICK/LONG, teardown, repeated resets, power cycles, pause/resume, track changes/looping and asset loading failure. Confirm that the build identifier changes after edits.

| Problem | Check |
| --- | --- |
| Test pages still appear | --project, root manifest and browser port |
| Configuration rejected | Version, paths, glob matches, page function names |
| undefined reference | Actual service implementation in sources; matching signatures/symbols |
| Missing ESP-IDF headers | Isolate device implementation and add minimal compatibility include directories |
| Changes do not reload | sources/include_dirs/watch/assets and watch mode |
| Image did not change | Application asset generation |
| Media 404 | Asset output target and web URL |
| Frozen UI | Infinite loops or blocking waits on browser paths |

Report web build, runtime checks, browser interaction, firmware build and device tests separately. The browser cannot validate ESP32-C3 RAM, hardware audio, NVS, panel color or power.
