import { CANNON } from './vendor.js';

export class World {
    cannonWorld: CANNON.World;
    diceMaterial: CANNON.Material;
    wallMaterial: CANNON.Material;
    floorMaterial: CANNON.Material;

    constructor() {
        this.cannonWorld = new CANNON.World();
        this.cannonWorld.allowSleep = true;
        this.cannonWorld.gravity.set(0, -48, 0);
        this.cannonWorld.broadphase = new CANNON.NaiveBroadphase();

        const solver = new CANNON.GSSolver();
        solver.iterations = 240;
        solver.tolerance = 0.01;
        this.cannonWorld.solver = new CANNON.SplitSolver(solver);

        // Materials
        this.floorMaterial = new CANNON.Material('floor');
        this.diceMaterial = new CANNON.Material('dice');
        this.wallMaterial = new CANNON.Material('wall');

        // Default contact material (used if no other match is found)
        const defaultContactMaterial = new CANNON.ContactMaterial(this.floorMaterial, this.floorMaterial, {
            friction: 0.9,
            restitution: 0.1,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 10,
            frictionEquationStiffness: 1e6,
            frictionEquationRelaxation: 10,
        });
        this.cannonWorld.addContactMaterial(defaultContactMaterial);
        this.cannonWorld.defaultContactMaterial = defaultContactMaterial;

        // Dice vs Dice (Bouncy)
        this.cannonWorld.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.diceMaterial, {
            friction: 0.9,
            restitution: 0.7,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 10,
            frictionEquationStiffness: 1e6,
            frictionEquationRelaxation: 10,
        }));

        // Dice vs Wall (Bouncy)
        this.cannonWorld.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.wallMaterial, {
            friction: 0.9,
            restitution: 0.7,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 10,
            frictionEquationStiffness: 1e6,
            frictionEquationRelaxation: 10,
        }));

        // Dice vs Floor (Low bounciness)
        this.cannonWorld.addContactMaterial(new CANNON.ContactMaterial(this.diceMaterial, this.floorMaterial, {
            friction: 0.9,
            restitution: 0.1,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 10,
            frictionEquationStiffness: 1e6,
            frictionEquationRelaxation: 10,
        }));
    }

    step(dt: number, timeSinceLastCalled?: number) {
        this.cannonWorld.step(dt, timeSinceLastCalled, 20);
    }

    addBody(body: CANNON.Body) {
        this.cannonWorld.addBody(body);
    }
}
