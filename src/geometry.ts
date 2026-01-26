import * as THREE from 'three';

function toBufferGeometry(vertices: Float32Array, normals: Float32Array, indices: Uint16Array) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
}

function generateGeometry(v: number[], indices: number[]) {
    const vertices = new Float32Array(indices.length * 3);
    const normals = new Float32Array(indices.length * 3);

    for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i] * 3, i2 = indices[i+1] * 3, i3 = indices[i+2] * 3;
        const v1 = [v[i1], v[i1+1], v[i1+2]];
        const v2 = [v[i2], v[i2+1], v[i2+2]];
        const v3 = [v[i3], v[i3+1], v[i3+2]];

        vertices.set([...v1, ...v2, ...v3], i * 3);

        // Calculate normal
        const u = [v2[0]-v1[0], v2[1]-v1[1], v2[2]-v1[2]];
        const w = [v3[0]-v1[0], v3[1]-v1[1], v3[2]-v1[2]];
        const n = [
            u[1]*w[2] - u[2]*w[1],
            u[2]*w[0] - u[0]*w[2],
            u[0]*w[1] - u[1]*w[0]
        ];
        const l = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]);
        const norm = l > 0 ? [n[0]/l, n[1]/l, n[2]/l] : [0, 0, 0];
        normals.set([...norm, ...norm, ...norm], i * 3);
    }

    return toBufferGeometry(vertices, normals, new Uint16Array(indices.map((_, i) => i)));
}

export function getD2() {
    return new THREE.CylinderGeometry(0.8, 0.8, 0.1, 32).toNonIndexed();
}

export function getD4() {
    return new THREE.TetrahedronGeometry(0.8).toNonIndexed();
}

export function getCube() {
    return new THREE.BoxGeometry(0.8, 0.8, 0.8).toNonIndexed();
}

export function getD8() {
    return new THREE.OctahedronGeometry(0.8).toNonIndexed();
}

export function getD10() {
    const sides = 5;
    const vertices: number[] = [];
    const indices: number[] = [];

    const cos36 = Math.cos(Math.PI / 5);
    const H = 0.8;  // Pole height (reduced from 1.0 to fix stretched appearance)
    const h = H * (1 - cos36) / (1 + cos36); // Offset for a perfectly flat pentagonal trapezohedron
    const R = 0.8;  // Radius

    // North pole
    vertices.push(0, H, 0); // index 0
    // South pole
    vertices.push(0, -H, 0); // index 1

    // Upper ring (5 vertices)
    for (let i = 0; i < sides; i++) {
        const a = (i * 72 * Math.PI) / 180;
        vertices.push(Math.cos(a) * R, h, Math.sin(a) * R);
    } // indices 2, 3, 4, 5, 6

    // Lower ring (5 vertices)
    for (let i = 0; i < sides; i++) {
        const a = ((i * 72 + 36) * Math.PI) / 180;
        vertices.push(Math.cos(a) * R, -h, Math.sin(a) * R);
    } // indices 7, 8, 9, 10, 11

    // 10 Kite faces
    for (let i = 0; i < sides; i++) {
        // Face meeting at North Pole
        // Tri 1: 0, L_i, U_i
        // Tri 2: 0, U_{i+1}, L_i
        indices.push(0, 7 + i, 2 + i);
        indices.push(0, 2 + (i + 1) % sides, 7 + i);

        // Face meeting at South Pole
        // Tri 1: 1, L_i, U_{i+1}
        // Tri 2: 1, U_{i+1}, L_{i+1}
        indices.push(1, 7 + i, 2 + (i + 1) % sides);
        indices.push(1, 2 + (i + 1) % sides, 7 + (i + 1) % sides);
    }

    return generateGeometry(vertices, indices);
}

export function getD12() {
    return new THREE.DodecahedronGeometry(0.8).toNonIndexed();
}

export function getD20() {
    return new THREE.IcosahedronGeometry(0.9).toNonIndexed();
}
