// MIT license: https://d20.zip/license.txt

import { THREE, CANNON, OrbitControls, Stats } from './vendor.js';
import { World } from './physics.js';
import { getD2, getD4, getCube, getD8, getD10, getD12, getD20 } from './geometry.js';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 25, 15);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = null;

controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

controls.enableDamping = true;
controls.screenSpacePanning = false;

// Lights
const ambientLight = new THREE.AmbientLight(0xf2ebd8, 0.55);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xf0ebdd, 1.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -15;
directionalLight.shadow.camera.right = 15;
directionalLight.shadow.camera.top = 15;
directionalLight.shadow.camera.bottom = -15;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.radius = 5;
directionalLight.shadow.bias = -0.0001;
scene.add(directionalLight);

// Secondary light for more depth
const fillLight = new THREE.DirectionalLight(0x446688, 0.5);
fillLight.position.set(-10, 10, -10);
scene.add(fillLight);

// --- Seeded Random for Deterministic Assets ---
function mulberry32(a: number) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Environment setup
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Create a simple procedural environment map (gradient)
function createEnvironmentMap() {
    const rng = mulberry32(98765);
    const scene = new THREE.Scene();
    const geom = new THREE.SphereGeometry(1, 64, 32);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            topColor: { value: new THREE.Color(0x333333) },
            bottomColor: { value: new THREE.Color(0x111111) },
            offset: { value: 33 },
            exponent: { value: 0.6 },
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vWorldPosition;
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
    });
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    // Add some random bright points to the env map for highlights
    for (let i = 0; i < 12; i++) {
        const light = new THREE.PointLight(0xffffff, 20);
        light.position.set((rng() - 0.5) * 2, rng() * 2, (rng() - 0.5) * 2);
        scene.add(light);
    }

    const renderTarget = pmremGenerator.fromScene(scene);
    return renderTarget.texture;
}

scene.environment = createEnvironmentMap();
scene.environment.mapping = THREE.EquirectangularReflectionMapping;

// Physics World
const world = new World();

