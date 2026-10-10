**简体中文** · [English](INTEGRATION.md)

# 自动接入当前应用

启动器现在会检测应用根目录的 web-simulator.json，自动配置编译源码、头文件路径、宏、页面路由、资源复制及变更监测。通常不必修改通用 CMakeLists.txt、build.py 或 simulator.c。

这不是自动把任意 ESP-IDF 固件变成网页：共享 UI 必须有可在浏览器调用的生命周期和按键接口；硬件服务需要浏览器实现。首次由开发者或 AI 为应用写好配置和适配，之后启动及日常预览自动完成。

## 启动方式

按 [Windows 说明](README.zh_CN.md#windows) 激活 Emscripten、CMake 和 Ninja，从通用模拟器目录执行：

```bat
python run.py --project "F:\path\your-app" --port 8766
```

替换为应用工程的实际绝对路径。一个通用模拟器即可服务不同应用，不必给每个应用复制整个模拟器。

省略 --project 时，工程根目录仍是当前 tools/web-simulator 的上两级。两种情况都自动读取该工程的 web-simulator.json。不存在配置时运行默认显示/按键测试页；不会猜测任意 app_main 的职责。

只编译、不启动：

```bat
python build.py --project "F:\path\your-app"
```

目标工程必须有 main、components/bsp 和固定版本的 managed_components/lvgl__lvgl。托管依赖通常由首次固件构建准备。输出在目标工程 build/web-simulator；外部工程的编译缓存单独存放，避免与已有应用模拟器缓存混用。

## 最小配置

在应用工程根目录创建 web-simulator.json。下列名称是接口示例，换成实际文件和函数：

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

只保留实际存在且需要的文件、目录和宏；没有音乐时删除对应 assets 项。没有应用配置时删除 watch 中的 app-config.json。此示例不是会自动创建 app_ui.c 的模板。

| 字段 | 规则 |
| --- | --- |
| version | 当前为 1 |
| sources | 必填非空列表，工程相对路径或 glob；每个模式必须匹配 C/C++ 源文件 |
| include_dirs | 可选，已存在的工程相对头文件目录 |
| defines | 可选，简单宏名或 NAME=value |
| pages | 必填非空列表；按数组顺序自动编号，并写入页面菜单 |
| pages.title / help | 页面标题及操作说明；help 可省略 |
| pages.enter / exit / key | 必填，实际 C 函数名 |
| pages.step | 可选，每次浏览器刷新时调用的有界更新函数 |
| watch | 可选，额外的工程相对文件/glob；用于配置、资源或生成脚本变化检测 |
| assets | 可选，source 为已存在的工程相对文件/目录，target 为网页输出相对位置 |

路径不能越出工程根目录。源码及 include_dirs 中的头文件自动监测；资源目录递归复制并监测。新的 glob 匹配会在下一次检查时识别。watch 监测文件并不执行资源生成脚本；图片或配置改变后仍须按应用流程重新生成字体/图片 C 数组。

资源 URL 相对输出目录，例如 music/track.mp3。不使用本机盘符或 file://。runtime.js、runtime.wasm、build-info.json 的直接覆盖目标被禁止。只复制预览资源，不放入密钥、设备信息或固件归档。

## 首次需要实现的接口

推荐共享 UI 提供以下 C 接口；配置中的名字可以不同：

```c
#include "bsp_button.h"
void app_ui_enter(void);
void app_ui_exit(void);
void app_ui_step(void);
void app_ui_key(bsp_btn_t key, bsp_btn_ev_t event);
```

enter 创建并加载页面；exit 停止回调/定时器并删除页面；step 完成一次有界更新；key 接收标准 PRESS/CLICK/DOUBLE/LONG。通用适配器在退出前加载 parking_screen，避免删除活动屏幕。

浏览器是单线程，不能直接执行带无限循环的 app_main，不能阻塞等候设备任务、网络或音频。可以拆出共享 UI 和服务接口，也可以用条件编译隔离设备入口。C++ 实现这些入口时须使用 extern "C" 保持链接名一致。

设备服务与浏览器服务不能同时链接。保留固件 LVGL 锁、输入队列、worker 生命周期和错误处理；浏览器空锁不会证明设备并发安全。

## 字体、图片和浏览器服务

生成的 LVGL 字体/图片 C 文件加入 sources，可使用 glob。中文仍须确认字形覆盖、控件字体和实际渲染。固件 EMBED_FILES 链接符号不会自动生成到 WASM，应提供浏览器资源实现。

| 服务 | 浏览器实现 | 真机仍需确认 |
| --- | --- | --- |
| 音频 | HTMLAudioElement/Web Audio 或明确未支持；同步真实进度、暂停及结束事件 | 解码、I2S、音质、任务时序 |
| 电量、ADC | 明确注入值或不可用状态 | 测量和校准 |
| 存储 | 内存或显式设计的 localStorage，并注明刷新行为 | NVS 和持久化 |
| Wi-Fi、BLE | 模拟状态或不可用 | 连接、配网、断线恢复 |
| 亮度 | 通用 browser_backlight 模拟 Canvas 亮度 | 实际背光和功耗 |

浏览器音频通常需要用户操作；处理 play() 拒绝和加载失败。兼容头只提供所需类型和声明，不能把所有错误伪装成成功。

有自定义浏览器音频桥接时，可以通过 assets 把应用的 JS 复制到输出。例如 source 为 main/web/app.mjs、target 为 app.mjs，可替换通用脚本；替换文件必须保留通用 DOM、WASM 和输入接口约定。也可将整个自定义网页目录复制到 target "."。保留 build-info.json 中 pages 的菜单/说明读取逻辑，避免网页和 C 页面编号不一致。

默认 Canvas 不提供 LVGL 触摸输入。注册 LV_EVENT_CLICKED 不会让屏幕设置按钮支持鼠标点击；用按键测试，或另行实现浏览器指针到 LVGL 输入设备的适配。

## 自动检测的范围

启动时检测配置；运行时检测配置、已登记源码、头文件和资源变化，触发增量构建，成功后自动刷新。新增或修改配置不需重启启动器，前提是项目和依赖仍有效。--project 指定的目标在该次服务运行期间固定；切换工程需停止后重新启动。

未配置的设备服务不会自动被替换；配置不负责推断函数、生成应用 UI、执行资源生成脚本或加载固件 .bin。构建失败会保留上次预览并显示错误，不能把旧预览当作新构建成功。

## 验证和排错

配置解析检查和通用默认页面的 WASM 交互检查：

```bat
python -m unittest test_application.py
node --test test_input.mjs test_runtime.mjs
```

test_runtime.mjs 默认断言显示/按键测试页。对自定义应用，用应用自己的 WASM 检查和服务 mock 验证路由，不把默认测试断言套在新页面上。实际浏览器音频仍需交互确认。

检查首次页面、中文/图片、CLICK/LONG、退出、连续重启、电源循环、暂停恢复、切歌/循环及资源加载失败。确认修改后构建标识改变。

| 问题 | 检查 |
| --- | --- |
| 仍显示测试页 | --project 是否正确，根目录是否存在配置，浏览器端口是否正确 |
| 配置报错 | version、路径、glob 匹配及页面函数名 |
| undefined reference | sources 是否包含真实服务实现，函数签名/资源符号是否一致 |
| 缺少 ESP-IDF 头文件 | 隔离设备实现，加入最小浏览器兼容接口目录 |
| 修改未刷新 | 文件是否在 sources/include_dirs/watch/assets，监测是否关闭 |
| 图片未更新 | 是否重新运行应用资源生成脚本 |
| 媒体 404 | assets 的输出目标及网页 URL |
| UI 卡住 | 浏览器路径的无限循环或阻塞等待 |

分别报告 Web 构建、运行时检查、浏览器交互、固件构建和真机测试。浏览器不能验证 ESP32-C3 RAM、硬件音频、NVS、面板色彩或功耗。
