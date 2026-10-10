**简体中文** · [English](README.md)

# Web 界面模拟器

在浏览器中运行和调试 AI Passport 界面，无需连接设备。模拟器提供带设备外壳的
240 × 320 RGB565 屏幕、可交互按键、事件记录、截图和全屏预览。

当前将 `main/ui_pixel.c`、`main/demo_display.c`、`main/demo_button.c` 和 BSP
圆角几何代码编译为 WebAssembly，由 LVGL 渲染画面，按键事件调用原有 C 处理函数。
默认接入显示测试和按键测试两个页面。

## 仓库关系与目录结构

本项目是独立的 `web-simulator` 仓库，官方 `ai-passport` 仓库提供应用源码、
BSP 和 LVGL 依赖。将本项目克隆到官方项目的 `tools/web-simulator` 目录：

```text
ai-passport/                  # 官方应用项目
├── main/
├── components/bsp/
├── managed_components/lvgl__lvgl/
├── build/                   # 固件与模拟器构建产物
└── tools/
    └── web-simulator/       # 本项目，独立 Git 仓库
        ├── assets/
        ├── web/
        ├── build.py
        └── start.sh
```

模拟器读取上层应用源码，不包含官方项目的副本。

## 开始之前

本文默认你已配置好 AI Passport 开发环境，并完成项目的首次固件构建。
因此 Python 3、CMake、Ninja 以及项目固定版本的 LVGL 托管组件应已可用。
使用 Web 模拟器还需要额外安装 **Emscripten 4.0.23**。