// --- Dice Number Texture ---
function createDiceTexture() {
    const canvas = document.createElement('canvas');
    // 2048 is plenty for sharp numbers and saves memory
    canvas.width = 2048;
    canvas.height = canvas.width * 1.5; // 10 x 15 grid
    const ctx = canvas.getContext('2d')!;

    // Base color
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = 10;
    const cellSize = canvas.width / gridSize;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Base font size (scaled for 2048 resolution)
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#4c4c4c';
    ctx.strokeStyle = '#4c4c4c';
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

    // 1-20 (standard, no underlines - for D6, D8 etc.)
    for (let i = 0; i < 20; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = Math.floor(i / gridSize) * cellSize + cellSize / 2;
        ctx.fillText((i + 1).toString(), x, y);
    }

    // 1-20 with underlines for 6 and 9 (for D12, D20)
    for (let i = 0; i < 20; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = (2 + Math.floor(i / gridSize)) * cellSize + cellSize / 2;
        const text = (i + 1).toString();
        ctx.fillText(text, x, y);
        if (text === '6' || text === '9') {
            drawUnderline(x, y, text);
        }
    }

    // 00-90 for D100 tens
    ctx.font = 'bold 85px Arial';
    for (let i = 0; i < 10; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = (10 + Math.floor(i / gridSize)) * cellSize + cellSize / 2;
        ctx.fillText((i * 10).toString().padStart(2, '0'), x, y);
    }

    // 0-9 for D10 (with underlines for 6 and 9)
    ctx.font = 'bold 80px Arial';
    for (let i = 0; i < 10; i++) {
        const x = (i % gridSize) * cellSize + cellSize / 2;
        const y = (11 + Math.floor(i / gridSize)) * cellSize + cellSize / 2;
        const text = i.toString();
        ctx.fillText(text, x, y);
        if (text === '6' || text === '9') {
            drawUnderline(x, y, text);
        }
    }

    // D4 special cells in row 12
    ctx.font = 'bold 35px Arial';
    const d4Faces = [
        [2, 4, 3],
        [1, 3, 4],
        [1, 4, 2],
        [1, 2, 3],
    ];
    const vPos = [
        { x: 0.5, y: 0.2304 },
        { x: 0.2, y: 0.75 },
        { x: 0.8, y: 0.75 },
    ];
    const vCenter = { x: 0.5, y: 0.6 };

    for (let i = 0; i < 4; i++) {
        const xBase = i * cellSize;
        const yBase = 12 * cellSize;
        const nums = d4Faces[i];

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

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
}

function createFeltTexture() {
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

const textureLoader = new THREE.TextureLoader();
const diceTexture = createDiceTexture();
const feltTexture = createFeltTexture();
const normalMapTexture = textureLoader.load('normal.jpg');
normalMapTexture.wrapS = THREE.RepeatWrapping;
normalMapTexture.wrapT = THREE.RepeatWrapping;
normalMapTexture.repeat.set(3, 3);

const diceMaterial = new THREE.MeshPhysicalMaterial({
    roughness: 0.75,
    metalness: 0.6,
    map: diceTexture,
    bumpMap: normalMapTexture,
    bumpScale: 0.1,
    roughnessMap: diceTexture,
    transmission: 0.4,
    thickness: 2,
    normalScale: new THREE.Vector2(0.8),
    normalMap: normalMapTexture,
    clearcoatNormalMap: normalMapTexture,
    clearcoat: 1,
    clearcoatRoughness: 2,
    clearcoatNormalScale: new THREE.Vector2(0.2),
});

// --- UV Mapping and Face Detection ---
interface FaceInfo {
    normal: THREE.Vector3;
    value: number;
}

function applyDiceUVs(geometry: THREE.BufferGeometry, type: DiceType, isTens = false): FaceInfo[] {
    const pos = geometry.getAttribute('position');
    const uvs = new Float32Array(pos.count * 2);
    const faces: FaceInfo[] = [];

    const gridSize = 10;
    const gridHeight = 15;

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

    let baseRow = 0;
    let valueMultiplier = 1;
    let valueOffset = 1;

    if (type === 'd10' || type === 'd100') {
        if (isTens) {
            baseRow = 10;
            valueMultiplier = 10;
            valueOffset = 0;
        } else {
            baseRow = 11;
            valueMultiplier = 1;
            valueOffset = 0;
        }
    } else if (type === 'd12' || type === 'd20') {
        baseRow = 2;
    }

    if (type === 'd2') {
        sortedIndices.forEach((normalIndex) => {
            const normal = uniqueNormals[normalIndex];
            const triangleIndices = normalGroups[normalIndex];

            let value = 0;
            if (normal.y > 0.9) value = 1;
            else if (normal.y < -0.9) value = 2;

            if (value > 0) {
                faces.push({ normal, value });
                const col = (value - 1) % gridSize;
                const row = Math.floor((value - 1) / gridSize);
                const uMin = col / gridSize;
                const uMax = (col + 1) / gridSize;
                const vMin = 1 - (row + 1) / gridHeight;
                const vMax = 1 - row / gridHeight;

                // Better orientation: Top face sees +X as right, -Z as up
                // Bottom face sees -X as right, -Z as up
                const isTop = normal.y > 0;
                const t = new THREE.Vector3(isTop ? 1 : -1, 0, 0);
                const bt = new THREE.Vector3(0, 0, -1);
                const scale = 0.55; // Slightly larger numbers for D2

                for (const i of triangleIndices) {
                    for (let j = 0; j < 3; j++) {
                        const v = new THREE.Vector3(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
                        const uu = v.dot(t) * scale + 0.5;
                        // Lower the text slightly by shifting the mapping up
                        const vv = v.dot(bt) * scale + 0.5 + 0.025;
                        uvs[(i + j) * 2] = uMin + uu * (uMax - uMin);
                        uvs[(i + j) * 2 + 1] = vMin + vv * (vMax - vMin);
                    }
                }
            }
        });
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        return faces;
    }

    if (type === 'd4') {
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

            faces.push({ normal, value: atlasCol + 1 });

            const uMin = atlasCol / gridSize;
            const uMax = (atlasCol + 1) / gridSize;
            const vMin = 1 - (12 + 1) / gridHeight;
            const vMax = 1 - 12 / gridHeight;

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

    sortedIndices.forEach((normalIndex, index) => {
        const normal = uniqueNormals[normalIndex];
        const value = index * valueMultiplier + valueOffset;
        faces.push({ normal, value });

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
        if (Math.abs(normal.dot(up)) > 0.9) up.set(0, 0, 1);
        let tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
        let bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

        if (type === 'd20') {
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
        if (type === 'd6') margin = 0.7; // Make D6 numbers larger
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

// Collision groups
const COLLISION_GROUP_DICE = 1;
const COLLISION_GROUP_GROUND = 2;
const COLLISION_GROUP_WALLS = 4;

// Floor & Walls Configuration
const wallCount = 8;
const wallLimit = 10;
const floorThickness = 0.1;
const wallHeight = 2.0;
const wallThickness = 0.2;
const floorRadius = wallLimit / Math.cos(Math.PI / wallCount);

// Floor for visual reference
const floorMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(floorRadius, floorRadius, floorThickness, wallCount),
    new THREE.MeshStandardMaterial({
        color: 0x3c69a0, // Adjusted blue to compensate for texture base
        map: feltTexture,
        bumpMap: feltTexture,
        bumpScale: 2,
        roughness: 2,
        roughnessMap: feltTexture,
        metalness: 0.0,
    })
);
floorMesh.position.y = -floorThickness / 2;
floorMesh.rotation.y = Math.PI / wallCount;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// Floor Physics
const floorBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: world.floorMaterial,
    collisionFilterGroup: COLLISION_GROUP_GROUND,
    collisionFilterMask: COLLISION_GROUP_DICE,
});
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(floorBody);

// Visual Walls & Physics Walls
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 });
const wallSideLength = 2 * floorRadius * Math.sin(Math.PI / wallCount);

const wallInLen = 2 * (wallLimit - wallThickness / 2) * Math.tan(Math.PI / wallCount);
const wallOutLen = 2 * (wallLimit + wallThickness / 2) * Math.tan(Math.PI / wallCount);
const wallShape = new THREE.Shape();
wallShape.moveTo(-wallInLen / 2, -wallThickness / 2);
wallShape.lineTo(wallInLen / 2, -wallThickness / 2);
wallShape.lineTo(wallOutLen / 2, wallThickness / 2);
wallShape.lineTo(-wallOutLen / 2, wallThickness / 2);
wallShape.closePath();
const wallGeom = new THREE.ExtrudeGeometry(wallShape, {
    depth: wallHeight + 0.01,
    bevelEnabled: false,
});
wallGeom.rotateX(Math.PI / 2);
wallGeom.center();

const wallInstancedMesh = new THREE.InstancedMesh(wallGeom, wallMaterial, wallCount);
wallInstancedMesh.castShadow = true;
wallInstancedMesh.receiveShadow = true;
wallInstancedMesh.frustumCulled = false;
scene.add(wallInstancedMesh);

const physicsWallThickness = 2.0;
const physicsWallHeight = 150.0; // Much taller physics walls to prevent escape

for (let i = 0; i < wallCount; i++) {
    const angle = (i * 2 * Math.PI) / wallCount;
    const x = Math.cos(angle) * wallLimit;
    const z = Math.sin(angle) * wallLimit;

    // Visual wall instance
    const dummy = new THREE.Object3D();
    // Shifted down and slightly taller to avoid Z-fighting with floor bottom while keeping top level
    dummy.position.set(x, (wallHeight + 0.01) / 2 - floorThickness - 0.01, z);
    dummy.rotation.y = Math.PI / 2 - angle;
    dummy.updateMatrix();
    wallInstancedMesh.setMatrixAt(i, dummy.matrix);

    // Physics wall (Thicker box to prevent clipping)
    // We want the inner face to match the visual wall's inner face.
    // Visual inner face distance = wallLimit - wallThickness / 2
    // Physics center distance = (wallLimit - wallThickness / 2) + physicsWallThickness / 2
    const physicsCenterDist = wallLimit - wallThickness / 2 + physicsWallThickness / 2;
    const px = Math.cos(angle) * physicsCenterDist;
    const pz = Math.sin(angle) * physicsCenterDist;

    const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(
            new CANNON.Vec3(wallSideLength / 2 + 1.0, physicsWallHeight / 2, physicsWallThickness / 2)
        ),
        material: world.wallMaterial,
        collisionFilterGroup: COLLISION_GROUP_WALLS,
        collisionFilterMask: COLLISION_GROUP_DICE,
    });
    body.position.set(px, physicsWallHeight / 2 - floorThickness, pz);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2 - angle);
    world.cannonWorld.addBody(body);
}

