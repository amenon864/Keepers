include(FetchContent)

set(CATCH_BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(CATCH_INSTALL_DOCS OFF CACHE BOOL "" FORCE)
set(CATCH_INSTALL_EXTRAS OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.8.1
)

FetchContent_MakeAvailable(Catch2)

list(APPEND CMAKE_MODULE_PATH "${catch2_SOURCE_DIR}/extras")
include(Catch)

add_executable(burstpick_engine_tests
    grayscale_test.cpp
    image_view_test.cpp
    version_test.cpp
)

target_link_libraries(burstpick_engine_tests
    PRIVATE
        burstpick_engine
        Catch2::Catch2WithMain
)

target_compile_features(burstpick_engine_tests
    PRIVATE
        cxx_std_20
)

set_target_properties(burstpick_engine_tests PROPERTIES
    CXX_EXTENSIONS OFF
)

burstpick_enable_project_warnings(burstpick_engine_tests)

catch_discover_tests(burstpick_engine_tests)
