// MIT license: https://d20.zip/license.txt

import { RAPIER } from './vendor.js';
import { PHYSICS } from './constants.js';

export class World {
    rapierWorld: RAPIER.World;

    constructor() {
        const gravity = PHYSICS.GRAVITY;
        this.rapierWorld = new RAPIER.World(gravity);

        // Optimize integration parameters for dice rolling
        // Higher iterations reduce jitter when dice are stacked
        this.rapierWorld.integrationParameters.maxVelocityIterations = PHYSICS.MAX_VELOCITY_ITERATIONS;
        this.rapierWorld.integrationParameters.maxVelocityFrictionIterations = PHYSICS.MAX_VELOCITY_FRICTION_ITERATIONS;
        this.rapierWorld.integrationParameters.maxStabilizationIterations = PHYSICS.MAX_STABILIZATION_ITERATIONS;

        // Prediction distance and CCD substeps help with fast moving objects
        this.rapierWorld.integrationParameters.predictionDistance = PHYSICS.PREDICTION_DISTANCE;
        this.rapierWorld.integrationParameters.maxCcdSubsteps = PHYSICS.MAX_CCD_SUBSTEPS;
    }

    step(dt: number, timeSinceLastCalled?: number) {
        // Rapier uses a fixed timestep (default 1/60).
        // Here we just call step. If dt is significantly larger than 1/60,
        // we might want to call it multiple times, but let's keep it simple.
        // Arguments are present to allow that optimization later if necessary.
        this.rapierWorld.step();
    }
}
