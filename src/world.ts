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
