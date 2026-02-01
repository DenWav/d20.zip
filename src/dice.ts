// MIT license: https://d20.zip/license.txt
// https://github.com/DenWav/d20.zip

import { COLLISION_GROUPS, DICE, GEOMETRY, MATERIALS, MAX_DICE, TRAY } from './constants.js';
import { RAPIER, THREE } from './vendor.js';
import { getD4, getCube, getD8, getD10, getD12, getD20 } from './geometry.js';
import { mulberry32 } from './util.js';
import { World } from './world.js';

export function createDiceTexture() {
    const canvas = document.createElement('canvas');
    // 2048 is plenty for sharp numbers and saves memory
    canvas.width = DICE.TEXTURE.RES;
    canvas.height = canvas.width * 1.5; // 10 x 15 grid
    const ctx = canvas.getContext('2d')!;

    // Base color
    ctx.fillStyle = DICE.TEXTURE.BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = DICE.TEXTURE.GRID_SIZE;
    const cellSize = canvas.width / gridSize;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = DICE.TEXTURE.TEXT_COLOR;
    ctx.strokeStyle = DICE.TEXTURE.TEXT_COLOR;
    ctx.lineCap = 'round';

    const drawUnderline = (x: number, y: number, text: string) => {
        const textWidth = ctx.measureText(text).width;
        const underlineY = y + cellSize * 0.22;
        ctx.beginPath();
        ctx.lineWidth = cellSize * 0.03;
        ctx.moveTo(x - textWidth / 2, underlineY);
        ctx.lineTo(x + textWidth / 2, underlineY);
        ctx.stroke();
    };

    // Base font size (scaled for 2048 resolution)
    ctx.font = 'bold 80px Arial';
    // 1-8 without underlines for 6 (for D6, D8)
    for (let i = 0; i < 8; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = Math.floor(i / gridSize) * cellSize + cellSize / 2;
        const text = (i + 1).toString();
        ctx.fillText(text, x, y);
    }

    // 1-20 with underlines for 6 and 9 (for D10, D12, D20)
    for (let i = 0; i < 20; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = (1 + Math.floor(i / gridSize)) * cellSize + cellSize / 2;
        const text = (i + 1).toString();
        ctx.fillText(text, x, y);
        if (text === '6' || text === '9') {
            drawUnderline(x, y, text);
        }
    }

    // 0-9 with underlines for 6 and 9 for D10
    for (let i = 0; i < 10; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = (3 + Math.floor(i / gridSize)) * cellSize + cellSize / 2;
        const text = i.toString();
        ctx.fillText(text, x, y);
        if (text === '6' || text === '9') {
            drawUnderline(x, y, text);
        }
    }

    // 00-90 for D100 tens
    ctx.font = 'bold 85px Arial';
    for (let i = 0; i < 10; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = (4 + Math.floor(i / gridSize)) * cellSize + cellSize / 2;
        ctx.fillText((i * 10).toString().padStart(2, '0'), x, y);
    }

    // D4 faces
    ctx.font = 'bold 35px Arial';
    const vPos = [
        { x: 0.5, y: 0.2304 },
        { x: 0.2, y: 0.75 },
        { x: 0.8, y: 0.75 },
    ];
    const vCenter = { x: 0.5, y: 0.6 };

    function writeD4Numbers(faces: number[][], row: number) {
        for (let i = 0; i < 4; i++) {
            const xBase = i * cellSize;
            const yBase = row * cellSize;
            const nums = faces[i];

            nums.forEach((num, j) => {
                const v = vPos[j];
                const dx = v.x - vCenter.x;
                const dy = v.y - vCenter.y;

                // Move 50% from vertex towards center for legibility
                const pX = vCenter.x + dx * 0.5;
                const pY = vCenter.y + dy * 0.5;

                // Rotate so "up" points towards vertex
                const angle = Math.atan2(dy, dx) + Math.PI / 2;

                ctx.save();
                ctx.translate(xBase + pX * cellSize, yBase + pY * cellSize);
                ctx.rotate(angle);
                ctx.fillText(num.toString(), 0, 0);
                ctx.restore();
            });
        }
    }

    const d4Faces = [
        [2, 4, 3],
        [1, 3, 4],
        [1, 4, 2],
        [1, 2, 3],
    ];
    writeD4Numbers(d4Faces, 5);

    // D2 is a D4 with different numbers
    const d2Faces = [
        [1, 2, 2],
        [1, 2, 2],
        [1, 2, 1],
        [1, 1, 2],
    ];
    writeD4Numbers(d2Faces, 6);

    return new THREE.CanvasTexture(canvas);
}

