[简体中文](README.zh_CN.md) · **English**

# Web UI simulator

Run and debug AI Passport UI in a browser without connecting a device. The
simulator displays a 240 × 320 RGB565 screen inside the device shell, with
interactive keys, event logging, screenshots, and fullscreen preview.

The current preview compiles `main/ui_pixel.c`, `main/demo_display.c`,
`main/demo_button.c`, and the BSP's rounded-display geometry into WebAssembly.
LVGL renders the screen, and button events call the original C handlers.
Two pages are available: display testing and button testing.

## Repositories and directory layout

This project is an independent `web-simulator` repository. The official
`ai-passport` repository supplies application sources, BSP, and LVGL dependencies.
Clone this project into its `tools/web-simulator` directory:

```text
ai-passport/                  # Official application project
├── main/
├── components/bsp/
├── managed_components/lvgl__lvgl/
├── build/                   # Firmware and simulator build output
└── tools/
    └── web-simulator/       # This project, a separate Git repository
        ├── assets/
        ├── web/
        ├── build.py
        └── start.sh
```

The simulator reads application sources from the parent project rather than
bundling a copy.

## Before you start

This guide assumes the AI Passport development environment is already configured
and the project has completed its first firmware build. Python 3, CMake, Ninja,
and the pinned LVGL Managed Component should therefore be available. The extra
requirement for the web simulator is **Emscripten 4.0.23**.

