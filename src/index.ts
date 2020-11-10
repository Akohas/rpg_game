import './styles/style.scss';

import * as THREE from 'three';
import {WEBGL} from 'three/examples/jsm/WebGL';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {OBJLoader2} from  'three/examples/jsm/loaders/OBJLoader2';
import {MTLLoader} from  'three/examples/jsm/loaders/MTLLoader';
import {MtlObjBridge} from 'three/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js';

import {getStaticFile} from './helpers';
import {Preloader} from './preloader';

import {AnimationsModel, Animation, PlayerStates, Player, PlayerRotation} from './types';
import { Vector3 } from 'three';

if (!WEBGL.isWebGLAvailable()) {
	document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

const forwardKeyCodes = ['ArrowUp', 'KeyW'];
const leftKeyCodes = ['ArrowLeft', 'KeyA'];
const rightKeyCodes = ['ArrowRight', 'KeyD'];
const backwardKeyCodes = ['ArrowDown', 'KeyS'];

class Game {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 100000);
	renderer = new THREE.WebGLRenderer({alpha: true});
	clock = new THREE.Clock();
	fbxLoader: FBXLoader;
	objectLoader: OBJLoader2;
	MTLLoader: MTLLoader;
	player: Player = {
		object: null,
		height: 0,
		zWidth: 0,
		rotation: null,
		state: null,
		actions: {},
		animations: [Animation.RUN, Animation.COLLECT, Animation.WALK_FORWARD, Animation.WALK_BACKWARD, Animation.STAND],
		activeAnimation: null,
		mixer: null
	};
	controls: OrbitControls;
	environmentProxy: THREE.Object3D;
	
	constructor() {
		const manager = new THREE.LoadingManager();
		this.fbxLoader = new FBXLoader(manager);
		this.objectLoader = new OBJLoader2(manager);
		this.MTLLoader = new MTLLoader(manager);

		new Preloader({
			manager,
			onComplete: (): void => {
				this.initCamera();
				this.render();
			}
		});

		this.init();
	}

	init = (): void => {
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		document.body.prepend(this.renderer.domElement);
		this.scene.background = new THREE.Color(0x000000);
		
		this.initLights();
		this.loadCharacter();
		this.loadEnvironment();

		window.addEventListener('keydown', this.keyPressHandler, false);
		window.addEventListener('keyup', this.keyUpHandler, false);
	}

	loadEnvironment = (): void => {
		const castShadowMeshes = ['cude-item', 'chair', 'tube', 'monitor'];

		this.MTLLoader.load(getStaticFile('models/sci-fi_room/scifi.mtl'), (materials) => {
			this.objectLoader.addMaterials(MtlObjBridge.addMaterialsFromMtlLoader(materials), true);

			this.objectLoader.load(getStaticFile('models/sci-fi_room/scifi.obj'), (object) => {
				// итерация по всем потомкам модели комнаты
				object.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.receiveShadow = true;
						child.material.side = THREE.DoubleSide;
						// Снижает яркость отражения у всех предметов сцены
						child.material.shininess = 5;

						// Можно проходить через провода
						if (child.name.includes('cable')) {
							child.userData.canGoThrough = true;
						}

						if (castShadowMeshes.some(item => child.name.includes(item))) {
							child.castShadow = true;
						}
					}
				});

				this.environmentProxy = object;
				this.scene.add(object);
			})
		})

	}

	/** Точка, в которую смотрит камера и вокруг которой вращается OrbitControls */
	getCameraTarget = (): THREE.Vector3 => {

		if (!this.player.object) {
			return new THREE.Vector3();
		}

		const targetPosition = this.player.object.position.clone();
		targetPosition.setY(targetPosition.y + this.player.height / 4 * 3);
		return targetPosition;
	}

	initCamera = (): void => {
		const CAMERA_DISTANCE = 200;
		const CAMERA_MAX_DISTANCE = 300;
		const CAMERA_MIN_DISTANCE = 50;

		const targetPosition = this.getCameraTarget();

		const targetBackwardDirection = this.player.object.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1);
		const cameraPosition = targetPosition.clone().add(targetBackwardDirection.multiplyScalar(CAMERA_DISTANCE));

		this.camera.position.add(cameraPosition);
		this.scene.add(this.camera);

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableKeys = false;
		this.controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
		this.controls.maxDistance = CAMERA_MAX_DISTANCE;
		this.controls.minDistance = CAMERA_MIN_DISTANCE;
	}

	initLights = (): void => {
		const hemispherelight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);

		const pointLight = new THREE.PointLight(0x00ff00, 1, 2000);
		pointLight.position.set(0, 220, 100);
		pointLight.castShadow = true;
		pointLight.shadow.camera.far = 2000;
	
		this.scene.add(pointLight);	
		this.scene.add(hemispherelight);	
	}

	loadCharacter = (): void => {
		this.fbxLoader.load(getStaticFile('models/astra.fbx'), (object) => {
			this.player.object = object;
	
			this.player.mixer = new THREE.AnimationMixer(this.player.object);
			this.player.object.name = 'Character';

			const {y: playerHeight, z: playerWidth} = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
			this.player.height = playerHeight;
			this.player.zWidth = playerWidth;

			this.player.object.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.castShadow = true;
					child.receiveShadow = true;

					if (child.material.length) {
						child.material.forEach((item: THREE.MeshPhongMaterial) => item.shininess = 0)
					} else {
						child.material.shininess = 0;
					}
				}
			});

			object.position.setZ(600);
			object.lookAt(0, 0, 0);
			this.scene.add(this.player.object);

			const promises = this.player.animations.map((animation) => this.loadAnimation(animation));
			Promise.all(promises).then(() => this.setState(PlayerStates.STAND));
		});
	}

	loadAnimation = (animation: Animation): Promise<undefined> => {
		return new Promise((resolve) => {
			this.fbxLoader.load(getStaticFile(`models/animations/${animation}.fbx`), (object:  AnimationsModel) => {
				const action = this.player.mixer.clipAction(object.animations[0]);
				this.player.actions[animation] = action;
				this.scene.add(object);
				resolve()
			});
		})
	}
    
    playAnimation = (animation: Animation): void => {
		const action = this.player.actions[animation];

		if (!action) {
			return;
		}

		if (this.player.activeAnimation) {
			this.player.activeAnimation.fadeOut(.2)
		}
	
        action.reset()
        action.fadeIn(.2)
		action.play()
		
		this.player.activeAnimation = action;
	}

	setState = (state: PlayerStates): void => {
		switch(state) {
			case PlayerStates.WALK_FORWARD:
				if (this.player.state !== PlayerStates.WALK_FORWARD) {
					this.player.state = PlayerStates.WALK_FORWARD;
					this.playAnimation(Animation.WALK_FORWARD)
				}
				return;
			case PlayerStates.WALK_BACKWARD:
				if (this.player.state !== PlayerStates.WALK_BACKWARD) {
					this.player.state = PlayerStates.WALK_BACKWARD;
					this.playAnimation(Animation.WALK_BACKWARD)
				}
				return;
			case PlayerStates.STAND:
				if (this.player.state !== PlayerStates.STAND) {
					this.player.state = PlayerStates.STAND;
					this.playAnimation(Animation.STAND)
				}
				return;
			default:
				this.player.state = PlayerStates.STAND;
				this.playAnimation(Animation.STAND);
				return;
		}
	}
	
	keyPressHandler = (event: KeyboardEvent): void => {
		if (forwardKeyCodes.includes(event.code)) {
			this.setState(PlayerStates.WALK_FORWARD);
		}

		if (backwardKeyCodes.includes(event.code)) {
			this.setState(PlayerStates.WALK_BACKWARD);
		}

		if (leftKeyCodes.includes(event.code)) {
			this.player.rotation = PlayerRotation.LEFT;
		}

		if (rightKeyCodes.includes(event.code)) {
			this.player.rotation = PlayerRotation.RIGHT;
		}
	}

	keyUpHandler = (event: KeyboardEvent): void => {
		if (forwardKeyCodes.includes(event.code)) {
			this.setState(PlayerStates.STAND);
		}
	
		if (backwardKeyCodes.includes(event.code)) {
			this.setState(PlayerStates.STAND);
		}

		if (leftKeyCodes.includes(event.code)) {
			this.player.rotation = null;
		}

		if (rightKeyCodes.includes(event.code)) {
			this.player.rotation = null;
		}
	}

	movePlayer = (delta: number): void => {
		if(this.player.state !== PlayerStates.WALK_FORWARD && this.player.state !== PlayerStates.WALK_BACKWARD) {
			return;
		}

		const position = this.player.object.position.clone();
		const movingDirection = this.player.state === PlayerStates.WALK_BACKWARD ? -1 : 1;
		const direction = this.player.object.getWorldDirection(new THREE.Vector3()).multiplyScalar(movingDirection);
		const raycaster = new THREE.Raycaster(position, direction);
		let blocked = false;

		for(const box of this.environmentProxy.children) {
			const intersect = raycaster.intersectObject(box);

			if (intersect.length && !box.userData.canGoThrough) {
				if (intersect[0].distance < this.player.zWidth) {
					blocked = true;
					break;
				}
			}
		}

		if(!blocked) {
			const speed = this.player.state === PlayerStates.WALK_BACKWARD ? 100 : 150
			const offset = direction.multiplyScalar(speed * delta);

			this.player.object.position.add(offset);
			this.camera.position.add(offset)

			const target = this.getCameraTarget();
			this.controls.target.set(target.x, target.y, target.z);
		}
	}

	render = (): void => {
		requestAnimationFrame(this.render);
		const delta = this.clock.getDelta()
		const rotationSpeed = 3;

		if (this.player.rotation == PlayerRotation.LEFT) {
			this.player.object.rotateY(rotationSpeed * delta)
		}

		if (this.player.rotation == PlayerRotation.RIGHT) {
			this.player.object.rotateY(-(rotationSpeed * delta))
		}

		if(this.player.state == PlayerStates.WALK_FORWARD || this.player.state == PlayerStates.WALK_BACKWARD) {
			this.movePlayer(delta);
		}

		this.player.mixer && this.player.mixer.update(delta);
		this.renderer.render(this.scene, this.camera);  
	}
}


/** for console debug */
// @ts-ignore
window.THREE = THREE;
// @ts-ignore
window.game = new Game();