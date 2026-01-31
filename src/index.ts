// MIT license: https://d20.zip/license.txt

import { THREE } from './vendor.js';
import { Physics } from './physics.js';
import { AudioManager } from './audio.js';
import * as Tray from './tray.js';
import { Renderer } from './render.js';
import { World } from './world.js';
import { Dice, DiceBag, DiceType, DiceTypes, getDiceTypeFromSides, RollGroup, RollRecord } from './dice.js';
import { UiManager } from './ui.js';
import { State } from './state.js';
import { COLLISION_GROUPS, DICE, MAX_DICE, STATE_SAVE_INTERVAL, TRAY } from './constants.js';
import { initStats, shuffleArray } from './util.js';
import * as MathUtils from './math.js';
import RAPIER from '@dimforge/rapier3d-compat';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const physics = await Physics.new();
const audio = new AudioManager();

const world = new World(renderer, physics, audio);
Tray.initTray(world);

const dice = new DiceBag(world);
const ui = new UiManager(dice);
const state = new State(world, dice, ui);

// Additional wiring
ui.state = state;
physics.audio = audio;
physics.dice = dice;

state.loadState();

window.addEventListener('beforeunload', state.saveState.bind(state));
// Periodic save for camera/physics state
setInterval(state.saveState.bind(state), STATE_SAVE_INTERVAL);

audio.setupUi();
const stats = initStats();

(window as any).reRollById = (id: number) => {
    const record = dice.rollHistory.find((r) => r.id === id);
    if (record) {
        (window as any).rollFormula(record.formula);
    }
};

(window as any).clearDice = () => {
    for (const die of dice.diceList) {
        dice.removeDice(die);
        dice.canceledRollId = die.rollId;
    }
    dice.diceList.length = 0;
    dice.clearActiveRolls();
    dice.instanceManager.reset();
    state.saveState();
};

(window as any).clearHistory = () => {
    dice.rollHistory.length = 0;
    dice.pruneDiceList();
    ui.updateHistoryUI();
    (window as any).clearDice();
};

(window as any).resetCamera = () => {
    renderer.controls.enableDamping = false;
    renderer.controls.reset();
    renderer.controls.reset(); // 2nd call is sometimes necessary for high angular velocity
    renderer.controls.enableDamping = true;
    state.saveState();
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

function blockEventPropagation(event: MouseEvent) {
    if ((event.target as Element)?.id === 'help-close') {
        (window as any).toggleHelp();
        return;
    }
    event.stopPropagation();
}

(window as any).toggleHelp = () => {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        const isHidden = helpModal.style.display === 'none';
        helpModal.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            document.getElementById('help-content')?.addEventListener('click', blockEventPropagation, true);
        } else {
            document.getElementById('help-content')?.removeEventListener('click', blockEventPropagation, true);
        }
    }
};

