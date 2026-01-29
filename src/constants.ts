// MIT license: https://d20.zip/license.txt

export const MAX_DICE = 256;

export const COLLISION_GROUPS = {
    DICE: 1,
    GROUND: 2,
    WALLS: 4,
};

export const TRAY = {
    WALL_COUNT: 8,
    WALL_LIMIT: 10,
    FLOOR_THICKNESS: 0.1,
    WALL_HEIGHT: 2.0,
    WALL_THICKNESS: 0.2,
    PHYSICS_FLOOR_THICKNESS: 5.0,
    PHYSICS_WALL_THICKNESS: 10.0,
    PHYSICS_WALL_HEIGHT: 150.0,
};

export const SCENE = {
    BACKGROUND_COLOR: 0x222222,
    CAMERA: {
        FOV: 50,
        NEAR: 0.1,
        FAR: 100,
        INITIAL_POS: { x: 0, y: 25, z: 15 },
    },
    LIGHTS: {
        AMBIENT: { color: 0xf2ebd8, intensity: 0.55 },
        DIRECTIONAL: {
            color: 0xf0ebdd,
            intensity: 1.8,
            position: { x: 10, y: 20, z: 10 },
            SHADOW: {
                CAMERA: {
                    LEFT: -15,
                    RIGHT: 15,
                    TOP: 15,
                    BOTTOM: -15,
                    NEAR: 1,
                    FAR: 50,
                },
                MAP_SIZE: 4096,
                RADIUS: 5,
                BIAS: -0.0001,
            },
        },
        FILL: {
            color: 0x446688,
            intensity: 0.5,
            position: { x: -10, y: 10, z: -10 },
        },
    },
    ENVIRONMENT: {
        TOP_COLOR: 0x333333,
        BOTTOM_COLOR: 0x111111,
        OFFSET: 33,
        EXPONENT: 0.6,
        POINT_LIGHT_COUNT: 12,
        POINT_LIGHT_COLOR: 0xffffff,
        POINT_LIGHT_INTENSITY: 20,
    },
    FLOOR_COLOR: 0x3c69a0,
    WALL_COLOR: 0x444444,
};

export const DICE = {
    DAMPING: 0.75,
    RESTITUTION: 0.4,
    FRICTION: 0.3,
    DENSITY: 1.0,
    SLEEP_THRESHOLD: 0.00001,
    SPAWN: {
        HEIGHT_BASE: 8.0,
        HEIGHT_VAR: 4.0,
        JITTER: 4.0,
        DISTANCE_MULTIPLIER: 1.4,
    },
    THROW: {
        SPEED_BASE: 25,
        SPEED_VAR: 10,
        UPWARD_BASE: 2,
        UPWARD_VAR: 6,
    },
    FLIP: {
        SPEED_BASE: 15,
        SPEED_VAR: 10,
        SIDE_WOBBLE: 20,
        DEFAULT_ANGVEL: 40,
    },
    TEXTURE: {
        RES: 2048,
        GRID_SIZE: 10,
        GRID_HEIGHT: 15,
        BG_COLOR: '#eeeeee',
        TEXT_COLOR: '#4c4c4c',
    },
    SAFE_ENTRY_DISTANCE_OFFSET: 0.4,
    SPAWN_DELAY_BASE: 10,
    SPAWN_DELAY_VAR: 10,
};

export const MATERIALS = {
    DICE: {
        ROUGHNESS: 0.75,
        METALNESS: 0.6,
        BUMP_SCALE: 0.1,
        TRANSMISSION: 0.4,
        THICKNESS: 2,
        CLEARCOAT: 1.0,
        CLEARCOAT_ROUGHNESS: 2.0,
        NORMAL_SCALE: 0.8,
        CLEARCOAT_NORMAL_SCALE: 0.2,
    },
    FLOOR: {
        BUMP_SCALE: 2.0,
        ROUGHNESS: 2.0,
        METALNESS: 0.0,
    },
    WALL: {
        ROUGHNESS: 0.5,
    },
};

export const UI = {
    ERROR_MESSAGE_TIMEOUT: 2000,
    MAX_HISTORY: 20,
};

export const STATE_SAVE_INTERVAL = 1000;

export const GEOMETRY = {
    D4_RADIUS: 0.8,
    CUBE_RADIUS: 0.8,
    D8_RADIUS: 0.8,
    D10_RADIUS: 0.8,
    D12_RADIUS: 0.8,
    D20_RADIUS: 0.9,
};

export const SOUND = {
    ENABLED: true,
    DEFAULT_VOLUME: 0.5,
    MIN_INTERVAL: 0.01, // Minimum time between sounds in seconds
    MIN_VELOCITY: 1.0, // Minimum collision velocity to trigger sound
    DICE_DICE: {
        BASE_VOLUME: 0.7,
        BASE_FREQ: 800,
        DECAY: 0.06,
        MATERIAL: 'glass', // glass or stone
    },
    DICE_FLOOR: {
        BASE_VOLUME: 0.35,
        BASE_FREQ: 150,
        DECAY: 0.12,
        MATERIAL: 'felt',
    },
    DICE_WALL: {
        BASE_VOLUME: 0.3,
        BASE_FREQ: 140,
        DECAY: 0.1,
        MATERIAL: 'felt',
    },
};