interface Dice {
    body: CANNON.Body;
    mesh: THREE.Mesh;
    type: DiceType;
    faces: FaceInfo[];
    currentValue: number | null;
    isSettled: boolean;
    hasEnteredTray: boolean;
    rollId: number;
    groupIndex: number;
    logicalIndex: number;
    isTens?: boolean;
    color: THREE.Color;
}

class InstancedDiceManager {
    private instances: Map<string, THREE.InstancedMesh> = new Map();
    private frustum = new THREE.Frustum();
    private projScreenMatrix = new THREE.Matrix4();
    private capacity = 256;

    constructor(
        private scene: THREE.Scene,
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

    update(diceList: Dice[], camera: THREE.Camera) {
        camera.updateMatrixWorld();
        this.projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
        );
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        const counts = new Map<string, number>();
        this.instances.forEach((_, key) => counts.set(key, 0));

        for (const dice of diceList) {
            const key = `${dice.type}${dice.isTens ? '-tens' : ''}`;
            const imesh = this.getInstancedMesh(dice.type, !!dice.isTens);
            const index = counts.get(key) || 0;

            if (index >= this.capacity) {
                continue;
            }

            dice.mesh.position.copy(dice.body.position as any);
            dice.mesh.quaternion.copy(dice.body.quaternion as any);
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

const diceInstanceManager = new InstancedDiceManager(scene, diceMaterial);

const diceList: Dice[] = [];
let nextRollId = 0;
let errorMessageTimeout: number | undefined;

function showErrorMessage(message: string) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.innerText = message;
        errorEl.style.display = 'block';
        if (errorMessageTimeout) clearTimeout(errorMessageTimeout);
        errorMessageTimeout = window.setTimeout(() => {
            errorEl.style.display = 'none';
            errorMessageTimeout = undefined;
        }, 2000);
    }
}

function hideErrorMessage() {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.style.display = 'none';
        if (errorMessageTimeout) {
            clearTimeout(errorMessageTimeout);
            errorMessageTimeout = undefined;
        }
    }
}

interface RollGroup {
    type: DiceType;
    count: number;
    keepType?: 'kh' | 'kl' | 'ka';
    keepCount?: number;
}

interface GroupResult {
    value: number;
    kept: boolean;
}

interface RollRecord {
    id: number;
    formula: string;
    template: string;
    result: number | null;
    groups: RollGroup[];
    groupResults: (GroupResult | number)[][]; // Store actual values for each group
    breakdown: string | null;
}
const rollHistory: RollRecord[] = [];
const maxHistory = 20;

function formatBreakdown(record: RollRecord): string {
    if (record.result === null) return 'Rolling...';
    return record.breakdown || '';
}

function updateHistoryUI() {
    const historyListEl = document.getElementById('history-list');
    if (historyListEl) {
        historyListEl.innerHTML = rollHistory
            .map(
                (record) => `
            <div class="history-item">
                <div class="history-header">
                    <span>${record.formula}</span>
                    <span class="history-result">${record.result !== null ? record.result : '...'}</span>
                </div>
                ${record.result !== null ? `<div class="history-breakdown">${formatBreakdown(record)}</div>` : ''}
                <button class="re-roll-btn" onclick="window.reRollById(${record.id})">Re-roll</button>
            </div>
        `
            )
            .join('');
    }

    const latestResultEl = document.getElementById('latest-result');
    if (latestResultEl) {
        if (rollHistory.length > 0 && rollHistory[0].result !== null) {
            latestResultEl.innerText = rollHistory[0].result.toString();
        } else {
            latestResultEl.innerText = '';
        }
    }
}

function addToHistory(formula: string, template: string, id: number, groups: RollGroup[]) {
    rollHistory.unshift({ id, formula, template, result: null, groups, groupResults: [], breakdown: null });
    if (rollHistory.length > maxHistory) {
        rollHistory.pop();
    }
    pruneDiceList();
    updateHistoryUI();
    saveState();
}

(window as any).reRollById = (id: number) => {
    const record = rollHistory.find((r) => r.id === id);
    if (record) {
        (window as any).rollFormula(record.formula);
    }
};