export function createFeltTexture() {
    const rng = mulberry32(54321);
    const canvas = document.createElement('canvas');
    const size = 2048;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Slightly darker base to allow light fibers to show up
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawSeamless = (x: number, y: number, radius: number, drawFn: (ox: number, oy: number) => void) => {
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                const dx = ox * size;
                const dy = oy * size;
                // Only draw if the element could potentially be visible on the canvas at this offset
                if (x + dx + radius > 0 && x + dx - radius < size && y + dy + radius > 0 && y + dy - radius < size) {
                    drawFn(dx, dy);
                }
            }
        }
    };

    // Add fiber noise
    for (let i = 0; i < 40000; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const len = rng() * 8 + 2;
        const angle = rng() * Math.PI * 2;
        const opacity = rng() * 0.5;
        const colorBase = rng() > 0.5 ? '255,255,255' : '0,0,0';
        const color = `rgba(${colorBase},${opacity})`;
        const lineWidth = rng() * 0.8 + 0.5;

        const dx = Math.cos(angle) * len;
        const dy = Math.sin(angle) * len;

        drawSeamless(x, y, len, (ox, oy) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(x + ox, y + oy);
            ctx.lineTo(x + ox + dx, y + oy + dy);
            ctx.stroke();
        });
    }

    // Add more noticeable organic splotches
    for (let i = 0; i < 400; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const radius = rng() * 100 + 5;
        const opacity = rng() * 0.025;
        const colorRGB = rng() > 0.5 ? '255,255,255' : '0,0,0';
        const colorStop = `rgba(${colorRGB},${opacity})`;
        const colorStopTransparent = `rgba(${colorRGB},0)`;

        drawSeamless(x, y, radius, (ox, oy) => {
            // Use small start radius (0.001) instead of 0 for Safari compatibility
            const grd = ctx.createRadialGradient(x + ox, y + oy, 0.001, x + ox, y + oy, radius);
            grd.addColorStop(0, colorStop);
            grd.addColorStop(1, colorStopTransparent);
            ctx.fillStyle = grd;
            // Use arc and fill instead of fillRect for better radial gradient rendering in some browsers
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 16;
    // Repeat for finer detail
    texture.repeat.set(2, 2); // Reduced from 4 to make it less obviously tiling
    return texture;
}

// --- UV Mapping and Face Detection ---
interface FaceInfo {
    normal: THREE.Vector3;
    value: number;
}

// prettier-ignore
const D8_MAPPINGS: Readonly<{ [key: number]: number }> = Object.freeze({
    1: 1,   5: 4,
    2: 3,   6: 2,
    3: 7,   7: 6,
    4: 5,   8: 8,
});

// prettier-ignore
const D10_MAPPINGS: Readonly<{ [key: number]: number }> = Object.freeze({
    0: 0,   5: 7,
    1: 4,   6: 3,
    2: 8,   7: 1,
    3: 6,   8: 5,
    4: 2,   9: 9,
});

// prettier-ignore
const D12_MAPPINGS: Readonly<{ [key: number]: number }> = Object.freeze({
    1: 1,   7: 11,
    2: 6,   8: 10,
    3: 5,   9: 9,
    4: 4,   10: 8,
    5: 3,   11: 7,
    6: 2,   12: 12,
});

// prettier-ignore
const D20_MAPPINGS: Readonly<{ [key: number]: number }> = Object.freeze({
    1: 1,   11: 6,
    2: 19,  12: 16,
    3: 13,  13: 4,
    4: 7,   14: 10,
    5: 9,   15: 18,
    6: 3,   16: 12,
    7: 11,  17: 14,
    8: 17,  18: 8,
    9: 5,   19: 2,
    10: 7,  20: 1,
});

// prettier-ignore
const D100_MAPPINGS: Readonly<{ [key: number]: number }> = Object.freeze({
    0: 0,   50: 50,
    10: 20, 60: 70,
    20: 60, 70: 10,
    30: 80, 80: 30,
    40: 40, 90: 90,
});

function applyDiceUVs(geometry: THREE.BufferGeometry, type: DiceType, isTens = false): FaceInfo[] {
    const pos = geometry.getAttribute('position');
    const uvs = new Float32Array(pos.count * 2);
    const faces: FaceInfo[] = [];

    const gridSize = DICE.TEXTURE.GRID_SIZE;
    const gridHeight = DICE.TEXTURE.GRID_HEIGHT;

    // Group triangles by normal
    const uniqueNormals: THREE.Vector3[] = [];
    const normalGroups: number[][] = [];

    for (let i = 0; i < pos.count; i += 3) {
        const v1 = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        const v2 = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
        const v3 = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

        const normal = new THREE.Vector3().crossVectors(v2.clone().sub(v1), v3.clone().sub(v1)).normalize();

        let foundIndex = -1;
        for (let j = 0; j < uniqueNormals.length; j++) {
            // Use dot product to group nearly-coplanar triangles (important for D10)
            if (uniqueNormals[j].dot(normal) > 0.99) {
                foundIndex = j;
                break;
            }
        }

        if (foundIndex === -1) {
            foundIndex = uniqueNormals.length;
            uniqueNormals.push(normal);
            normalGroups.push([]);
        }
        normalGroups[foundIndex].push(i);
    }

    // Sort to have consistent mapping (highest Y first)
    const sortedIndices = uniqueNormals
        .map((_, i) => i)
        .sort((i, j) => {
            const a = uniqueNormals[i];
            const b = uniqueNormals[j];
            // Sort by Y, then Z, then X with small epsilon
            const eps = 0.01;
            if (Math.abs(b.y - a.y) > eps) return b.y - a.y;
            if (Math.abs(b.z - a.z) > eps) return b.z - a.z;
            return b.x - a.x;
        });

    if (type === DiceType.D2 || type === DiceType.D4) {
        const d4FaceSets = [
            [2, 4, 3],
            [1, 3, 4],
            [1, 4, 2],
            [1, 2, 3],
        ];

        const uniqueVertices: THREE.Vector3[] = [];
        for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            let found = false;
            for (const uv of uniqueVertices) {
                if (uv.distanceTo(v) < 0.01) {
                    found = true;
                    break;
                }
            }
            if (!found) uniqueVertices.push(v);
        }
        uniqueVertices.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 0.01) return a.y - b.y;
            if (Math.abs(a.z - b.z) > 0.01) return a.z - b.z;
            return a.x - b.x;
        });

        sortedIndices.forEach((normalIndex) => {
            const normal = uniqueNormals[normalIndex];
            const triangleIndices = normalGroups[normalIndex];
            const i0 = triangleIndices[0];

            const bVals: number[] = [];
            for (let j = 0; j < 3; j++) {
                const v = new THREE.Vector3(pos.getX(i0 + j), pos.getY(i0 + j), pos.getZ(i0 + j));
                for (let k = 0; k < 4; k++) {
                    if (v.distanceTo(uniqueVertices[k]) < 0.01) {
                        bVals.push(k + 1);
                        break;
                    }
                }
            }

            let atlasCol = -1;
            let shift = 0;
            for (let col = 0; col < 4; col++) {
                const atlasVals = d4FaceSets[col];
                for (let s = 0; s < 3; s++) {
                    if (
                        atlasVals[0] === bVals[s] &&
                        atlasVals[1] === bVals[(s + 1) % 3] &&
                        atlasVals[2] === bVals[(s + 2) % 3]
                    ) {
                        atlasCol = col;
                        shift = s;
                        break;
                    }
                }
                if (atlasCol !== -1) break;
            }

            function toValue(type: DiceType.D2 | DiceType.D4, v: number): number {
                if (type === DiceType.D2) {
                    return v < 2 ? 1 : 2;
                } else {
                    return v + 1;
                }
            }

            faces.push({ normal, value: toValue(type, atlasCol) });

            const uMin = atlasCol / gridSize;
            const uMax = (atlasCol + 1) / gridSize;
            const vMin = 1 - ((type === DiceType.D4 ? 5 : 6) + 1) / gridHeight;
            const vMax = 1 - (type === DiceType.D4 ? 5 : 6) / gridHeight;

            const positions = [
                { x: 0.5, y: 0.2304 },
                { x: 0.2, y: 0.75 },
                { x: 0.8, y: 0.75 },
            ];

            for (const i of triangleIndices) {
                for (let j = 0; j < 3; j++) {
                    const p = positions[(j - shift + 3) % 3];
                    uvs[(i + j) * 2] = uMin + p.x * (uMax - uMin);
                    uvs[(i + j) * 2 + 1] = vMin + (1 - p.y) * (vMax - vMin);
                }
            }
        });
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        return faces;
    }

    let baseRow: number;
    let valueMultiplier = 1;
    let valueOffset = 1;

    if (type === DiceType.D6 || type === DiceType.D8) {
        baseRow = 0;
    } else if (type === DiceType.D12 || type === DiceType.D20) {
        baseRow = 1;
    } else if (type === DiceType.D10 || type === DiceType.D100) {
        if (isTens) {
            baseRow = 4;
            valueMultiplier = 10;
            valueOffset = 0;
        } else {
            baseRow = 3;
            valueMultiplier = 1;
            valueOffset = 0;
        }
    }

    sortedIndices.forEach((normalIndex, index) => {
        const normal = uniqueNormals[normalIndex];
        let value = index * valueMultiplier + valueOffset;
        switch (type) {
            case DiceType.D6:
                break;
            case DiceType.D8:
                value = D8_MAPPINGS[value] ?? value;
                break;
            case DiceType.D10:
                value = D10_MAPPINGS[value] ?? value;
                break;
            case DiceType.D12:
                value = D12_MAPPINGS[value] ?? value;
                break;
            case DiceType.D20:
                value = D20_MAPPINGS[value] ?? value;
                break;
            case DiceType.D100:
                value = D100_MAPPINGS[value] ?? value;
                break;
        }
        faces.push({ normal, value });
        // Find the new index based on our updated value
        index = (value - valueOffset) / valueMultiplier;

        const triangleIndices = normalGroups[normalIndex];

        // Calculate face center
        const center = new THREE.Vector3();
        for (const i of triangleIndices) {
            for (let j = 0; j < 3; j++) {
                center.add(new THREE.Vector3(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)));
            }
        }
        center.divideScalar(triangleIndices.length * 3);

        const col = index % gridSize;
        const row = baseRow + Math.floor(index / gridSize);

        const uMin = col / gridSize;
        const uMax = (col + 1) / gridSize;
        const vMin = 1 - (row + 1) / gridHeight;
        const vMax = 1 - row / gridHeight;

        // Consistent local coordinate system for the face
        let up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(normal.dot(up)) > 0.9) {
            up.set(0, 0, 1);
        }
        let tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
        if (type === DiceType.D8 && value % 2 === 0) {
            // For D8, the even numbers need to be flipped around to line up with the equator
            tangent.multiplyScalar(-1);
        }
        let bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        if (type === DiceType.D20) {
            // For D20, snap the bitangent to the nearest vertex to ensure alignment with triangular sides
            let maxDot = -Infinity;
            let bestV = new THREE.Vector3();
            for (const i of triangleIndices) {
                for (let j = 0; j < 3; j++) {
                    const v = new THREE.Vector3(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
                    const toV = v.clone().sub(center).normalize();
                    const dot = toV.dot(bitangent);
                    if (dot > maxDot) {
                        maxDot = dot;
                        bestV = toV;
                    }
                }
            }
            bitangent.copy(bestV);
            tangent.crossVectors(bitangent, normal).normalize();
            bitangent.crossVectors(normal, tangent).normalize();
        }

        // Find bounding box in local 2D space to scale properly
        let minU = Infinity,
            maxU = -Infinity,
            minV = Infinity,
            maxV = -Infinity;
        for (const i of triangleIndices) {
            for (let j = 0; j < 3; j++) {
                const v = new THREE.Vector3(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)).sub(center);
                const uu = v.dot(tangent);
                const vv = v.dot(bitangent);
                minU = Math.min(minU, uu);
                maxU = Math.max(maxU, uu);
                minV = Math.min(minV, vv);
                maxV = Math.max(maxV, vv);
            }
        }

        const width = maxU - minU;
        const height = maxV - minV;
        const maxExtent = Math.max(width, height, 0.1);
        let margin = 1.0;
        if (type === DiceType.D6) margin = 0.7; // Make D6 numbers larger
        const scale = margin / maxExtent;

        for (const i of triangleIndices) {
            for (let j = 0; j < 3; j++) {
                const vertex = new THREE.Vector3(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j)).sub(center);

                const u = vertex.dot(tangent);
                const v = vertex.dot(bitangent);

                // Scale and center in UV cell
                const cellU = u * scale + 0.5;
                const cellV = v * scale + 0.5;

                uvs[(i + j) * 2] = uMin + cellU * (uMax - uMin);
                uvs[(i + j) * 2 + 1] = vMin + cellV * (vMax - vMin);
            }
        }
    });

    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return faces;
}

