
export const CONFIG = {
    VERSION: '2.4.8',
    // 基础物理参数 (对应 1080p 参考高度)
    REFERENCE_HEIGHT: 1080,

    BASE_RUN_SPEED: 11.2,
    BASE_GRAVITY: 0.82,
    BASE_JUMP_FORCE_INITIAL: -14.8,
    BASE_JUMP_FORCE_HOLD: 0.92,
    JUMP_HOLD_MAX_TIME: 22,
    MAX_JUMPS: 2,

    // 实时计算后的物理参数
    RUN_SPEED: 11.2,
    GRAVITY: 0.82,
    JUMP_FORCE_INITIAL: -14.8,
    JUMP_FORCE_HOLD: 0.92,

    COLORS: {
        PLAYER: '#f97316',
        PLATFORM: '#334155',
        GEM: '#22d3ee',
        SHIFT_RED: '#ef4444',
        SHIFT_BLUE: '#3b82f6'
    },

    // 自动生成参数 (基础值，会根据 globalScale 缩放)
    BASE_MAX_PLATFORM_GAP: 520,
    BASE_MAX_PLATFORM_STEP: 240,
    BASE_MIN_PLATFORM_WIDTH: 400,

    // 缩放后的实时参数
    MAX_PLATFORM_GAP: 520,
    MAX_PLATFORM_STEP: 240,
    MIN_PLATFORM_WIDTH: 400,

    // 动态限制
    WORLD_HEIGHT_LIMIT_UP: -600,
    WORLD_HEIGHT_LIMIT_DOWN: 500,
    LAVA_WORLD_Y: 1400,
    GROUND_Y: 600,

    GLOBAL_SCALE: 1.0
};