function createConvexPolyhedron(geometry: THREE.BufferGeometry) {
    const position = geometry.getAttribute('position');
    const vertices: CANNON.Vec3[] = [];
    const faces: number[][] = [];
    const vertexMap = new Map<string, number>();

    for (let i = 0; i < position.count; i += 3) {
        const face: number[] = [];
        for (let j = 0; j < 3; j++) {
            const vx = position.getX(i + j);
            const vy = position.getY(i + j);
            const vz = position.getZ(i + j);

            const key = `${vx.toFixed(4)},${vy.toFixed(4)},${vz.toFixed(4)}`;
            let index = vertexMap.get(key);
            if (index === undefined) {
                index = vertices.length;
                vertices.push(new CANNON.Vec3(vx, vy, vz));
                vertexMap.set(key, index);
            }
            face.push(index);
        }

        faces.push(face);
    }
    return new CANNON.ConvexPolyhedron({ vertices, faces });
}

type DiceType = 'd2' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

interface CachedDiceAsset {
    geometry: THREE.BufferGeometry;
    shape: CANNON.Shape;
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
        case 'd2':
            geometry = getD2();
            break;
        case 'd4':
            geometry = getD4();
            break;
        case 'd6':
            geometry = getCube();
            break;
        case 'd8':
            geometry = getD8();
            break;
        case 'd10':
        case 'd100':
            geometry = getD10();
            break;
        case 'd12':
            geometry = getD12();
            break;
        case 'd20':
            geometry = getD20();
            break;
        default:
            geometry = getCube();
    }

    const faces = applyDiceUVs(geometry, type, isTens);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    let shape: CANNON.Shape;
    if (type === 'd6') {
        shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4));
    } else if (type === 'd2') {
        shape = new CANNON.Cylinder(0.8, 0.8, 0.075, 8);
    } else {
        shape = createConvexPolyhedron(geometry);
    }

    const asset = { geometry, shape, faces };
    diceAssetCache.set(cacheKey, asset);
    return asset;
}

function createDice(
    type: DiceType,
    rollId: number,
    isTens = false,
    groupIndex = 0,
    logicalIndex = 0,
    indexInRoll = 0,
    totalInRoll = 1,
    initialState?: any
) {
    const asset = getDiceAsset(type, isTens);
    const geometry = asset.geometry;
    const shape = asset.shape;
    const faces = asset.faces;

    const diceColor = initialState?.color
        ? new THREE.Color(initialState.color)
        : new THREE.Color().setHSL(Math.random(), 0.4, 0.5);

    // Use shared material for the dummy mesh (used for frustum culling and transforms)
    const mesh = new THREE.Mesh(geometry, diceMaterial);
    // Note: mesh is not added to scene, we use InstancedMesh for rendering

    const body = new CANNON.Body({
        mass: 50,
        linearDamping: 0.2,
        angularDamping: 0.2,
        allowSleep: true,
        sleepSpeedLimit: 0.8,
        sleepTimeLimit: 0.5,
        material: world.diceMaterial,
        collisionFilterGroup: COLLISION_GROUP_DICE,
        collisionFilterMask: COLLISION_GROUP_DICE | COLLISION_GROUP_GROUND,
    });

    body.addShape(shape);

    body.addEventListener('collide', (event: any) => {
        if (event.body.material === world.wallMaterial) {
            const contact = event.contact;
            // contact.ni is the normal vector pointing from body b to body a.
            // We want the impulse to point towards our dice (body).
            let normal = contact.ni;
            if (contact.bi !== body) {
                normal = normal.clone().negate();
            }

            // Apply an additional "push" away from the wall
            const pushMagnitude = 100; // mass is 50, so this adds 2m/s
            const impulse = normal.clone().scale(pushMagnitude);
            body.applyImpulse(impulse);

            // Add some random angular momentum to help prevent dice from landing cocked
            const spinMagnitude = 25;
            body.angularVelocity.x += (Math.random() - 0.5) * spinMagnitude;
            body.angularVelocity.y += (Math.random() - 0.5) * spinMagnitude;
            body.angularVelocity.z += (Math.random() - 0.5) * spinMagnitude;
        }
    });

    let hasEnteredTray: boolean;
    if (initialState) {
        body.position.set(initialState.position.x, initialState.position.y, initialState.position.z);
        body.quaternion.set(
            initialState.quaternion.x,
            initialState.quaternion.y,
            initialState.quaternion.z,
            initialState.quaternion.w
        );
        body.velocity.set(initialState.velocity.x, initialState.velocity.y, initialState.velocity.z);
        body.angularVelocity.set(
            initialState.angularVelocity.x,
            initialState.angularVelocity.y,
            initialState.angularVelocity.z
        );

        mesh.position.copy(body.position as any);
        mesh.quaternion.copy(body.quaternion as any);

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
        let finalAngle = controls.getAzimuthalAngle();

        if (totalInRoll > 1) {
            // Center the spread on azAngle
            const offset = (indexInRoll / (totalInRoll - 1) - 0.5) * spread;
            finalAngle += offset;
        }

        const spawnDistance = wallLimit * 1.4;
        const spawnPos = new THREE.Vector3(
            Math.sin(finalAngle) * spawnDistance,
            8.0 + Math.random() * 4.0,
            Math.cos(finalAngle) * spawnDistance
        );

        // Add some random jitter to spawn position
        spawnPos.x += (Math.random() - 0.5) * 4;
        spawnPos.z += (Math.random() - 0.5) * 4;

        body.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
        mesh.position.copy(spawnPos);

        if (type === 'd2') {
            // Coin starts flat (since we aligned the shape to Y axis)
            body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.random() * Math.PI * 2);
        } else {
            const axis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
            const rotAngle = Math.random() * Math.PI * 2;
            body.quaternion.setFromAxisAngle(new CANNON.Vec3(axis.x, axis.y, axis.z), rotAngle);
        }
        mesh.quaternion.copy(body.quaternion as any);

        // Velocity: towards the center area (with enough variation to prevent piling)
        // Use a centered target area to ensure dice hit the tray, with more spread for larger rolls.
        const targetRange = wallLimit * (totalInRoll > 1 ? 1.0 : 0.5);
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

        const speed = 15 + Math.random() * 10;
        const velVec = horizontalDir.clone().multiplyScalar(speed);

        if (type === 'd2') {
            // Coin flip: significant upward velocity
            velVec.y = 8 + Math.random() * 6;
            // Removed horizontal speed penalty to encourage spreading out
        } else {
            // Slight upward arc for the throw
            velVec.y = 2 + Math.random() * 6;
        }

        body.velocity.set(velVec.x, velVec.y, velVec.z);

        // Ensure significant initial rotation (tumbling)
        if (type === 'd2') {
            // Flip the coin around a horizontal axis perpendicular to its movement
            const flipAxis = new THREE.Vector3(-horizontalDir.z, 0, horizontalDir.x);
            const flipSpeed = 15 + Math.random() * 10;
            body.angularVelocity.set(
                flipAxis.x * flipSpeed + (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 20, // some side wobble
                flipAxis.z * flipSpeed + (Math.random() - 0.5) * 10
            );
        } else {
            body.angularVelocity.set(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40
            );
        }

        const distSq = spawnPos.x * spawnPos.x + spawnPos.z * spawnPos.z;
        // Turn on wall collisions only if spawned safely inside (away from walls)
        hasEnteredTray = distSq < (wallLimit - 1.0) * (wallLimit - 1.0);
    }

    if (hasEnteredTray) {
        body.collisionFilterMask = COLLISION_GROUP_DICE | COLLISION_GROUP_GROUND | COLLISION_GROUP_WALLS;
    }

    world.addBody(body);
    diceList.push({
        body,
        mesh,
        type,
        faces,
        currentValue: initialState ? initialState.currentValue : null,
        isSettled: initialState ? initialState.isSettled : false,
        hasEnteredTray,
        rollId,
        groupIndex,
        logicalIndex,
        isTens,
        color: diceColor,
    });
}

