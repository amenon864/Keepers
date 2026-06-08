export interface KeepersModuleOptions {
    locateFile?(path: string): string;
    [key: string]: unknown;
}

export interface KeepersWasmModule {
    HEAPU8: Uint8Array;

    _keepers_api_version(): number;

    _keepers_allocate(size: number): number;
    _keepers_deallocate(pointer: number): void;

    _keepers_analyze_photo(
        id: number,
        pixels: number,
        pixelBufferSize: number,
        width: number,
        height: number,
        channels: number,
        output: number
    ): number;

    _keepers_group_similar_photos(
        photos: number,
        photoCount: number,
        maximumDistance: number,
        groups: number,
        groupCapacity: number,
        groupCount: number,
        members: number,
        memberCapacity: number,
        memberCount: number
    ): number;

    _keepers_rank_photo_quality(
        photos: number,
        photoCount: number,
        output: number,
        outputCapacity: number,
        outputCount: number
    ): number;

    _keepers_photo_analysis_size(): number;
    _keepers_photo_analysis_offset_id(): number;
    _keepers_photo_analysis_offset_sharpness(): number;
    _keepers_photo_analysis_offset_mean_luminance(): number;
    _keepers_photo_analysis_offset_shadow_clipping_ratio(): number;
    _keepers_photo_analysis_offset_highlight_clipping_ratio(): number;
    _keepers_photo_analysis_offset_contrast(): number;
    _keepers_photo_analysis_offset_difference_hash(): number;

    _keepers_photo_hash_size(): number;
    _keepers_photo_hash_offset_id(): number;
    _keepers_photo_hash_offset_hash(): number;

    _keepers_similarity_group_size(): number;
    _keepers_similarity_group_offset_member_offset(): number;
    _keepers_similarity_group_offset_member_count(): number;

    _keepers_photo_metrics_size(): number;
    _keepers_photo_metrics_offset_id(): number;
    _keepers_photo_metrics_offset_sharpness(): number;
    _keepers_photo_metrics_offset_mean_luminance(): number;
    _keepers_photo_metrics_offset_shadow_clipping_ratio(): number;
    _keepers_photo_metrics_offset_highlight_clipping_ratio(): number;
    _keepers_photo_metrics_offset_contrast(): number;

    _keepers_photo_quality_score_size(): number;
    _keepers_photo_quality_score_offset_id(): number;
    _keepers_photo_quality_score_offset_normalized_sharpness(): number;
    _keepers_photo_quality_score_offset_exposure_score(): number;
    _keepers_photo_quality_score_offset_normalized_contrast(): number;
    _keepers_photo_quality_score_offset_overall_score(): number;
}

export type CreateKeepersModule = (
    options?: KeepersModuleOptions
) => Promise<KeepersWasmModule>;

declare const createKeepersModule: CreateKeepersModule;

export default createKeepersModule;
