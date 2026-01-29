import { Physics } from './physics.js';
import { Renderer } from './render.js';
import { AudioManager } from './audio.js';

export class World {
    constructor(
        readonly renderer: Renderer,
        readonly physics: Physics,
        readonly audio: AudioManager
    ) {}
}
