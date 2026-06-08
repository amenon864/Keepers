add_library(keepers_engine STATIC
    src/difference_hash.cpp
    src/grayscale.cpp
    src/image_metrics.cpp
    src/image_view.cpp
    src/sharpness.cpp
    src/version.cpp
)

target_include_directories(keepers_engine
    PUBLIC
        "${CMAKE_CURRENT_SOURCE_DIR}/include"
)

target_compile_features(keepers_engine
    PUBLIC
        cxx_std_20
)

set_target_properties(keepers_engine PROPERTIES
    CXX_EXTENSIONS OFF
)

function(keepers_enable_project_warnings target_name)
    target_compile_options(${target_name}
        PRIVATE
            $<$<CXX_COMPILER_ID:MSVC>:/W4>
            $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic>
    )
endfunction()

keepers_enable_project_warnings(keepers_engine)

if(BUILD_TESTING)
    add_subdirectory(tests)
endif()
