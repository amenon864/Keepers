add_library(burstpick_engine STATIC
    src/grayscale.cpp
    src/image_view.cpp
    src/sharpness.cpp
    src/version.cpp
)

target_include_directories(burstpick_engine
    PUBLIC
        "${CMAKE_CURRENT_SOURCE_DIR}/include"
)

target_compile_features(burstpick_engine
    PUBLIC
        cxx_std_20
)

set_target_properties(burstpick_engine PROPERTIES
    CXX_EXTENSIONS OFF
)

function(burstpick_enable_project_warnings target_name)
    target_compile_options(${target_name}
        PRIVATE
            $<$<CXX_COMPILER_ID:MSVC>:/W4>
            $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic>
    )
endfunction()

burstpick_enable_project_warnings(burstpick_engine)

if(BUILD_TESTING)
    add_subdirectory(tests)
endif()
