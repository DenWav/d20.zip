// MIT license: https://d20.zip/license.txt
// https://github.com/DenWav/d20.zip

import { World } from './world.js';
import { DiceBag } from './dice.js';
import { UiManager } from './ui.js';

export class State {
    public constructor(
        private readonly world: World,
        private readonly dice: DiceBag,
        private readonly ui: UiManager
    ) {}

    public saveState() {
        const formulaInput = document.getElementById('formula') as HTMLInputElement;
        const camera = this.world.renderer.camera;
        const controls = this.world.renderer.controls;
        const state = {
            rollHistory: this.dice.rollHistory,
            nextRollId: this.dice.nextRollId,
            formula: formulaInput ? formulaInput.value : '',
            camera: {
                position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
            },
            audio: {
                enabled: this.world.audio.isEnabled(),
                volume: this.world.audio.getVolume(),
            },
            dice: this.dice.diceList.map((d) => {
                const pos = d.body.translation();
                const rot = d.body.rotation();
                const vel = d.body.linvel();
                const angVel = d.body.angvel();
                return {
                    type: d.type,
                    rollId: d.rollId,
                    groupIndex: d.groupIndex,
                    logicalIndex: d.logicalIndex,
                    isTens: d.isTens,
                    position: { x: pos.x, y: pos.y, z: pos.z },
                    quaternion: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
                    velocity: { x: vel.x, y: vel.y, z: vel.z },
                    angularVelocity: { x: angVel.x, y: angVel.y, z: angVel.z },
                    color: d.color.getHex(),
                    currentValue: d.currentValue,
                    isSettled: d.isSettled,
                    awakeSince: d.awakeSince,
                    hasEnteredTray: d.hasEnteredTray,
                };
            }),
            activeRolls: this.dice.activeRollIds,
        };
        localStorage.setItem('d20_state', JSON.stringify(state));
    }

    public loadState() {
        const saved = localStorage.getItem('d20_state');
        if (!saved) return;
        const camera = this.world.renderer.camera;
        const controls = this.world.renderer.controls;
        try {
            const state = JSON.parse(saved);
            if (state.nextRollId !== undefined) {
                this.dice.nextRollId = state.nextRollId;
            }
            if (state.formula !== undefined) {
                const formulaInput = document.getElementById('formula') as HTMLInputElement;
                if (formulaInput) formulaInput.value = state.formula;
            }
            if (state.rollHistory) {
                this.dice.rollHistory.length = 0;
                this.dice.rollHistory.push(...state.rollHistory);
                this.ui.updateHistoryUI();
            }
            if (state.camera) {
                camera.position.set(state.camera.position.x, state.camera.position.y, state.camera.position.z);
                controls.target.set(state.camera.target.x, state.camera.target.y, state.camera.target.z);
                controls.update();
            }
            if (state.audio) {
                if (state.audio.enabled !== undefined) {
                    this.world.audio.setEnabled(state.audio.enabled);
                    const audioEnabledCheckbox = document.getElementById('audio-enabled') as HTMLInputElement;
                    if (audioEnabledCheckbox) {
                        audioEnabledCheckbox.checked = state.audio.enabled;
                    }
                }
                if (state.audio.volume !== undefined) {
                    this.world.audio.setVolume(state.audio.volume);
                    const audioVolumeSlider = document.getElementById('audio-volume') as HTMLInputElement;
                    const audioVolumeValue = document.getElementById('audio-volume-value') as HTMLSpanElement;
                    if (audioVolumeSlider) {
                        audioVolumeSlider.value = state.audio.volume.toString();
                    }
                    if (audioVolumeValue) {
                        audioVolumeValue.textContent = `${state.audio.volume}%`;
                    }
                }
            }
            if (state.activeRolls) {
                for (const id of state.activeRolls) {
                    const roll = this.dice.rollHistory.find((r) => r.id === id);
                    if (roll) {
                        this.dice.addActiveRoll(roll);
                    } else {
                        console.log('MISSED');
                    }
                }
            }
            if (state.dice) {
                for (const dState of state.dice) {
                    this.dice.createDice(
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
            this.dice.pruneDiceList();
        } catch (e) {
            console.error('Failed to load state', e);
        }
    }
}