export interface Dice {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    mesh: THREE.Mesh;
    type: DiceType;
    faces: FaceInfo[];
    currentValue: number | null;
    isSettled: boolean;
    awakeSince: Date | null;
    hasEnteredTray: boolean;
    rollId: number;
    groupIndex: number;
    logicalIndex: number;
    isTens?: boolean;
    color: THREE.Color;
}

export enum DiceType {
    D2 = 'd2',
    D4 = 'd4',
    D6 = 'd6',
    D8 = 'd8',
    D10 = 'd10',
    D12 = 'd12',
    D20 = 'd20',
    D100 = 'd100',
}
export const DiceTypes: readonly DiceType[] = Object.values(DiceType);

export function getDiceTypeFromSides(sides: number): DiceType | null {
    switch (sides) {
        case 2:
            return DiceType.D2;
        case 4:
            return DiceType.D4;
        case 6:
            return DiceType.D6;
        case 8:
            return DiceType.D8;
        case 10:
            return DiceType.D10;
        case 12:
            return DiceType.D12;
        case 20:
            return DiceType.D20;
        case 100:
            return DiceType.D100;
        default:
            return null;
    }
}

interface CachedDiceAsset {
    geometry: THREE.BufferGeometry;
    shape: RAPIER.ColliderDesc;
    faces: FaceInfo[];
}

