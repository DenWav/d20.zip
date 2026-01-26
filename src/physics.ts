import { CANNON } from './vendor.js';

export class World {
    cannonWorld: CANNON.World;

    constructor() {
        this.cannonWorld = new CANNON.World();
        this.cannonWorld.allowSleep = true;
        this.cannonWorld.gravity.set(0, -30, 0);
        this.cannonWorld.broadphase = new CANNON.NaiveBroadphase();
        (this.cannonWorld.solver as any).iterations = 20;

        // Default contact material
        const defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
            friction: 0.8,
            restitution: 0.1,
            contactEquationStiffness: 2e7,
            contactEquationRelaxation: 2,
        });
        this.cannonWorld.addContactMaterial(defaultContactMaterial);
        this.cannonWorld.defaultContactMaterial = defaultContactMaterial;
    }

    step(dt: number, timeSinceLastCalled?: number) {
        this.cannonWorld.step(dt, timeSinceLastCalled, 10);
    }

    addBody(body: CANNON.Body) {
        this.cannonWorld.addBody(body);
    }
}