The commands below use Bash or Zsh on macOS, Linux, or WSL2. After installation, run simulator commands
from `ai-passport/tools/web-simulator`. For native Windows, follow the
[Emscripten installation instructions](https://emscripten.org/docs/getting_started/downloads.html)
and activate its terminal environment, then use `python run.py`
in place of the shell launcher.

## 1. Get the official project and the simulator

If you already have a configured official project, enter its `tools` directory
without cloning again. For a new checkout, start below and complete the official
development setup using the existing tutorial; those steps are not repeated here.

```bash
git clone https://gitee.com/FoloToy/ai-passport.git
cd ai-passport
# Complete official environment setup and the first firmware build here
cd tools
```

Clone this project next. Replace the placeholder with this project's actual Git
repository URL before running the command:

```bash
git clone <WEB_SIMULATOR_REPOSITORY_URL> web-simulator
cd web-simulator
```

Without --project, the directory layout above determines the application root.
Use --project to select an external application without copying the simulator. To have the
application repository ignore this independent checkout, add
`/tools/web-simulator/` to its `.git/info/exclude`. This is local configuration
and does not modify the official `.gitignore`.

## 2. Install and activate Emscripten

If Emscripten 4.0.23 is already installed, reuse that SDK and activate it in the
current terminal. Otherwise, install it through the official `emsdk` repository.
The example directory is outside the project; choose another location if needed.
If the directory already contains an SDK, reuse it instead of cloning over it.

```bash
export AI_PASSPORT_EMSDK_ROOT="$HOME/esp/emsdk"
mkdir -p "$(dirname "$AI_PASSPORT_EMSDK_ROOT")"
git clone https://github.com/emscripten-core/emsdk.git "$AI_PASSPORT_EMSDK_ROOT"
"$AI_PASSPORT_EMSDK_ROOT/emsdk" install 4.0.23
"$AI_PASSPORT_EMSDK_ROOT/emsdk" activate 4.0.23
source "$AI_PASSPORT_EMSDK_ROOT/emsdk_env.sh"
```

Verify the tools before starting:

```bash
emcc --version
command -v emcmake
cmake --version
ninja --version
python3 --version
```

`emcc` should report 4.0.23. Installation is needed once; activation applies to
the current terminal. In a new terminal, source the SDK's `emsdk_env.sh` again,
or pass its directory to the launcher using `EMSDK` as shown below.

### Windows

Native Windows works without Git Bash or WSL. For the first installation, run these in PowerShell with Git and Python available. Skip cloning and installation when reusing an SDK:

```powershell
Set-Location 'F:\myProjects\folotoy'
git clone https://github.com/emscripten-core/emsdk.git emsdk
Set-Location emsdk
.\emsdk.bat install 4.0.23
.\emsdk.bat activate 4.0.23
```

Open ESP-IDF PowerShell to reuse installed host tools, then enter CMD with the SDK environment. Running a .bat directly in PowerShell should not be assumed to update the parent PowerShell environment:

```powershell
cmd /k 'call F:\myProjects\folotoy\emsdk\emsdk_env.bat'
```

Run the following in that **CMD** session. The example uses installed CMake 3.30.2 and Ninja 1.12.1; substitute actual directories if different. Skip set if the tools are already available:

```bat
set "PATH=D:\Espressif\tools\cmake\3.30.2\bin;D:\Espressif\tools\ninja\1.12.1;%PATH%"
emcc --version
where emcmake
cmake --version
ninja --version
python --version
cd /d F:\myProjects\folotoy\ai-passport\tools\web-simulator
python run.py
```

Open http://127.0.0.1:8765/, keep the window open and press Ctrl+C to stop. This launches ai-passport's default test pages. For your application, launch from its tools/web-simulator and follow the [integration guide](INTEGRATION.md). Setting EMSDK alone does not make run.py load SDK settings; automatic SDK loading belongs to start.sh.

Use python run.py --port 8766 to change ports, python run.py --no-watch to disable monitoring, or python build.py to build only. New terminals require environment/PATH activation again, not reinstallation.

## 3. Start the simulator

From `ai-passport/tools/web-simulator`:

```bash
./start.sh
```

The launcher uses an activated Emscripten environment. To select an SDK without
activating it manually:

```bash
EMSDK="$HOME/esp/emsdk" ./start.sh
```

The first run compiles LVGL and the connected C pages, then prints:

```text
Local: http://127.0.0.1:8765/
```

Open that address in your browser. Wait for the status to show that the runtime
is running before using the keys. Keep the terminal open; press Ctrl+C to stop.
The server listens only on the local machine and serves `build/web-simulator/`.

Optional launch arguments:

```bash
./start.sh --port 8766
./start.sh --no-watch
```

Use another port if 8765 is occupied. `--no-watch` disables automatic rebuilding.
To build without starting a server, activate Emscripten first and run:

```bash
python3 build.py
```

Generated web assets and incremental build files are stored in
`build/web-simulator/` and `build/web-simulator-cache/`; both are under the official application's `build/`, outside this repository.

## 4. Test the connected pages

Select a page in the debugging panel, then click the device keys or the larger
buttons next to the preview. The display is a canvas, so use the keys to operate
these pages rather than clicking their screen contents.

| Page | Operation | Expected result |
| --- | --- | --- |
| Display testing | Click OK | Cycle through red, green, blue, white, and black |
| Display testing | Click UP or DOWN | Cycle through 100%, 50%, and 10% brightness |
| Button testing | Click, double-click, or hold a key | Show the corresponding events on the screen and in the event log |
| Button testing | Enable the simulated ADC slider | Show the injected voltage; disabling it exercises the read-failure path |

Keyboard arrows map to UP/DOWN, Enter to OK, and P to simulated power.
Form controls retain their normal keyboard behavior. The input adapter supports
one held key at a time and emits the BSP's four event types:

- `PRESS`: immediately on key-down.
- `CLICK`: after a short release and a 250 ms double-click waiting period.
- `DOUBLE`: two short releases within that waiting period, without extra CLICKs.
- `LONG`: after holding for 600 ms, without a CLICK on release.

These timing thresholds are simulator defaults. Focus loss, tab hiding, or a
cancelled pointer clears held keys and pending events. The event log helps
distinguish input delivery from a page choosing not to handle an event.

Use the restart button to reset the selected page. Simulated power clears the
screen when off and reopens the selected page when on. ADC values are injected
for testing, not measured from hardware.

Switch between device and screen-only views for layout inspection. Screenshots
are native-resolution 240 × 320 PNGs, including simulated brightness and rounded
masking. Copy falls back to downloading if clipboard access is unavailable or
denied. Fullscreen falls back to a page-sized view if necessary.

## 5. Debug and iterate

While the server runs, saving a watched source file triggers an incremental
build. A successful build reloads the browser. A failed build leaves the previous
preview visible with a failure status; inspect the terminal output, fix the
error, and save again. Reloading resets the simulated page state.

Build fingerprints cover shared C files and headers, LVGL sources, browser
adapters, web assets, and the shell asset. The status displays the current build
identifier so you can distinguish preview versions.

For browser-side debugging, open Developer Tools. `passportSimulator` exposes
`down`, `up`, `cancel`, `setPaused`, and `snapshot`, along with read-only
`ready`, `frames`, `powered`, and `brightness` properties. For example:

```javascript
passportSimulator.down('OK');
passportSimulator.up('OK');
```

This uses the same input normalization as the visible controls.

## 6. Connect your application

The launcher automatically discovers web-simulator.json in the selected application root. It configures sources, assets, page menus and C hooks without editing generic CMake or routing files. Prepare the application interfaces and browser service adapters once; then use `python run.py --project "F:\path\your-app"`. See the [automatic integration guide](INTEGRATION.md) for the manifest and detection limits.

## Validation and limitations

After building the simulator, run its input and compiled-WASM interaction tests
with Node.js supporting `node --test`:

```bash
node --test test_input.mjs test_runtime.mjs
```

Run firmware validation with `./tools/validate.sh` from the official application
project root. Browser tests
cover selected UI rendering and handlers. This simulator does not execute a
complete ESP32-C3 firmware image and cannot load a merged `.bin`.
FreeRTOS scheduling, Wi-Fi, BLE, audio, ADC, battery, NVS, panel color, latency,
power consumption, and the device's RAM limits require hardware validation.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Emscripten is missing or `emcmake` is unavailable | Source the selected SDK's `emsdk_env.sh`, or pass its directory through `EMSDK` |
| Missing pinned LVGL dependency | Complete the project's first firmware build in the activated ESP-IDF environment |
| CMake or Ninja is unavailable | Check the host tools from the development environment setup and the current terminal's PATH |
| Address already in use | Start with `--port 8766` and open the printed address |
| Runtime does not load | Use the local HTTP address, not a `file://` URL; check terminal output and the browser console |
| A key appears to do nothing | Confirm the runtime is running and power is on; inspect the event log and the selected page's supported actions |
| Preview still shows an old version | Check for a build failure in the terminal; with `--no-watch`, restart after changing sources |