const diceAssetCache = new Map<string, CachedDiceAsset>();
function getDiceAsset(type: DiceType, isTens: boolean): CachedDiceAsset {
    const cacheKey = `${type}${isTens ? '-tens' : ''}`;
    if (diceAssetCache.has(cacheKey)) {
        return diceAssetCache.get(cacheKey)!;
    }

    let geometry: THREE.BufferGeometry;
    switch (type) {
        case DiceType.D2:
        case DiceType.D4:
            geometry = getD4();
            break;
        case DiceType.D6:
            geometry = getCube();
            break;
        case DiceType.D8:
            geometry = getD8();
            break;
        case DiceType.D10:
        case DiceType.D100:
            geometry = getD10();
            break;
        case DiceType.D12:
            geometry = getD12();
            break;
        case DiceType.D20:
            geometry = getD20();
            break;
        default:
            geometry = getCube();
    }

    const faces = applyDiceUVs(geometry, type, isTens);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    let shape: RAPIER.ColliderDesc;
    if (type === DiceType.D6) {
        shape = RAPIER.ColliderDesc.cuboid(
            GEOMETRY.CUBE_RADIUS / 2,
            GEOMETRY.CUBE_RADIUS / 2,
            GEOMETRY.CUBE_RADIUS / 2
        );
    } else {
        shape = createConvexPolyhedron(geometry);
    }

    const asset = { geometry, shape, faces };
    diceAssetCache.set(cacheKey, asset);
    return asset;
}

