// MIT license: https://d20.zip/license.txt

import { RAPIER } from './vendor.js';
import { PHYSICS } from './constants.js';

export class World {
    rapierWorld: RAPIER.World;
    eventQueue: RAPIER.EventQueue;

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

        // Create event queue for collision events
        this.eventQueue = new RAPIER.EventQueue(true);
    }

    step(dt: number) {
        // Rapier wants to use a fixed timestep (default 1/60).
        // Our framerate varies based on browser performance and load, though, so that results in the simulation running
        // at unpredictable rates. This probably isn't a good idea, but it seems to work to adjust the dt every step
        // based on our current fame rate.
        this.rapierWorld.integrationParameters.dt = dt;
        this.rapierWorld.step(this.eventQueue);
    }
}
