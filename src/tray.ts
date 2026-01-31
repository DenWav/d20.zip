import { RAPIER, THREE } from './vendor.js';
import { COLLISION_GROUPS, MATERIALS, SCENE, TRAY } from './constants.js';
import { createFeltTexture } from './dice.js';
import { World } from './world.js';

export function initTray(world: World) {
    const wallCount = TRAY.WALL_COUNT;
    const wallLimit = TRAY.WALL_LIMIT;
    const wallHeight = TRAY.WALL_HEIGHT;
    const wallThickness = TRAY.WALL_THICKNESS;
    const floorRadius = wallLimit / Math.cos(Math.PI / wallCount);
    const floorThickness = TRAY.FLOOR_THICKNESS;

    const feltTexture = createFeltTexture();

    // Floor for visual reference
    const floorMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(floorRadius, floorRadius, floorThickness, wallCount),
        new THREE.MeshStandardMaterial({
            color: SCENE.FLOOR_COLOR, // Adjusted blue to compensate for texture base
            map: feltTexture,
            bumpMap: feltTexture,
            bumpScale: MATERIALS.FLOOR.BUMP_SCALE,
            roughness: MATERIALS.FLOOR.ROUGHNESS,
            roughnessMap: feltTexture,
            metalness: MATERIALS.FLOOR.METALNESS,
        })
    );
    floorMesh.position.y = -floorThickness / 2;
    floorMesh.rotation.y = Math.PI / wallCount;
    floorMesh.receiveShadow = true;
    world.renderer.scene.add(floorMesh);

    // Floor Physics
    const physicsFloorThickness = TRAY.PHYSICS_FLOOR_THICKNESS;
    const floorDesc = RAPIER.RigidBodyDesc.fixed().setCcdEnabled(true).setTranslation(0, -physicsFloorThickness, 0);
    const floorBody = world.physics.rapierWorld.createRigidBody(floorDesc);
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(floorRadius * 100, physicsFloorThickness, floorRadius * 100)
        .setFriction(0.9)
        .setRestitution(0.2)
        .setCollisionGroups(COLLISION_GROUPS.GROUND | (COLLISION_GROUPS.DICE << 16))
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    world.physics.rapierWorld.createCollider(floorColliderDesc, floorBody);

    // Visual Walls & Physics Walls
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: SCENE.WALL_COLOR,
        roughness: MATERIALS.WALL.ROUGHNESS,
    });
    const wallSideLength = 2 * floorRadius * Math.sin(Math.PI / wallCount);

    const wallInLen = 2 * (wallLimit - wallThickness / 2) * Math.tan(Math.PI / wallCount);
    const wallOutLen = 2 * (wallLimit + wallThickness / 2) * Math.tan(Math.PI / wallCount);
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-wallInLen / 2, -wallThickness / 2);
    wallShape.lineTo(wallInLen / 2, -wallThickness / 2);
    wallShape.lineTo(wallOutLen / 2, wallThickness / 2);
    wallShape.lineTo(-wallOutLen / 2, wallThickness / 2);
    wallShape.closePath();

    const wallGeom = new THREE.ExtrudeGeometry(wallShape, {
        depth: wallHeight + 0.01,
        bevelEnabled: false,
    });
    wallGeom.rotateX(Math.PI / 2);
    wallGeom.center();

    const wallInstancedMesh = new THREE.InstancedMesh(wallGeom, wallMaterial, wallCount);
    wallInstancedMesh.castShadow = true;
    wallInstancedMesh.receiveShadow = true;
    wallInstancedMesh.frustumCulled = false;
    world.renderer.scene.add(wallInstancedMesh);

    for (let i = 0; i < wallCount; i++) {
        const angle = (i * 2 * Math.PI) / wallCount;
        const x = Math.cos(angle) * wallLimit;
        const z = Math.sin(angle) * wallLimit;

        // Visual wall instance
        const dummy = new THREE.Object3D();
        // Shifted down and slightly taller to avoid Z-fighting with floor bottom while keeping top level
        dummy.position.set(x, (wallHeight + 0.01) / 2 - floorThickness - 0.01, z);
        dummy.rotation.y = Math.PI / 2 - angle;
        dummy.updateMatrix();
        wallInstancedMesh.setMatrixAt(i, dummy.matrix);

        // Physics wall (Thicker box to prevent clipping)
        // We want the inner face to match the visual wall's inner face.
        // Visual inner face distance = wallLimit - wallThickness / 2
        const physicsCenterDist = wallLimit - wallThickness / 2 + TRAY.PHYSICS_WALL_THICKNESS / 2;
        const px = Math.cos(angle) * physicsCenterDist;
        const pz = Math.sin(angle) * physicsCenterDist;

        const wallQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - angle);
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(px, TRAY.PHYSICS_WALL_HEIGHT / 2 - floorThickness, pz)
            .setRotation(wallQuat)
            .setCcdEnabled(true);
        const body = world.physics.rapierWorld.createRigidBody(bodyDesc);
        const wallColliderDesc = RAPIER.ColliderDesc.cuboid(
            wallSideLength / 2 + 1.0,
            TRAY.PHYSICS_WALL_HEIGHT / 2,
            TRAY.PHYSICS_WALL_THICKNESS / 2
        )
            .setFriction(0.4)
            .setRestitution(0.5)
            .setCollisionGroups(COLLISION_GROUPS.WALLS | (COLLISION_GROUPS.DICE << 16))
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        world.physics.rapierWorld.createCollider(wallColliderDesc, body);
    }
}