function createConvexPolyhedron(geometry: THREE.BufferGeometry) {
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const vertices = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        vertices[i * 3] = position.getX(i);
        vertices[i * 3 + 1] = position.getY(i);
        vertices[i * 3 + 2] = position.getZ(i);
    }
    return RAPIER.ColliderDesc.convexHull(vertices) as RAPIER.ColliderDesc;
}

function createDiceMaterial(): THREE.MeshPhysicalMaterial {
    const textureLoader = new THREE.TextureLoader();
    const diceTexture = createDiceTexture();
    const normalMapTexture = textureLoader.load('assets/normal.jpg');
    normalMapTexture.wrapS = THREE.RepeatWrapping;
    normalMapTexture.wrapT = THREE.RepeatWrapping;
    normalMapTexture.repeat.set(3, 3);

    return new THREE.MeshPhysicalMaterial({
        roughness: MATERIALS.DICE.ROUGHNESS,
        metalness: MATERIALS.DICE.METALNESS,
        map: diceTexture,
        bumpMap: normalMapTexture,
        bumpScale: MATERIALS.DICE.BUMP_SCALE,
        roughnessMap: diceTexture,
        transmission: MATERIALS.DICE.TRANSMISSION,
        thickness: MATERIALS.DICE.THICKNESS,
        normalScale: new THREE.Vector2(MATERIALS.DICE.NORMAL_SCALE),
        normalMap: normalMapTexture,
        clearcoatNormalMap: normalMapTexture,
        clearcoat: MATERIALS.DICE.CLEARCOAT,
        clearcoatRoughness: MATERIALS.DICE.CLEARCOAT_ROUGHNESS,
        clearcoatNormalScale: new THREE.Vector2(MATERIALS.DICE.CLEARCOAT_NORMAL_SCALE),
    });
}

