cmake_minimum_required(VERSION 3.16)
project(passport_web_simulator C)
if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Build with emcmake and Emscripten")
endif()
get_filename_component(REPO_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)
set(LVGL_ROOT "${REPO_ROOT}/managed_components/lvgl__lvgl")
file(GLOB_RECURSE LVGL_SOURCES CONFIGURE_DEPENDS "${LVGL_ROOT}/src/*.c")
add_library(sim_lvgl STATIC ${LVGL_SOURCES})
target_include_directories(sim_lvgl PUBLIC "${LVGL_ROOT}" "${CMAKE_CURRENT_SOURCE_DIR}")
target_compile_definitions(sim_lvgl PUBLIC LV_CONF_INCLUDE_SIMPLE)
add_executable(runtime simulator.c
    "${REPO_ROOT}/main/ui_pixel.c"
    "${REPO_ROOT}/main/demo_display.c"
    "${REPO_ROOT}/main/demo_button.c"
    "${REPO_ROOT}/components/bsp/src/bsp_display_rounding.c")
target_include_directories(runtime PRIVATE stubs "${REPO_ROOT}/main"
    "${REPO_ROOT}/components/bsp/include" "${REPO_ROOT}/components/bsp/src")
target_link_libraries(runtime sim_lvgl)
set_target_properties(runtime PROPERTIES SUFFIX ".js")
target_link_options(runtime PRIVATE
    "--no-entry" "-sMODULARIZE=1" "-sEXPORT_NAME=createPassportRuntime"
    "-sENVIRONMENT=web" "-sALLOW_MEMORY_GROWTH=1" "-sINITIAL_MEMORY=16777216"
    "-sEXPORTED_FUNCTIONS=['_sim_init','_sim_step','_sim_key','_sim_page','_sim_reset','_sim_power','_sim_adc']"
    "-sFILESYSTEM=0")
