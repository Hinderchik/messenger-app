cmake_minimum_required(VERSION 3.20)
project(Messenger)

set(CMAKE_CXX_STANDARD 17)

# Скачиваем websocketpp
include(FetchContent)
FetchContent_Declare(
    websocketpp
    URL https://github.com/zaphoyd/websocketpp/archive/refs/tags/0.8.2.tar.gz
)
FetchContent_MakeAvailable(websocketpp)

add_executable(messenger WIN32 src/main.cpp)

target_include_directories(messenger PRIVATE ${websocketpp_SOURCE_DIR})

target_link_libraries(messenger
    ws2_32
    crypt32
    user32
    gdi32
    comctl32
)

set_target_properties(messenger PROPERTIES WIN32_EXECUTABLE TRUE)