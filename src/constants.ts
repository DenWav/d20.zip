// https://d20.zip - Simple 3D dice roller
// https://github.com/DenWav/d20.zip
// Copyright (C) 2026  Kyle Wood (DenWav)
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3 of the License only.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

export const MAX_DICE = 256;

export const COLLISION_GROUPS = Object.freeze({
    DICE: 1,
    GROUND: 2,
    WALLS: 4,
});

export const TRAY = Object.freeze({
    WALL_COUNT: 8,
    WALL_LIMIT: 10,
    FLOOR_THICKNESS: 0.1,
    WALL_HEIGHT: 2.0,
    WALL_THICKNESS: 0.2,
    PHYSICS_FLOOR_THICKNESS: 5.0,
    PHYSICS_WALL_THICKNESS: 10.0,
    PHYSICS_WALL_HEIGHT: 150.0,
});

export const SCENE = Object.freeze({
    BACKGROUND_COLOR: 0x222222,
    CAMERA: Object.freeze({
        FOV: 50,
        NEAR: 0.1,
        FAR: 2000,
        INITIAL_POS: Object.freeze({ X: 0, Y: 25, Z: 15 }),
    }),
    LIGHTS: Object.freeze({
        AMBIENT: Object.freeze({ COLOR: 0xf2ebd8, INTENSITY: 0.55 }),
        DIRECTIONAL: Object.freeze({
            COLOR: 0xf0ebdd,
            INTENSITY: 1.8,
            POS: Object.freeze({ X: 10, Y: 20, Z: 10 }),
            SHADOW: Object.freeze({
                CAMERA: Object.freeze({
                    LEFT: -15,
                    RIGHT: 15,
                    TOP: 15,
                    BOTTOM: -15,
                    NEAR: 1,
                    FAR: 50,
                }),
                MAP_SIZE: 4096,
                RADIUS: 5,
                BIAS: -0.0001,
            }),
        }),
        FILL: Object.freeze({
            COLOR: 0x446688,
            INTENSITY: 0.5,
            POSITION: Object.freeze({ X: -10, Y: 10, Z: -10 }),
        }),
    }),
    ENVIRONMENT: Object.freeze({
        TOP_COLOR: 0x333333,
        BOTTOM_COLOR: 0x111111,
        OFFSET: 33,
        EXPONENT: 0.6,
        POINT_LIGHT_COUNT: 12,
        POINT_LIGHT_COLOR: 0xffffff,
        POINT_LIGHT_INTENSITY: 20,
    }),
    FLOOR_COLOR: 0x3c69a0,
    WALL_COLOR: 0x444444,
});

export const DICE = Object.freeze({
    DAMPING: 0.75,
    RESTITUTION: 0.65,
    FRICTION: 0.3,
    DENSITY: 1.0,
    SLEEP_THRESHOLD: 0.00001,
    SPAWN: Object.freeze({
        HEIGHT_BASE: 8.0,
        HEIGHT_VAR: 4.0,
        JITTER: 4.0,
        DISTANCE_MULTIPLIER: 1.4,
    }),
    THROW: Object.freeze({
        SPEED_BASE: 25,
        SPEED_VAR: 10,
        UPWARD_BASE: 2,
        UPWARD_VAR: 6,
    }),
    FLIP: Object.freeze({
        BASE_ANGVEL: 10,
        MULT_ANGVEL: 20,
    }),
    TEXTURE: Object.freeze({
        RES: 2048,
        GRID_SIZE: 10,
        GRID_HEIGHT: 15,
        BG_COLOR: '#eeeeee',
        TEXT_COLOR: '#4c4c4c',
    }),
    SAFE_ENTRY_DISTANCE_OFFSET: 0.4,
    SPAWN_DELAY_BASE: 10,
    SPAWN_DELAY_VAR: 10,
});

export const MATERIALS = Object.freeze({
    DICE: Object.freeze({
        ROUGHNESS: 0.75,
        METALNESS: 0.6,
        BUMP_SCALE: 0.1,
        TRANSMISSION: 0.4,
        THICKNESS: 2,
        CLEARCOAT: 1.0,
        CLEARCOAT_ROUGHNESS: 2.0,
        NORMAL_SCALE: 0.8,
        CLEARCOAT_NORMAL_SCALE: 0.2,
    }),
    FLOOR: Object.freeze({
        BUMP_SCALE: 2.0,
        ROUGHNESS: 2.0,
        METALNESS: 0.0,
    }),
    WALL: Object.freeze({
        ROUGHNESS: 0.5,
    }),
});

export const UI = Object.freeze({
    ERROR_MESSAGE_TIMEOUT: 2000,
    MAX_HISTORY: 256,
});

export const STATE_SAVE_INTERVAL = 1000;

export const GEOMETRY = Object.freeze({
    D4_RADIUS: 0.8,
    CUBE_RADIUS: 0.8,
    D8_RADIUS: 0.8,
    D10_RADIUS: 0.8,
    D12_RADIUS: 0.8,
    D20_RADIUS: 0.9,
});

export interface DiceSoundConstant {
    BASE_VOLUME: number;
    BASE_FREQ: number;
    DECAY: number;
    MATERIAL: string;
}

export const SOUND = Object.freeze({
    ENABLED: true,
    DEFAULT_VOLUME: 0.5,
    MIN_INTERVAL: 0.01, // Minimum time between sounds in seconds
    MIN_VELOCITY: 1.0, // Minimum collision velocity to trigger sound
    DICE_DICE: Object.freeze({
        BASE_VOLUME: 0.6,
        BASE_FREQ: 800,
        DECAY: 0.06,
        MATERIAL: 'glass', // glass or stone
    }),
    DICE_FLOOR: Object.freeze({
        BASE_VOLUME: 0.25,
        BASE_FREQ: 150,
        DECAY: 0.12,
        MATERIAL: 'felt',
    }),
    DICE_WALL: Object.freeze({
        BASE_VOLUME: 0.2,
        BASE_FREQ: 140,
        DECAY: 0.1,
        MATERIAL: 'felt',
    }),
});