export class DiceInstanceManager {
    private instances: Map<string, THREE.InstancedMesh> = new Map();
    private frustum = new THREE.Frustum();
    private projScreenMatrix = new THREE.Matrix4();
    private capacity = MAX_DICE;

    constructor(
        private scene: THREE.Scene,
        private camera: THREE.Camera,
        private dice: DiceBag,
        private material: THREE.Material
    ) {}

    getInstancedMesh(type: DiceType, isTens: boolean): THREE.InstancedMesh {
        const key = `${type}${isTens ? '-tens' : ''}`;
        if (this.instances.has(key)) return this.instances.get(key)!;

        const asset = getDiceAsset(type, isTens);
        const imesh = new THREE.InstancedMesh(asset.geometry, this.material, this.capacity);
        imesh.castShadow = true;
        imesh.receiveShadow = true;
        imesh.frustumCulled = false;
        imesh.count = 0; // Start with 0
        this.scene.add(imesh);
        this.instances.set(key, imesh);
        return imesh;
    }

    update() {
        this.camera.updateMatrixWorld();
        this.projScreenMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert()
        );
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        const counts = new Map<string, number>();
        this.instances.forEach((_, key) => counts.set(key, 0));

        for (const dice of this.dice.diceList) {
            const key = `${dice.type}${dice.isTens ? '-tens' : ''}`;
            const imesh = this.getInstancedMesh(dice.type, !!dice.isTens);
            const index = counts.get(key) || 0;

            if (index >= this.capacity) {
                continue;
            }

            dice.mesh.position.copy(dice.body.translation() as any);
            dice.mesh.quaternion.copy(dice.body.rotation() as any);
            dice.mesh.updateMatrixWorld();

            if (this.frustum.intersectsObject(dice.mesh)) {
                imesh.setMatrixAt(index, dice.mesh.matrixWorld);
                imesh.setColorAt(index, dice.color);
                counts.set(key, index + 1);
            }
        }

        this.instances.forEach((imesh, key) => {
            imesh.count = counts.get(key) || 0;
            imesh.instanceMatrix.needsUpdate = true;
            if (imesh.instanceColor) imesh.instanceColor.needsUpdate = true;
        });
    }

    reset() {
        this.instances.forEach((imesh) => {
            imesh.count = 0;
        });
    }
}

export interface RollGroup {
    type: DiceType;
    count: number;
    keepType?: 'kh' | 'kl' | 'ka';
    keepCount?: number;
}

export interface GroupResult {
    value: number;
    kept: boolean;
}

export interface RollRecord {
    id: number;
    formula: string;
    template: string;
    result: number | null;
    groups: RollGroup[];
    groupResults: (GroupResult | number)[][]; // Store actual values for each group
    breakdown: string | null;
}

export class DiceBag {
    public nextRollId: number = 0;
    public canceledRollId: number | null = null;

    private _diceList: Dice[] = [];
    public readonly rollHistory: RollRecord[] = [];

    private readonly activeRolls: RollRecord[] = [];
    private readonly _activeRollIds: Set<number> = new Set();

    private readonly diceMaterial = createDiceMaterial();
    public readonly instanceManager: DiceInstanceManager;

    public constructor(private readonly world: World) {
        this.instanceManager = new DiceInstanceManager(
            world.renderer.scene,
            world.renderer.camera,
            this,
            this.diceMaterial
        );
    }

    public get diceList(): Dice[] {
        return this._diceList;
    }

