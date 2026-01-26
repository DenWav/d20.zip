import { CANNON } from './vendor.js';

export class World {
    cannonWorld: CANNON.World;

    constructor() {
        this.cannonWorld = new CANNON.World();
        this.cannonWorld.allowSleep = true;
        this.cannonWorld.gravity.set(0, -24, 0);
        this.cannonWorld.broadphase = new CANNON.NaiveBroadphase();

        const solver = new CANNON.GSSolver();
        solver.iterations = 240;
        solver.tolerance = 0.01;
        this.cannonWorld.solver = new CANNON.SplitSolver(solver);

        // Default contact material
        const defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
            friction: 0.9,
            restitution: 0.1,
            contactEquationStiffness: 1e6,
            contactEquationRelaxation: 10,
            frictionEquationStiffness: 1e6,
            frictionEquationRelaxation: 10,
        });
        this.cannonWorld.addContactMaterial(defaultContactMaterial);
        this.cannonWorld.defaultContactMaterial = defaultContactMaterial;
    }

    step(dt: number, timeSinceLastCalled?: number) {
        this.cannonWorld.step(dt, timeSinceLastCalled, 20);
    }

    addBody(body: CANNON.Body) {
        this.cannonWorld.addBody(body);
    }
}
