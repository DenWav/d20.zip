// MIT license: https://d20.zip/license.txt

import { RAPIER } from './vendor.js';
import { COLLISION_GROUPS, SOUND, TRAY } from './constants.js';
import { DiceBag } from './dice.js';
import { AudioManager } from './audio.js';

export class Physics {
    public readonly rapierWorld: RAPIER.World;
    public readonly eventQueue: RAPIER.EventQueue;

    public audio!: AudioManager;
    public dice!: DiceBag;

    // Store most recent collission pair time
    // Key: collision pair
    // Value: last time collision occurred
    private readonly recentCollisions = new Map<string, number>();

    static async new(): Promise<Physics> {
        await RAPIER.init();
        return new Physics();
    }

    private constructor() {
        this.rapierWorld = new RAPIER.World({ x: 0.0, y: -48.0, z: 0.0 });

        // Optimize integration parameters for dice rolling
        // Higher iterations reduce jitter when dice are stacked
        this.rapierWorld.integrationParameters.maxVelocityIterations = 20;
        this.rapierWorld.integrationParameters.maxVelocityFrictionIterations = 20;
        this.rapierWorld.integrationParameters.maxStabilizationIterations = 20;

        this.rapierWorld.integrationParameters.predictionDistance = 0.001;
        this.rapierWorld.integrationParameters.maxCcdSubsteps = 4;
        this.rapierWorld.integrationParameters.allowedLinearError = 0.00001;

        // Create event queue for collision events
        this.eventQueue = new RAPIER.EventQueue(true);
    }

    public step(dt: number) {
        // Rapier wants to use a fixed timestep (default 1/60).
        // Our framerate varies based on browser performance and load, though, so that results in the simulation running
        // at unpredictable rates. This probably isn't a good idea, but it seems to work to adjust the dt every step
        // based on our current fame rate.
        this.rapierWorld.integrationParameters.dt = dt;
        this.rapierWorld.step(this.eventQueue);
    }

    public processCollisions() {
        if (!this.audio.isEnabled()) return;

        const now = performance.now() / 1000;

        this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            if (!started) return; // Only process collision start

            // Find the colliders
            const collider1 = this.rapierWorld.getCollider(handle1);
            const collider2 = this.rapierWorld.getCollider(handle2);
            if (!collider1 || !collider2) return;

            // Get collision impulse
            const body1 = collider1.parent();
            const body2 = collider2.parent();
            if (!body1 && !body2) return;

            // Calculate relative velocity for volume
            let velocity = 0;
            if (body1 && !body1.isFixed()) {
                const vel = body1.linvel();
                velocity = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
            }
            if (body2 && !body2.isFixed()) {
                const vel = body2.linvel();
                velocity = Math.max(velocity, Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z));
            }

            if (velocity < SOUND.MIN_VELOCITY) return;

            // Determine collision type based on collision groups
            const group1 = collider1.collisionGroups();
            const group2 = collider2.collisionGroups();

            const isDice1 = (group1 & COLLISION_GROUPS.DICE) !== 0;
            const isDice2 = (group2 & COLLISION_GROUPS.DICE) !== 0;
            const isGround1 = (group1 & COLLISION_GROUPS.GROUND) !== 0;
            const isGround2 = (group2 & COLLISION_GROUPS.GROUND) !== 0;
            const isWall1 = (group1 & COLLISION_GROUPS.WALLS) !== 0;
            const isWall2 = (group2 & COLLISION_GROUPS.WALLS) !== 0;

            let collisionType: 'dice-dice' | 'dice-floor' | 'dice-wall' | null = null;

            if (isDice1 && isDice2) {
                collisionType = 'dice-dice';
            } else if ((isDice1 && isGround2) || (isDice2 && isGround1)) {
                collisionType = 'dice-floor';
            } else if ((isDice1 && isWall2) || (isDice2 && isWall1)) {
                collisionType = 'dice-wall';
            }

            if (collisionType === 'dice-wall') {
                // Check if any involved dice have entered the tray
                // Only play sounds for dice that are visibly in the play area
                const dice1 = this.dice.diceList.find((d) => d.collider.handle === handle1);
                const dice2 = this.dice.diceList.find((d) => d.collider.handle === handle2);

                if ((dice1 ?? dice2)!.body.translation().y > TRAY.WALL_HEIGHT) {
                    return;
                }
            }

            if (!collisionType) return;

            // Throttle sounds per collision pair
            const key = `${Math.min(handle1, handle2)}-${Math.max(handle1, handle2)}`;
            const lastTime = this.recentCollisions.get(key) || 0;
            if (now - lastTime < SOUND.MIN_INTERVAL * 2) return; // Extra throttling per pair

            this.recentCollisions.set(key, now);
            this.audio.play(collisionType, velocity);
        });

        // Clean up old collision records (older than 1 second)
        for (const [key, time] of this.recentCollisions.entries()) {
            if (now - time > 1.0) {
                this.recentCollisions.delete(key);
            }
        }
    }
}