以下命令适用于 macOS、Linux 或 WSL2 的 Bash/Zsh。安装完成后，模拟器命令均在
`ai-passport/tools/web-simulator` 目录执行。
原生 Windows 请按 [Emscripten 官方安装说明](https://emscripten.org/docs/getting_started/downloads.html)
安装并激活终端环境，再用 `python run.py` 代替 Shell 启动脚本。

## 1. 获取官方项目和模拟器

如果已有配置完成的官方项目，直接进入它的 `tools` 目录，不必重新克隆。
新目录可从以下命令开始；官方开发环境的配置按原有教程完成，本文不重复展开。

```bash
git clone https://gitee.com/FoloToy/ai-passport.git
cd ai-passport
# 在这里完成官方开发环境配置及首次固件构建
cd tools
```

然后克隆本项目。先将下面的占位符替换为本项目实际的 Git 地址：

```bash
git clone <WEB_SIMULATOR_REPOSITORY_URL> web-simulator
cd web-simulator
```

目录名必须为 `web-simulator`，且位于应用项目的 `tools` 下，当前脚本依赖此目录结构。
若需要让官方项目的 Git 忽略这个独立仓库，可在官方项目的
`.git/info/exclude` 中添加 `/tools/web-simulator/`；这只影响本地，不修改官方 `.gitignore`。

## 2. 安装并激活 Emscripten

如果已经安装 Emscripten 4.0.23，复用现有 SDK 并在当前终端激活即可。
否则，通过官方 `emsdk` 仓库安装。以下示例将 SDK 放在项目之外，路径可自行调整；
如果该目录已经有 SDK，请复用，不要重复克隆或覆盖。

```bash
export AI_PASSPORT_EMSDK_ROOT="$HOME/esp/emsdk"
mkdir -p "$(dirname "$AI_PASSPORT_EMSDK_ROOT")"
git clone https://github.com/emscripten-core/emsdk.git "$AI_PASSPORT_EMSDK_ROOT"
"$AI_PASSPORT_EMSDK_ROOT/emsdk" install 4.0.23
"$AI_PASSPORT_EMSDK_ROOT/emsdk" activate 4.0.23
source "$AI_PASSPORT_EMSDK_ROOT/emsdk_env.sh"
```

启动前检查工具是否可用：

```bash
emcc --version
command -v emcmake
cmake --version
ninja --version
python3 --version
```

`emcc` 应显示 4.0.23。安装只需执行一次，环境激活仅对当前终端生效。
新开终端后，重新执行 SDK 的 `source .../emsdk_env.sh`，或按下面的方式通过
`EMSDK` 告诉启动脚本 SDK 所在目录。

## 3. 启动模拟器

在 `ai-passport/tools/web-simulator` 目录执行：

```bash
./start.sh
```

启动脚本使用已激活的 Emscripten 环境。也可以直接指定 SDK，无需手动激活：

```bash
EMSDK="$HOME/esp/emsdk" ./start.sh
```

首次启动会编译 LVGL 和已接入的 C 页面，随后终端显示：

```text
Local: http://127.0.0.1:8765/
```

在浏览器打开该地址，等待状态变为“运行中”后操作按键。
保持启动终端打开，按 Ctrl+C 停止服务。
服务器仅监听本机地址，提供 `build/web-simulator/` 中的文件。

可选启动参数：

```bash
./start.sh --port 8766
./start.sh --no-watch
```

8765 已被占用时可以换端口；`--no-watch` 关闭自动构建。
只构建、不启动服务器时，先激活 Emscripten，再执行：

```bash
python3 build.py
```

生成的网页资源和增量构建文件分别位于 `build/web-simulator/` 与
`build/web-simulator-cache/`，位于官方应用项目的 `build/` 下，不写入本项目仓库。

## 4. 操作已接入的页面

在调试面板选择页面，然后点击设备按键或预览旁的大按钮。
屏幕使用 Canvas 显示，当前页面通过按键操作，不通过点击屏幕内容操作。

| 页面 | 操作 | 预期结果 |
| --- | --- | --- |
| 显示测试 | 单击 OK | 依次切换红、绿、蓝、白、黑色 |
| 显示测试 | 单击 UP 或 DOWN | 在 100%、50%、10% 亮度之间切换 |
| 按键测试 | 单击、双击或按住按键 | 屏幕和事件记录显示相应事件 |
| 按键测试 | 启用模拟 ADC 滑块 | 显示注入的电压；禁用则测试读取失败路径 |

键盘 ↑ / ↓ 对应 UP / DOWN，Enter 对应 OK，P 切换模拟电源。
表单控件保留正常的键盘行为。输入适配层一次支持一个按键，产生 BSP 定义的四种事件：

- `PRESS`：按下时立即产生。
- `CLICK`：短按抬起后，等待 250 ms 的双击判定窗口再产生。
- `DOUBLE`：窗口内两次短按抬起，不额外产生 CLICK。
- `LONG`：按住 600 ms 后产生，抬起时不再产生 CLICK。

这些时间阈值是模拟器默认值。窗口失焦、标签页隐藏或指针操作取消时，会清除按住
状态和待发送事件。通过事件记录，可以区分“输入未送达”和“页面不处理该事件”。

重启按钮会重置所选页面。模拟电源关闭后清空屏幕，再开启时重新进入所选页面。
ADC 电压是用于测试的注入值，不是硬件测量结果。

可切换设备视图和仅屏幕视图检查布局。截图为原始尺寸的 240 × 320 PNG，包含模拟
亮度和圆角遮罩；剪贴板不支持或权限被拒绝时自动下载。
无法使用原生全屏时，退回页面内全屏。

## 5. 调试与迭代

服务器运行期间，保存被监测的源码会触发增量构建，成功后浏览器自动刷新。
构建失败时保留上次预览并显示失败状态；查看终端错误，修复后再次保存。
刷新会重置模拟页面的状态。

构建指纹覆盖共享 C 源码及头文件、LVGL 源码、浏览器适配层、网页和外壳素材。
状态区显示当前构建标识，可用于区分预览版本。

调试浏览器代码时，打开开发者工具。`passportSimulator` 提供 `down`、`up`、
`cancel`、`setPaused`、`snapshot` 方法，以及 `ready`、`frames`、`powered`、
`brightness` 只读属性。例如：

```javascript
passportSimulator.down('OK');
passportSimulator.up('OK');
```

该调用与页面按钮使用相同的输入归一化逻辑。

## 6. 接入自己的应用

模拟器默认只接入两个硬件测试页面。新应用需要显式接入自己的页面：

1. 将应用状态、布局和 LVGL 界面与 ESP-IDF 服务分开。
2. 把共享界面源码添加到 `CMakeLists.txt`，同时将源码及相关头文件添加到
   `build.py` 的 `SHARED`，使修改能够触发重新构建。
3. 将 `simulator.c` 的 `enter_page()`、`exit_page()` 和按键路由改为应用自己的
   生命周期及输入处理函数，并同步更新 `web/index.html` 和 `web/app.mjs` 的
   页面选项与说明。
4. 为设备服务提供明确的模拟值或不可用状态，应用行为仍保留在共享 C 代码中。
5. 重新构建，检查页面导航和退出清理，再执行固件验证。

浏览器适配层为单线程，LVGL 锁为空实现；固件仍须遵守正常的 LVGL 锁和任务生命周期
规则。衍生应用必须独立设计界面，现有测试页仅作为接入验证用例。

## 验证与范围

构建模拟器后，使用支持 `node --test` 的 Node.js 执行输入归一化和已编译 WASM
交互测试：

```bash
node --test test_input.mjs test_runtime.mjs
```

固件验证请回到官方应用项目根目录执行 `./tools/validate.sh`。浏览器测试覆盖已接入的界面渲染和处理函数。
模拟器不执行完整 ESP32-C3 固件，不能装载合并 `.bin`。
FreeRTOS 调度、Wi-Fi、蓝牙、音频、ADC、电量、NVS、屏幕色彩、延迟、耗电及设备
RAM 限制仍需真机验证。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| 提示缺少 Emscripten，或找不到 `emcmake` | 执行所选 SDK 的 `source .../emsdk_env.sh`，或通过 `EMSDK` 指定目录 |
| 提示缺少固定版本 LVGL 依赖 | 在已激活的 ESP-IDF 环境中完成项目首次固件构建 |
| 找不到 CMake 或 Ninja | 检查开发环境中的主机工具及当前终端 PATH |
| 地址已被占用 | 使用 `--port 8766`，打开终端打印的新地址 |
| 运行时加载失败 | 通过本地 HTTP 地址访问，不要直接以 `file://` 打开；检查终端和浏览器控制台 |
| 按键看起来没有反应 | 确认运行时已就绪、模拟电源开启；检查事件记录及所选页面支持的操作 |
| 预览仍是旧版本 | 检查终端是否构建失败；使用 `--no-watch` 时，修改后需重新启动 |