interface MathResult {
    value: number;
    breakdown: string;
    expanded?: MathResult[];
}

function evaluateMath(expr: string, placeholders?: Record<string, MathResult>): MathResult {
    const tokens = expr.match(/\d+\.?\d*|[a-z]+|__G\d+__|[+\-*/(),]/gi) || [];
    const values: MathResult[] = [];
    const ops: string[] = [];
    const argCountStack: number[] = [];

    const precedence: { [key: string]: number } = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2,
    };

    const applyOp = () => {
        if (ops.length === 0) return;
        const op = ops.pop()!;
        if (op.endsWith('(')) return;
        if (values.length < 2) throw new Error('Invalid expression');
        const b = values.pop()!;
        const a = values.pop()!;
        let res: number;
        switch (op) {
            case '+':
                res = a.value + b.value;
                break;
            case '-':
                res = a.value - b.value;
                break;
            case '*':
                res = a.value * b.value;
                break;
            case '/':
                res = a.value / b.value;
                break;
            default:
                throw new Error('Unknown operator: ' + op);
        }
        values.push({
            value: res,
            breakdown: `${a.breakdown} ${op} ${b.breakdown}`,
        });
    };

    const applyFunc = (func: string, n: number) => {
        if (values.length < n) throw new Error('Insufficient operands for function');
        const args: MathResult[] = [];
        for (let i = 0; i < n; i++) args.unshift(values.pop()!);

        const f = func.toLowerCase();
        let val: number;
        let bd: string;

        if (f === 'max' || f === 'min') {
            const vList = args.map((a) => a.value);
            val = f === 'max' ? Math.max(...vList) : Math.min(...vList);
            let found = false;
            const bds = args.map((a) => {
                if (!found && a.value === val) {
                    found = true;
                    return a.breakdown;
                }
                return `<del>${a.breakdown}</del>`;
            });
            bd = `${f}(${bds.join(', ')})`;
        } else if (f === 'avg') {
            const vList = args.map((a) => a.value);
            val = vList.length === 0 ? 0 : vList.reduce((s, x) => s + x, 0) / vList.length;
            bd = `avg(${args.map((a) => a.breakdown).join(', ')})`;
        } else {
            throw new Error('Unknown function: ' + func);
        }
        values.push({ value: val, breakdown: bd });
    };

    let nextIsExpanded = false;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t === '*') {
            const prev = i > 0 ? tokens[i - 1] : null;
            const isUnary = !prev || /^[+\-*/(,]$/.test(prev);
            if (isUnary) {
                nextIsExpanded = true;
                continue;
            }
        }

        if (t.startsWith('__G')) {
            const res = placeholders?.[t] || { value: 0, breakdown: '0' };
            if (nextIsExpanded) {
                const items = res.expanded || [res];
                for (const item of items) values.push(item);
                if (argCountStack.length > 0 && argCountStack[argCountStack.length - 1] > 0) {
                    argCountStack[argCountStack.length - 1] += items.length - 1;
                }
                nextIsExpanded = false;
            } else {
                values.push(res);
            }
        } else if (!isNaN(parseFloat(t))) {
            const res = { value: parseFloat(t), breakdown: t };
            if (nextIsExpanded) {
                values.push(res);
                nextIsExpanded = false;
            } else {
                values.push(res);
            }
        } else if (/[a-z]+/i.test(t)) {
            ops.push(t);
        } else if (t === '(') {
            ops.push(nextIsExpanded ? '*(' : '(');
            nextIsExpanded = false;
            argCountStack.push(i > 0 && /[a-z]+/i.test(tokens[i - 1]) ? 1 : 0);
        } else if (t === ',') {
            while (ops.length && !ops[ops.length - 1].endsWith('(')) applyOp();
            if (argCountStack.length === 0 || argCountStack[argCountStack.length - 1] === 0) {
                throw new Error('Unexpected comma');
            }
            argCountStack[argCountStack.length - 1]++;
        } else if (t === ')') {
            while (ops.length && !ops[ops.length - 1].endsWith('(')) applyOp();
            if (ops.length === 0) throw new Error('Mismatched parentheses');
            const openOp = ops.pop()!;
            const shouldExpand = openOp === '*(';

            const n = argCountStack.pop()!;
            if (ops.length > 0 && /[a-z]+/i.test(ops[ops.length - 1])) {
                applyFunc(ops.pop()!, n);
                if (shouldExpand) {
                    const res = values.pop()!;
                    const items = res.expanded || [res];
                    for (const item of items) values.push(item);
                    if (argCountStack.length > 0 && argCountStack[argCountStack.length - 1] > 0) {
                        argCountStack[argCountStack.length - 1] += items.length - 1;
                    }
                }
            } else {
                const inner = values.pop()!;
                if (shouldExpand) {
                    const items = inner.expanded || [inner];
                    for (const item of items) values.push(item);
                    if (argCountStack.length > 0 && argCountStack[argCountStack.length - 1] > 0) {
                        argCountStack[argCountStack.length - 1] += items.length - 1;
                    }
                } else {
                    values.push({ value: inner.value, breakdown: `(${inner.breakdown})`, expanded: inner.expanded });
                }
            }
        } else {
            while (
                ops.length &&
                !ops[ops.length - 1].endsWith('(') &&
                precedence[ops[ops.length - 1]] >= (precedence[t] || 0)
            ) {
                applyOp();
            }
            ops.push(t);
        }
    }

    while (ops.length) {
        if (ops[ops.length - 1].endsWith('(')) throw new Error('Mismatched parentheses');
        applyOp();
    }

    if (values.length > 1) throw new Error('Too many values');
    const result = values[0] || { value: 0, breakdown: '0' };
    return {
        value: Math.round(result.value * 10) / 10,
        breakdown: result.breakdown,
    };
}