(window as any).rollFormula = (formula: string) => {
    if (!formula.trim()) return;
    const rollId = dice.nextRollId++;
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
        ui.showErrorMessage('Invalid roll formula');
        return;
    }

    const validationTemplate = template.replace(/__G\d+__/g, '0');
    if (!/^[\d\s+\-/*().,a-z]*$/.test(validationTemplate)) {
        ui.showErrorMessage('Invalid roll formula');
        return;
    }

    try {
        MathUtils.evaluateMath(validationTemplate);
    } catch (e) {
        ui.showErrorMessage('Invalid roll formula');
        return;
    }

    // 2. Calculate total physical dice
    let totalPhysicalDice = 0;
    for (const group of groups) {
        totalPhysicalDice += group.type === DiceType.D100 ? group.count * 2 : group.count;
    }

    // 3. Capacity check and cleanup
    if (totalPhysicalDice > MAX_DICE) {
        ui.showErrorMessage(`Too many dice (limit: ${MAX_DICE})`);
        return;
    }
    ui.hideErrorMessage();

    let removedDice = false;
    while (dice.totalDiceCount + totalPhysicalDice > MAX_DICE) {
        let roll = dice.popLastActiveRoll();
        if (!roll) {
            console.error('No active roll found');
            break;
        }
        dice.canceledRollId = Math.max(roll.id, dice.canceledRollId ?? 0);
        while (dice.diceList.length > 0 && dice.diceList[0].rollId === roll.id) {
            const die = dice.diceList.shift();
            if (die) {
                dice.removeDice(die);
                removedDice = true;
            }
        }
    }
    if (removedDice) {
        // We may have removed many dice, so always update
        dice.instanceManager.update();
    }

    // 4. Prepare for spawning
    interface DiceSpawnTask {
        type: DiceType;
        isTens: boolean;
        groupIndex: number;
        logicalIndex: number;
    }

    const spawnTasks: DiceSpawnTask[] = [];
    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.count; i++) {
            const logicalIndex = i;
            if (group.type === DiceType.D100) {
                spawnTasks.push({ type: DiceType.D100, isTens: true, groupIndex, logicalIndex });
                spawnTasks.push({ type: DiceType.D100, isTens: false, groupIndex, logicalIndex });
            } else {
                spawnTasks.push({ type: group.type, isTens: false, groupIndex, logicalIndex });
            }
        }
    });

    shuffleArray(spawnTasks);

    let cumulativeDelay = 0;

    const shuffledIndices = Array.from({ length: totalPhysicalDice }, (_, i) => i);
    shuffleArray(shuffledIndices);

    // 5. Add to history
    const roll: RollRecord = {
        id: rollId,
        formula,
        template,
        result: null,
        groups,
        groupResults: [],
        breakdown: null,
    };

    ui.addToHistory(roll);
    dice.addActiveRoll(roll);

    // 6. Schedule spawn dice
    spawnTasks.forEach((task, i) => {
        const delay = cumulativeDelay;
        cumulativeDelay += DICE.SPAWN_DELAY_BASE + Math.random() * DICE.SPAWN_DELAY_VAR;
        setTimeout(
            dice.createDice.bind(
                dice,
                task.type,
                rollId,
                task.isTens,
                task.groupIndex,
                task.logicalIndex,
                shuffledIndices[i],
                totalPhysicalDice
            ),
            delay
        );
    });
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
    renderer.camera.aspect = window.innerWidth / window.innerHeight;
    renderer.camera.updateProjectionMatrix();
    renderer.renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = 0;

function updateDiceResults() {
    const rollsToUpdate = new Set<number>();

    const now = new Date().getTime();

    for (const die of dice.diceList) {
        block: if (!die.body.isSleeping()) {
            const linvel = die.body.linvel();
            const angvel = die.body.angvel();
            function sq(vec: RAPIER.Vector): number {
                return vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
            }
            if (die.hasEnteredTray && sq(linvel) < DICE.SLEEP_THRESHOLD && sq(angvel) < DICE.SLEEP_THRESHOLD) {
                die.body.sleep();
                break block;
            }

            // Proactively sleep dice to prevent jitter
            // D2 (coins) jitter violently, so they have a higher threshold
            if (!die.awakeSince) {
                die.awakeSince = new Date();
                continue;
            }

            // After 4 seconds of being awake, start damping, increasing damping exponentially with time
            const duration = Math.floor((now - die.awakeSince.getTime()) / 500);
            if (duration < 8) {
                continue;
            }

            const damping = Math.pow(100, duration - 10);
            die.body.setLinearDamping(damping);
            die.body.setAngularDamping(damping);
        }

        if (die.body.isSleeping()) {
            die.awakeSince = null;
            // Reset damping
            die.body.setLinearDamping(die.type === DiceType.D2 ? DICE.DAMPING : DICE.DAMPING);
            die.body.setAngularDamping(die.type === DiceType.D2 ? DICE.DAMPING : DICE.DAMPING);

            if (!die.isSettled) {
                die.isSettled = true;

                // Determine which face is up
                let maxDot = -Infinity;
                let minDot = Infinity;
                let bestFaceValue = 0;

                const rot = die.body.rotation();
                const worldQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);

                for (const face of die.faces) {
                    const worldNormal = face.normal.clone().applyQuaternion(worldQuat);
                    if (die.type === DiceType.D4 || die.type === DiceType.D2) {
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

                die.currentValue = bestFaceValue;
                rollsToUpdate.add(die.rollId);
            }
        } else {
            die.isSettled = false;
        }
    }

    // Update History for completed rolls
    for (const rollId of rollsToUpdate) {
        const record = dice.rollHistory.find((r) => r.id === rollId);
        if (!record) {
            dice.pruneDiceList();
            continue;
        }
        if (record.result !== null) continue;

        const rollDice = dice.diceList.filter((d) => d.rollId === rollId);

        let expectedTotal = 0;
        for (const group of record.groups) {
            expectedTotal += group.type === DiceType.D100 ? group.count * 2 : group.count;
        }

        if (rollDice.length < expectedTotal) continue;

        const allSettled = rollDice.every((d) => d.isSettled);
        if (allSettled) {
            const placeholders: Record<string, MathUtils.MathResult> = {};

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
                    if (dicePair[0].type === DiceType.D100) {
                        const tens = dicePair.find((d) => d.isTens)?.currentValue || 0;
                        const units = dicePair.find((d) => !d.isTens)?.currentValue || 0;
                        let res = tens + units;
                        if (tens === 0 && units === 0) res = 100;
                        logicalDieResults.push(res);
                    } else {
                        let val = dicePair[0].currentValue ?? 0;
                        if (dicePair[0].type === DiceType.D10 && val === 0) val = 10;
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
                const res = MathUtils.evaluateMath(record.template, placeholders);
                record.result = res.value;
                record.breakdown = res.breakdown;
            } catch (e) {
                record.result = 0;
                record.breakdown = 'Error';
            }
            ui.updateHistoryUI();
            state.saveState();
        }
    }
}

function animate(time: number = 0) {
    stats.begin();
    if (lastTime === 0) lastTime = time;
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    renderer.controls.update();
    world.physics.step(Math.min(dt, 1 / 30));

    // Process collision events for sound
    physics.processCollisions();

    // Since dice spawn async, even though we try to prevent spawns for cancelled dice, they can still happen
    // Prune any that make it through here
    dice.filterActiveRolls();

    for (const die of dice.diceList) {
        if (!die.hasEnteredTray) {
            const pos = die.body.translation();
            const distSq = pos.x * pos.x + pos.z * pos.z;
            // Use a safer threshold to avoid sudden wall collisions
            if (
                distSq <
                (TRAY.WALL_LIMIT - DICE.SAFE_ENTRY_DISTANCE_OFFSET) *
                    (TRAY.WALL_LIMIT - DICE.SAFE_ENTRY_DISTANCE_OFFSET)
            ) {
                die.hasEnteredTray = true;
                die.collider.setCollisionGroups(
                    COLLISION_GROUPS.DICE |
                        ((COLLISION_GROUPS.DICE | COLLISION_GROUPS.GROUND | COLLISION_GROUPS.WALLS) << 16)
                );
            }
        }
    }

    // Update instanced mesh rendering
    dice.instanceManager.update();

    updateDiceResults();

    renderer.renderer.render(renderer.scene, renderer.camera);
    stats.end();

    requestAnimationFrame(animate);
}

animate();
