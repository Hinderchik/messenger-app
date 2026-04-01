cmake_minimum_required(VERSION 3.20)
project(Messenger)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(WIN32)
    add_definitions(-D_WIN32_WINNT=0x0601)
endif()

find_package(websocketpp CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(cpprestsdk CONFIG REQUIRED)

add_executable(messenger WIN32 src/main.cpp)

target_link_libraries(messenger
    websocketpp::websocketpp
    nlohmann_json::nlohmann_json
    cpprestsdk::cpprest
    ws2_32
    crypt32
    comctl32
    gdi32
    user32
)

target_include_directories(messenger PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
set_target_properties(messenger PROPERTIES WIN32_EXECUTABLE TRUE)