    public filterActiveRolls() {
        this._diceList = this.diceList.filter((die) => {
            if (this.isActiveRoll(die.rollId)) {
                return true;
            }
            this.removeDice(die);
            return false;
        });
    }

    public createDice(
        type: DiceType,
        rollId: number,
        isTens = false,
        groupIndex = 0,
        logicalIndex = 0,
        indexInRoll = 0,
        totalInRoll = 1,
        initialState?: any
    ) {
        // Double check that we should spawn this dice
        if (this.canceledRollId && rollId <= this.canceledRollId) {
            return;
        }
        if (!this._activeRollIds.has(rollId)) {
            return;
        }

        const asset = getDiceAsset(type, isTens);
        const geometry = asset.geometry;
        const shape = asset.shape;
        const faces = asset.faces;

        const diceColor = initialState?.color
            ? new THREE.Color(initialState.color)
            : new THREE.Color().setHSL(Math.random(), 0.4, 0.5);

        // Use shared material for the dummy mesh (used for frustum culling and transforms)
        const mesh = new THREE.Mesh(geometry, this.diceMaterial);
        // Note: mesh is not added to scene, we use InstancedMesh for rendering

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setLinearDamping(DICE.DAMPING)
            .setAngularDamping(DICE.DAMPING)
            .setCanSleep(true)
            .setCcdEnabled(true);

        const body = this.world.physics.rapierWorld.createRigidBody(bodyDesc);
        const colliderDesc = (shape as RAPIER.ColliderDesc)
            .setDensity(DICE.DENSITY)
            .setFriction(DICE.FRICTION)
            .setRestitution(DICE.RESTITUTION)
            .setCollisionGroups(COLLISION_GROUPS.DICE | ((COLLISION_GROUPS.DICE | COLLISION_GROUPS.GROUND) << 16))
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        const collider = this.world.physics.rapierWorld.createCollider(colliderDesc, body);

        let hasEnteredTray: boolean;
        if (initialState) {
            body.setTranslation(initialState.position, true);
            body.setRotation(initialState.quaternion, true);
            body.setLinvel(initialState.velocity, true);
            body.setAngvel(initialState.angularVelocity, true);

            mesh.position.copy(initialState.position);
            mesh.quaternion.copy(initialState.quaternion);

            if (initialState.isSettled) {
                body.sleep();
            }

            hasEnteredTray = initialState.hasEnteredTray;
        } else {
            // Scale spread from 0.3 (for 2 dice) to 2*PI (at 20 dice)
            const minSpread = 0.3;
            const spread =
                totalInRoll > 1
                    ? minSpread + Math.max(0, Math.min(1, (totalInRoll - 2) / 18)) * (Math.PI * 2 - minSpread)
                    : 0;

            // Throw from an angle relative to camera (only horizontal angle)
            let finalAngle = this.world.renderer.controls.getAzimuthalAngle();

            if (totalInRoll > 1) {
                // Center the spread on azAngle
                const offset = (indexInRoll / (totalInRoll - 1) - 0.5) * spread;
                finalAngle += offset;
            }

            const spawnDistance = TRAY.WALL_LIMIT * DICE.SPAWN.DISTANCE_MULTIPLIER;
            const spawnPos = new THREE.Vector3(
                Math.sin(finalAngle) * spawnDistance,
                DICE.SPAWN.HEIGHT_BASE + Math.random() * DICE.SPAWN.HEIGHT_VAR,
                Math.cos(finalAngle) * spawnDistance
            );

            // Add some random jitter to spawn position
            spawnPos.x += (Math.random() - 0.5) * DICE.SPAWN.JITTER;
            spawnPos.z += (Math.random() - 0.5) * DICE.SPAWN.JITTER;

            body.setTranslation(spawnPos, true);
            mesh.position.copy(spawnPos);

            const axis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
            const rotAngle = Math.random() * Math.PI * 2;
            let quat = new THREE.Quaternion().setFromAxisAngle(axis, rotAngle);

            body.setRotation(quat, true);
            mesh.quaternion.copy(quat);

            // Velocity: towards the center area (with enough variation to prevent piling)
            // Use a centered target area to ensure dice hit the tray, with more spread for larger rolls.
            const targetRange = TRAY.WALL_LIMIT * (totalInRoll > 1 ? 1.0 : 0.5);
            const throwTarget = new THREE.Vector3(
                (Math.random() - 0.5) * targetRange,
                0,
                (Math.random() - 0.5) * targetRange
            );

            // Calculate horizontal direction only
            const horizontalDir = new THREE.Vector3().subVectors(throwTarget, spawnPos);
            horizontalDir.y = 0;
            horizontalDir.normalize();

            // Add some random variation to the throw angle (reduced to prevent missing the tray)
            const angleVar = (Math.random() - 0.5) * 0.2; // +/- 0.1 radians
            horizontalDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleVar);

            const speed = DICE.THROW.SPEED_BASE + Math.random() * DICE.THROW.SPEED_VAR;
            const velVec = horizontalDir.clone().multiplyScalar(speed);

            body.setLinvel(velVec, true);

            function increaseMagnitude(v: number, increase: number) {
                return v + Math.sign(v) * increase;
            }
            // Ensure significant initial rotation (tumbling)
            const angVel = {
                x: increaseMagnitude((Math.random() - 0.5) * DICE.FLIP.MULT_ANGVEL, DICE.FLIP.BASE_ANGVEL),
                y: increaseMagnitude((Math.random() - 0.5) * DICE.FLIP.MULT_ANGVEL, DICE.FLIP.BASE_ANGVEL),
                z: increaseMagnitude((Math.random() - 0.5) * DICE.FLIP.MULT_ANGVEL, DICE.FLIP.BASE_ANGVEL),
            };
            body.setAngvel(angVel, true);

            const distSq = spawnPos.x * spawnPos.x + spawnPos.z * spawnPos.z;
            // Turn on wall collisions only if spawned safely inside (away from walls)
            hasEnteredTray =
                distSq <
                (TRAY.WALL_LIMIT - DICE.SAFE_ENTRY_DISTANCE_OFFSET) *
                    (TRAY.WALL_LIMIT - DICE.SAFE_ENTRY_DISTANCE_OFFSET);
        }