(window as any).rollDice = (type?: DiceType) => {
    const types: DiceType[] = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
    const selectedType = type || types[Math.floor(Math.random() * types.length)];
    (window as any).rollFormula(selectedType);
};

(window as any).clearDice = () => {
    for (const dice of diceList) {
        world.cannonWorld.removeBody(dice.body);
    }
    diceList.length = 0;
    diceInstanceManager.reset();
    saveState();
};

(window as any).clearHistory = () => {
    rollHistory.length = 0;
    pruneDiceList();
    updateHistoryUI();
    saveState();
};

(window as any).resetCamera = () => {
    controls.enableDamping = false;
    controls.reset();
    controls.reset(); // 2nd call is sometimes necessary for high angular velocity
    controls.enableDamping = true;
    saveState();
};

(window as any).clearAndRoll = (formula: string) => {
    (window as any).clearDice();
    (window as any).rollFormula(formula);
};

(window as any).toggleHistory = () => {
    const history = document.getElementById('history');
    if (history) {
        history.classList.toggle('open');
    }
    document.body.classList.toggle('history-open');

    const hamburger = document.getElementById('hamburger');
    if (hamburger) {
        hamburger.innerText = document.body.classList.contains('history-open') ? '✕' : '☰';
    }
};

(window as any).toggleHelp = () => {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        const isHidden = helpModal.style.display === 'none';
        helpModal.style.display = isHidden ? 'flex' : 'none';
    }
};

function getDiceTypeFromSides(sides: number): DiceType | null {
    switch (sides) {
        case 2:
            return 'd2';
        case 4:
            return 'd4';
        case 6:
            return 'd6';
        case 8:
            return 'd8';
        case 10:
            return 'd10';
        case 12:
            return 'd12';
        case 20:
            return 'd20';
        case 100:
            return 'd100';
        default:
            return null;
    }
}

