add_executable(keepers_wasm
    src/wasm_api.cpp
)

set(keepers_wasm_output_directory "${CMAKE_BINARY_DIR}/wasm")

target_include_directories(keepers_wasm
    PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}/include"
)

target_link_libraries(keepers_wasm
    PRIVATE
        keepers_engine
)

target_compile_features(keepers_wasm
    PRIVATE
        cxx_std_20
)

set_target_properties(keepers_wasm PROPERTIES
    CXX_EXTENSIONS OFF
    OUTPUT_NAME keepers
    RUNTIME_OUTPUT_DIRECTORY "${keepers_wasm_output_directory}"
    SUFFIX ".mjs"
)

target_compile_options(keepers_wasm
    PRIVATE
        $<$<CXX_COMPILER_ID:GNU,Clang,AppleClang>:-Wall;-Wextra;-Wpedantic>
)

set(keepers_wasm_exported_functions
    _keepers_api_version
    _keepers_allocate
    _keepers_deallocate
    _keepers_analyze_photo
    _keepers_photo_analysis_size
    _keepers_photo_analysis_offset_id
    _keepers_photo_analysis_offset_sharpness
    _keepers_photo_analysis_offset_mean_luminance
    _keepers_photo_analysis_offset_shadow_clipping_ratio
    _keepers_photo_analysis_offset_highlight_clipping_ratio
    _keepers_photo_analysis_offset_contrast
    _keepers_photo_analysis_offset_difference_hash
)
list(JOIN keepers_wasm_exported_functions "','" keepers_wasm_exports)

target_link_options(keepers_wasm
    PRIVATE
        "--no-entry"
        "-sMODULARIZE=1"
        "-sEXPORT_ES6=1"
        "-sEXPORT_NAME=KeepersModule"
        "-sALLOW_MEMORY_GROWTH=1"
        "-sENVIRONMENT=web,worker,node"
        "-sFILESYSTEM=0"
        "-sWASM_BIGINT=1"
        "-sEXPORTED_RUNTIME_METHODS=['HEAPU8']"
        "-sEXPORTED_FUNCTIONS=['${keepers_wasm_exports}']"
)
