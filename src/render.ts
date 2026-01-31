// MIT license: https://d20.zip/license.txt
// https://github.com/DenWav/d20.zip

import { THREE, OrbitControls } from './vendor.js';
import { SCENE } from './constants.js';
import { mulberry32 } from './util.js';
import { PCFShadowMap, PCFSoftShadowMap, VSMShadowMap } from 'three/src/constants';

export class Renderer {
    public readonly renderer: THREE.WebGLRenderer = this.initRenderer();
    public readonly camera: THREE.PerspectiveCamera = this.initCamera();
    public readonly scene: THREE.Scene = this.initScene();
    public readonly controls: OrbitControls = this.initControls();

    constructor(private readonly canvas: HTMLCanvasElement) {
        this.renderer = this.initRenderer();
        this.camera = this.initCamera();
        this.scene = this.initScene();
        this.controls = this.initControls();

        this.initEnvironment();
    }

    private initRenderer() {
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
            if (!renderer.getContext()) {
                // noinspection ExceptionCaughtLocallyJS - We aren't only catching this exception
                throw new Error('WebGL context not available');
            }
        } catch (e) {
            const webglErrorEl = document.getElementById('webgl-error');
            if (webglErrorEl) {
                webglErrorEl.style.display = 'block';
            }
            throw e;
        }

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        return renderer;
    }

    private initCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            SCENE.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            SCENE.CAMERA.NEAR,
            SCENE.CAMERA.FAR
        );
        camera.position.set(SCENE.CAMERA.INITIAL_POS.X, SCENE.CAMERA.INITIAL_POS.Y, SCENE.CAMERA.INITIAL_POS.Z);
        camera.lookAt(0, 0, 0);

        return camera;
    }

    private initScene(): THREE.Scene {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(SCENE.BACKGROUND_COLOR);

        this.setupLighting(scene);

        return scene;
    }

    private setupLighting(scene: THREE.Scene) {
        const ambientLight = new THREE.AmbientLight(SCENE.LIGHTS.AMBIENT.COLOR, SCENE.LIGHTS.AMBIENT.INTENSITY);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(
            SCENE.LIGHTS.DIRECTIONAL.COLOR,
            SCENE.LIGHTS.DIRECTIONAL.INTENSITY
        );
        directionalLight.position.set(
            SCENE.LIGHTS.DIRECTIONAL.POS.X,
            SCENE.LIGHTS.DIRECTIONAL.POS.Y,
            SCENE.LIGHTS.DIRECTIONAL.POS.Z
        );
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = SCENE.LIGHTS.DIRECTIONAL.SHADOW.CAMERA.LEFT;
        directionalLight.shadow.camera.right = SCENE.LIGHTS.DIRECTIONAL.SHADOW.CAMERA.RIGHT;
        directionalLight.shadow.camera.top = SCENE.LIGHTS.DIRECTIONAL.SHADOW.CAMERA.TOP;
        directionalLight.shadow.camera.bottom = SCENE.LIGHTS.DIRECTIONAL.SHADOW.CAMERA.BOTTOM;
        directionalLight.shadow.camera.near = SCENE.LIGHTS.DIRECTIONAL.SHADOW.CAMERA.NEAR;
        directionalLight.shadow.camera.far = SCENE.LIGHTS.DIRECTIONAL.SHADOW.CAMERA.FAR;
        directionalLight.shadow.mapSize.width = SCENE.LIGHTS.DIRECTIONAL.SHADOW.MAP_SIZE;
        directionalLight.shadow.mapSize.height = SCENE.LIGHTS.DIRECTIONAL.SHADOW.MAP_SIZE;
        directionalLight.shadow.radius = SCENE.LIGHTS.DIRECTIONAL.SHADOW.RADIUS;
        directionalLight.shadow.bias = SCENE.LIGHTS.DIRECTIONAL.SHADOW.BIAS;
        scene.add(directionalLight);

        // Secondary light for more depth
        const fillLight = new THREE.DirectionalLight(SCENE.LIGHTS.FILL.COLOR, SCENE.LIGHTS.FILL.INTENSITY);
        fillLight.position.set(
            SCENE.LIGHTS.FILL.POSITION.X,
            SCENE.LIGHTS.FILL.POSITION.Y,
            SCENE.LIGHTS.FILL.POSITION.Z
        );
        scene.add(fillLight);
    }

    private initControls(): OrbitControls {
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
        controls.mouseButtons.MIDDLE = null;

        controls.touches.ONE = THREE.TOUCH.PAN;
        controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

        controls.enableDamping = true;
        controls.screenSpacePanning = false;

        return controls;
    }

    private initEnvironment() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        // Create a simple procedural environment map (gradient)
        function createEnvironmentMap() {
            const rng = mulberry32(98765);
            const scene = new THREE.Scene();
            const geom = new THREE.SphereGeometry(1, 64, 32);
            const mat = new THREE.ShaderMaterial({
                side: THREE.BackSide,
                uniforms: {
                    topColor: { value: new THREE.Color(SCENE.ENVIRONMENT.TOP_COLOR) },
                    bottomColor: { value: new THREE.Color(SCENE.ENVIRONMENT.BOTTOM_COLOR) },
                    offset: { value: SCENE.ENVIRONMENT.OFFSET },
                    exponent: { value: SCENE.ENVIRONMENT.EXPONENT },
                },
                vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
                fragmentShader: `
            varying vec3 vWorldPosition;
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
            });
            const mesh = new THREE.Mesh(geom, mat);
            scene.add(mesh);

            // Add some random bright points to the env map for highlights
            for (let i = 0; i < SCENE.ENVIRONMENT.POINT_LIGHT_COUNT; i++) {
                const light = new THREE.PointLight(
                    SCENE.ENVIRONMENT.POINT_LIGHT_COLOR,
                    SCENE.ENVIRONMENT.POINT_LIGHT_INTENSITY
                );
                light.position.set((rng() - 0.5) * 2, rng() * 2, (rng() - 0.5) * 2);
                scene.add(light);
            }

            const renderTarget = pmremGenerator.fromScene(scene);
            return renderTarget.texture;
        }

        this.scene.environment = createEnvironmentMap();
        this.scene.environment.mapping = THREE.EquirectangularReflectionMapping;
    }
}
