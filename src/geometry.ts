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

import { THREE } from './vendor.js';
import { GEOMETRY } from './constants.js';

function toBufferGeometry(vertices: number[], indices: number[]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    const flatGeometry = geometry.toNonIndexed();
    flatGeometry.computeVertexNormals();
    return flatGeometry;
}

export function getD2() {
    return getD4();
}

export function getD4() {
    return new THREE.TetrahedronGeometry(GEOMETRY.D4_RADIUS).toNonIndexed();
}

export function getCube() {
    return new THREE.BoxGeometry(GEOMETRY.CUBE_RADIUS, GEOMETRY.CUBE_RADIUS, GEOMETRY.CUBE_RADIUS).toNonIndexed();
}

export function getD8() {
    return new THREE.OctahedronGeometry(GEOMETRY.D8_RADIUS).toNonIndexed();
}

export function getD10() {
    const sides = 5;
    const vertices: number[] = [];
    const indices: number[] = [];

    const cos36 = Math.cos(Math.PI / 5);
    const H = GEOMETRY.D10_RADIUS;
    const h = (H * (1 - cos36)) / (1 + cos36); // Offset for a perfectly flat pentagonal trapezohedron
    const R = GEOMETRY.D10_RADIUS;

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
        indices.push(0, 2 + ((i + 1) % sides), 7 + i);

        // Face meeting at South Pole
        // Tri 1: 1, L_i, U_{i+1}
        // Tri 2: 1, U_{i+1}, L_{i+1}
        indices.push(1, 7 + i, 2 + ((i + 1) % sides));
        indices.push(1, 2 + ((i + 1) % sides), 7 + ((i + 1) % sides));
    }

    return toBufferGeometry(vertices, indices);
}

export function getD12() {
    return new THREE.DodecahedronGeometry(GEOMETRY.D12_RADIUS).toNonIndexed();
}

export function getD20() {
    return new THREE.IcosahedronGeometry(GEOMETRY.D20_RADIUS).toNonIndexed();
}
