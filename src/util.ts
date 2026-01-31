// MIT license: https://d20.zip/license.txt
// https://github.com/DenWav/d20.zip

import { Stats } from './vendor.js';

// --- Seeded Random for Deterministic Assets ---
export function mulberry32(a: number) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffleArray<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

export function initStats(): Stats {
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

    return stats;
}
