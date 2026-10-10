/* Browser display adapter; application UI comes directly from main/. */
#include <emscripten.h>
#include "lvgl.h"
#ifdef SIM_APPLICATION_CONFIG
#include "app_router.h"
#else
#include "demo.h"
#define SIM_APP_PAGE_COUNT 2
#endif
#include "bsp_display.h"
#include "bsp_display_rounding.h"

static lv_display_t *display;
static lv_obj_t *parking_screen;
static uint16_t pixels[240 * 32];
static int page;
static int powered = 1;
static int adc_mv = -1;

EM_JS(void, browser_flush, (int ptr, int x1, int y1, int x2, int y2), {
    globalThis.passportBridge.flush(HEAPU8, ptr, x1, y1, x2, y2);
});
EM_JS(void, browser_backlight, (int value), {
    globalThis.passportBridge.backlight(value);
});

void bsp_display_backlight(uint8_t percent) { browser_backlight(percent); }
bool bsp_lvgl_lock(int timeout_ms) { (void)timeout_ms; return true; }
void bsp_lvgl_unlock(void) { }
int bsp_button_read_mv(void) { return adc_mv; }

static uint32_t now_ms(void) { return (uint32_t)emscripten_get_now(); }

static void flush(lv_display_t *disp, const lv_area_t *area, uint8_t *buf)
{
    int width = area->x2 - area->x1 + 1;
    uint16_t *rgb = (uint16_t *)buf;
    for (int y = area->y1; y <= area->y2; ++y) {
        int start, end;
        bool visible = bsp_display_rounded_row_span(y, 240, 320,
                        BSP_LVGL_SCREEN_RADIUS, &start, &end);
        for (int x = area->x1; x <= area->x2; ++x) {
            if (!visible || x < start || x > end)
                rgb[(y - area->y1) * width + x - area->x1] = 0;
        }
    }
    browser_flush((int)buf, area->x1, area->y1, area->x2, area->y2);
    lv_display_flush_ready(disp);
}

static void enter_page(void)
{
    #ifdef SIM_APPLICATION_CONFIG
    sim_app_enter(page);
    #else
    if (page == 0) demo_display_enter();
    else demo_button_enter();
    #endif
}

static void exit_page(void)
{
    /* Never delete LVGL's active screen; the parking screen lives until shutdown. */
    lv_screen_load(parking_screen);
    #ifdef SIM_APPLICATION_CONFIG
    sim_app_exit(page);
    #else
    if (page == 0) demo_display_exit();
    else demo_button_exit();
    #endif
}

EMSCRIPTEN_KEEPALIVE void sim_init(void)
{
    lv_init();
    lv_tick_set_cb(now_ms);
    display = lv_display_create(240, 320);
    lv_display_set_color_format(display, LV_COLOR_FORMAT_RGB565);
    lv_display_set_buffers(display, pixels, NULL, sizeof(pixels), LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_display_set_flush_cb(display, flush);
    parking_screen = lv_screen_active();
    lv_obj_set_style_bg_color(parking_screen, lv_color_black(), 0);
    enter_page();
    lv_timer_handler();
}

EMSCRIPTEN_KEEPALIVE void sim_step(void) {
    if (!powered) return;
    #ifdef SIM_APPLICATION_CONFIG
    sim_app_step(page);
    #endif
    lv_timer_handler();
}
EMSCRIPTEN_KEEPALIVE void sim_key(int key, int event)
{
    if (!powered || key < BSP_BTN_UP || key > BSP_BTN_OK ||
        event < BSP_BTN_PRESS || event > BSP_BTN_LONG) return;
    #ifdef SIM_APPLICATION_CONFIG
    sim_app_key(page, (bsp_btn_t)key, (bsp_btn_ev_t)event);
    #else
    if (page == 0) demo_display_key((bsp_btn_t)key, (bsp_btn_ev_t)event);
    else demo_button_key((bsp_btn_t)key, (bsp_btn_ev_t)event);
    #endif
}
EMSCRIPTEN_KEEPALIVE void sim_page(int next)
{
    if (next < 0 || next >= SIM_APP_PAGE_COUNT) return;
    exit_page();
    page = next;
    if (powered) enter_page();
}
EMSCRIPTEN_KEEPALIVE void sim_reset(void)
{
    exit_page();
    powered = 1;
    enter_page();
}
EMSCRIPTEN_KEEPALIVE void sim_power(int on)
{
    if (!!on == powered) return;
    if (powered) exit_page();
    powered = !!on;
    if (powered) enter_page();
}
EMSCRIPTEN_KEEPALIVE void sim_adc(int value) { adc_mv = value; }
