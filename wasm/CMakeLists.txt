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
    _keepers_group_similar_photos
    _keepers_rank_photo_quality
    _keepers_photo_analysis_size
    _keepers_photo_analysis_offset_id
    _keepers_photo_analysis_offset_sharpness
    _keepers_photo_analysis_offset_mean_luminance
    _keepers_photo_analysis_offset_shadow_clipping_ratio
    _keepers_photo_analysis_offset_highlight_clipping_ratio
    _keepers_photo_analysis_offset_contrast
    _keepers_photo_analysis_offset_difference_hash
    _keepers_photo_hash_size
    _keepers_photo_hash_offset_id
    _keepers_photo_hash_offset_hash
    _keepers_similarity_group_size
    _keepers_similarity_group_offset_member_offset
    _keepers_similarity_group_offset_member_count
    _keepers_photo_metrics_size
    _keepers_photo_metrics_offset_id
    _keepers_photo_metrics_offset_sharpness
    _keepers_photo_metrics_offset_mean_luminance
    _keepers_photo_metrics_offset_shadow_clipping_ratio
    _keepers_photo_metrics_offset_highlight_clipping_ratio
    _keepers_photo_metrics_offset_contrast
    _keepers_photo_quality_score_size
    _keepers_photo_quality_score_offset_id
    _keepers_photo_quality_score_offset_normalized_sharpness
    _keepers_photo_quality_score_offset_exposure_score
    _keepers_photo_quality_score_offset_normalized_contrast
    _keepers_photo_quality_score_offset_overall_score
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