        if (hasEnteredTray) {
            collider.setCollisionGroups(
                COLLISION_GROUPS.DICE |
                    ((COLLISION_GROUPS.DICE | COLLISION_GROUPS.GROUND | COLLISION_GROUPS.WALLS) << 16)
            );
        }

        let awakeSince: Date | null = null;
        if (initialState?.awakeSince) {
            try {
                if (new Date().getTime() - new Date(initialState.awakeSince).getTime() < 100) {
                    awakeSince = initialState.awakeSince;
                } else {
                    awakeSince = new Date();
                }
            } catch (_) {}
        }

        this.diceList.push({
            body,
            collider,
            mesh,
            type,
            faces,
            currentValue: initialState ? initialState.currentValue : null,
            isSettled: initialState ? initialState.isSettled : false,
            awakeSince,
            hasEnteredTray,
            rollId,
            groupIndex,
            logicalIndex,
            isTens,
            color: diceColor,
        });
    }

    public pruneDiceList() {
        const historyIds = new Set(this.rollHistory.map((r) => r.id));
        for (let i = this.diceList.length - 1; i >= 0; i--) {
            const dice = this.diceList[i];
            if (!historyIds.has(dice.rollId)) {
                this.removeDice(dice);
                this.diceList.splice(i, 1);
            }
        }
        this.instanceManager.update();
    }

    public addActiveRoll(roll: RollRecord) {
        this.activeRolls.push(roll);
        this._activeRollIds.add(roll.id);
    }

    public popLastActiveRoll(): RollRecord | null {
        const roll = this.activeRolls.shift() ?? null;
        if (roll) {
            this._activeRollIds.delete(roll.id);
        }
        return roll;
    }

    public clearActiveRolls() {
        this.activeRolls.length = 0;
        this._activeRollIds.clear();
    }

    public get activeRollIds(): number[] {
        return this.activeRolls.map((r) => r.id);
    }

    public isActiveRoll(rollId: number): boolean {
        return this._activeRollIds.has(rollId);
    }

    public removeDice(dice: Dice) {
        this.world.physics.rapierWorld.removeRigidBody(dice.body);
    }

    public get totalDiceCount(): number {
        let sum = 0;
        for (const roll of this.activeRolls) {
            for (const group of roll.groups) {
                sum += group.count;
            }
        }
        return sum;
    }
}