(window as any).rollFormula = (formula: string) => {
    if (!formula.trim()) return;
    const rollId = nextRollId++;
    const groups: RollGroup[] = [];
    let template = formula.toLowerCase();

    // Pre-process functions wrapping single dice groups
    template = template.replace(/max\s*\(\s*((\d*)d(\d+))\s*\)/g, '$1kh1');
    template = template.replace(/min\s*\(\s*((\d*)d(\d+))\s*\)/g, '$1kl1');
    template = template.replace(/avg\s*\(\s*((\d*)d(\d+))\s*\)/g, '$1ka');

    const diceRegex = /(\d*)d(\d+)(kh|kl|ka)?(\d*)/g;

    // 1. Parse formula to identify groups and build template with placeholders
    template = template.replace(diceRegex, (match, p1, p2, p3, p4) => {
        const count = p1 === '' ? 1 : parseInt(p1);
        const sides = parseInt(p2);
        const type = getDiceTypeFromSides(sides);

        if (type) {
            const keepType = p3 as 'kh' | 'kl' | 'ka' | undefined;
            const keepCountRaw = p4;
            const keepCount =
                keepCountRaw === '' ? (keepType && keepType !== 'ka' ? 1 : undefined) : parseInt(keepCountRaw);

            const groupIndex = groups.length;
            groups.push({ type, count, keepType, keepCount });
            return `__G${groupIndex}__`;
        }
        return match;
    });

    if (groups.length === 0) {
        showErrorMessage('Invalid roll formula');
        return;
    }

    const validationTemplate = template.replace(/__G\d+__/g, '0');
    if (!/^[\d\s+\-/*().,a-z]*$/.test(validationTemplate)) {
        showErrorMessage('Invalid roll formula');
        return;
    }

    try {
        evaluateMath(validationTemplate);
    } catch (e) {
        showErrorMessage('Invalid roll formula');
        return;
    }

    // 2. Calculate total physical dice
    let totalPhysicalDice = 0;
    for (const group of groups) {
        totalPhysicalDice += group.type === 'd100' ? group.count * 2 : group.count;
    }

    // 3. Capacity check and cleanup
    if (totalPhysicalDice > 256) {
        showErrorMessage('Too many dice (limit: 256)');
        return;
    }
    hideErrorMessage();

    while (diceList.length + totalPhysicalDice > 256 && diceList.length > 0) {
        const oldestRollId = diceList[0].rollId;
        while (diceList.length > 0 && diceList[0].rollId === oldestRollId) {
            const dice = diceList.shift();
            if (dice) {
                world.cannonWorld.removeBody(dice.body);
            }
        }
    }

    // 4. Prepare for spawning
    const shuffledIndices = Array.from({ length: totalPhysicalDice }, (_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }

    let diceCounter = 0;
    let cumulativeDelay = 0;

    // 5. Spawn dice
    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.count; i++) {
            const logicalIndex = i;
            if (group.type === 'd100') {
                const idx1 = shuffledIndices[diceCounter++];
                const delay1 = cumulativeDelay;
                cumulativeDelay += 10 + Math.random() * 10;
                setTimeout(() => {
                    createDice('d100', rollId, true, groupIndex, logicalIndex, idx1, totalPhysicalDice);
                }, delay1);

                const idx2 = shuffledIndices[diceCounter++];
                const delay2 = cumulativeDelay;
                cumulativeDelay += 10 + Math.random() * 10;
                setTimeout(() => {
                    createDice('d100', rollId, false, groupIndex, logicalIndex, idx2, totalPhysicalDice);
                }, delay2);
            } else {
                const idx = shuffledIndices[diceCounter++];
                const delay = cumulativeDelay;
                cumulativeDelay += 10 + Math.random() * 10;
                const dType = group.type;
                setTimeout(() => {
                    createDice(dType, rollId, false, groupIndex, logicalIndex, idx, totalPhysicalDice);
                }, delay);
            }
        }
    });

    // 6. Add to history
    addToHistory(formula, template, rollId, groups);
};

const formulaInput = document.getElementById('formula') as HTMLInputElement;
if (formulaInput) {
    formulaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            (window as any).rollFormula(formulaInput.value);
        }
    });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const helpModal = document.getElementById('help-modal');
        if (helpModal && helpModal.style.display !== 'none') {
            (window as any).toggleHelp();
        }
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = 0;
const fixedStep = 1 / 60;

function pruneDiceList() {
    const historyIds = new Set(rollHistory.map((r) => r.id));
    for (let i = diceList.length - 1; i >= 0; i--) {
        const dice = diceList[i];
        if (!historyIds.has(dice.rollId)) {
            world.cannonWorld.removeBody(dice.body);
            diceList.splice(i, 1);
        }
    }
}

function updateDiceResults() {
    const rollsToUpdate = new Set<number>();

    for (const dice of diceList) {
        if (dice.body.sleepState === CANNON.Body.SLEEPING) {
            if (!dice.isSettled) {
                dice.isSettled = true;

                // Determine which face is up
                let maxDot = -Infinity;
                let minDot = Infinity;
                let bestFaceValue = 0;

                const worldQuat = new THREE.Quaternion(
                    dice.body.quaternion.x,
                    dice.body.quaternion.y,
                    dice.body.quaternion.z,
                    dice.body.quaternion.w
                );

                for (const face of dice.faces) {
                    const worldNormal = face.normal.clone().applyQuaternion(worldQuat);
                    if (dice.type === 'd4') {
                        if (worldNormal.y < minDot) {
                            minDot = worldNormal.y;
                            bestFaceValue = face.value;
                        }
                    } else {
                        if (worldNormal.y > maxDot) {
                            maxDot = worldNormal.y;
                            bestFaceValue = face.value;
                        }
                    }
                }

                dice.currentValue = bestFaceValue;
                rollsToUpdate.add(dice.rollId);
            }
        } else {
            dice.isSettled = false;
        }
    }

    // Update History for completed rolls
    for (const rollId of rollsToUpdate) {
        const record = rollHistory.find((r) => r.id === rollId);
        if (!record) {
            pruneDiceList();
            continue;
        }
        if (record.result !== null) continue;

        const rollDice = diceList.filter((d) => d.rollId === rollId);

        let expectedTotal = 0;
        for (const group of record.groups) {
            expectedTotal += group.type === 'd100' ? group.count * 2 : group.count;
        }

        if (rollDice.length < expectedTotal) continue;

        const allSettled = rollDice.every((d) => d.isSettled);
        if (allSettled) {
            const placeholders: Record<string, MathResult> = {};

            record.groups.forEach((group, groupIdx) => {
                const groupDice = rollDice.filter((d) => d.groupIndex === groupIdx);

                // Group dice by logicalIndex (relevant for d100)
                const logicalDieResults: number[] = [];
                const logicalGroups = new Map<number, Dice[]>();
                groupDice.forEach((d) => {
                    if (!logicalGroups.has(d.logicalIndex)) logicalGroups.set(d.logicalIndex, []);
                    logicalGroups.get(d.logicalIndex)!.push(d);
                });

                logicalGroups.forEach((dicePair) => {
                    if (dicePair[0].type === 'd100') {
                        const tens = dicePair.find((d) => d.isTens)?.currentValue || 0;
                        const units = dicePair.find((d) => !d.isTens)?.currentValue || 0;
                        let res = tens + units;
                        if (tens === 0 && units === 0) res = 100;
                        logicalDieResults.push(res);
                    } else {
                        let val = dicePair[0].currentValue ?? 0;
                        if (dicePair[0].type === 'd10' && val === 0) val = 10;
                        logicalDieResults.push(val);
                    }
                });

                // Apply kh/kl/ka logic
                let allResults = logicalDieResults.map((v) => ({ value: v, kept: true }));
                if (group.keepType === 'ka') {
                    record.groupResults[groupIdx] = allResults;
                    const sum = allResults.reduce((a, b) => a + b.value, 0);
                    const val = allResults.length > 0 ? sum / allResults.length : 0;
                    const parts = allResults.map((v) => v.value.toString());
                    placeholders[`__G${groupIdx}__`] = {
                        value: val,
                        breakdown: `avg(${parts.join(', ')})`,
                        expanded: allResults.map((v) => ({ value: v.value, breakdown: v.value.toString() })),
                    };
                } else {
                    if (group.keepType && group.keepCount !== undefined) {
                        if (group.keepType === 'kh') {
                            allResults.sort((a, b) => b.value - a.value);
                        } else {
                            allResults.sort((a, b) => a.value - b.value);
                        }
                        for (let i = group.keepCount; i < allResults.length; i++) {
                            allResults[i].kept = false;
                        }
                    }
                    record.groupResults[groupIdx] = allResults;
                    const val = allResults.filter((r) => r.kept).reduce((a, b) => a + b.value, 0);
                    const parts = allResults.map((v) => (v.kept ? v.value.toString() : `<del>${v.value}</del>`));
                    let bd: string;
                    if (parts.length > 1 || (parts.length === 1 && !allResults[0].kept)) {
                        bd = `(${parts.join(' + ')})`;
                    } else {
                        bd = parts[0] || '0';
                    }
                    placeholders[`__G${groupIdx}__`] = {
                        value: val,
                        breakdown: bd,
                        expanded: allResults
                            .filter((r) => r.kept)
                            .map((v) => ({ value: v.value, breakdown: v.value.toString() })),
                    };
                }
            });

            try {
                const res = evaluateMath(record.template, placeholders);
                record.result = res.value;
                record.breakdown = res.breakdown;
            } catch (e) {
                record.result = 0;
                record.breakdown = 'Error';
            }
            updateHistoryUI();
            saveState();
        }
    }
}

function saveState() {
    const formulaInput = document.getElementById('formula') as HTMLInputElement;
    const state = {
        rollHistory,
        nextRollId,
        formula: formulaInput ? formulaInput.value : '',
        camera: {
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        },
        dice: diceList.map((d) => ({
            type: d.type,
            rollId: d.rollId,
            groupIndex: d.groupIndex,
            logicalIndex: d.logicalIndex,
            isTens: d.isTens,
            position: { x: d.body.position.x, y: d.body.position.y, z: d.body.position.z },
            quaternion: {
                x: d.body.quaternion.x,
                y: d.body.quaternion.y,
                z: d.body.quaternion.z,
                w: d.body.quaternion.w,
            },
            velocity: { x: d.body.velocity.x, y: d.body.velocity.y, z: d.body.velocity.z },
            angularVelocity: { x: d.body.angularVelocity.x, y: d.body.angularVelocity.y, z: d.body.angularVelocity.z },
            color: d.color.getHex(),
            currentValue: d.currentValue,
            isSettled: d.isSettled,
            hasEnteredTray: d.hasEnteredTray,
        })),
    };
    localStorage.setItem('d20_state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('d20_state');
    if (!saved) return;
    try {
        const state = JSON.parse(saved);
        if (state.nextRollId !== undefined) {
            nextRollId = state.nextRollId;
        }
        if (state.formula !== undefined) {
            const formulaInput = document.getElementById('formula') as HTMLInputElement;
            if (formulaInput) formulaInput.value = state.formula;
        }
        if (state.rollHistory) {
            rollHistory.length = 0;
            rollHistory.push(...state.rollHistory);
            updateHistoryUI();
        }
        if (state.camera) {
            camera.position.set(state.camera.position.x, state.camera.position.y, state.camera.position.z);
            controls.target.set(state.camera.target.x, state.camera.target.y, state.camera.target.z);
            controls.update();
        }
        if (state.dice) {
            for (const dState of state.dice) {
                createDice(
                    dState.type,
                    dState.rollId,
                    dState.isTens,
                    dState.groupIndex,
                    dState.logicalIndex,
                    0,
                    1,
                    dState
                );
            }
        }
        pruneDiceList();
    } catch (e) {
        console.error('Failed to load state', e);
    }
}

const stats = new Stats();
stats.showPanel(0);
stats.dom.style.zIndex = '999';
stats.dom.style.opacity = '0';
stats.dom.addEventListener('click', () => {
    stats.dom.style.opacity = stats.dom.style.opacity === '0' ? '1' : '0';
    // Clicking cycles, set it back to 0
    stats.showPanel(0);
});
document.body.appendChild(stats.dom);

function animate(time: number = 0) {
    stats.begin();
    if (lastTime === 0) lastTime = time;
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    controls.update();
    world.step(fixedStep, Math.min(dt, 0.1));

    for (const dice of diceList) {
        if (!dice.hasEnteredTray) {
            const distSq = dice.body.position.x * dice.body.position.x + dice.body.position.z * dice.body.position.z;
            // Use a safer threshold to avoid sudden wall collisions
            if (distSq < (wallLimit - 1.0) * (wallLimit - 1.0)) {
                dice.hasEnteredTray = true;
                dice.body.collisionFilterMask = COLLISION_GROUP_DICE | COLLISION_GROUP_GROUND | COLLISION_GROUP_WALLS;
            }
        }
    }

    // Update instanced mesh rendering
    diceInstanceManager.update(diceList, camera);

    updateDiceResults();

    renderer.render(scene, camera);
    stats.end();

    requestAnimationFrame(animate);
}

window.addEventListener('beforeunload', saveState);
// Periodic save for camera/physics state
setInterval(saveState, 1000);

loadState();
animate();
