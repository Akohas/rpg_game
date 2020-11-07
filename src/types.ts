export type AnimationsModel = THREE.Group & {
	animations: THREE.AnimationClip[];
};

export enum Animation {
	STAND = 'stand',
	RUN = 'running',
	COLLECT = 'gathering',
	WALK_FORWARD = 'walking',
	WALK_BACKWARD = 'walking-backward'
}

export enum PlayerStates {
	WALK_FORWARD = 'WALK_FORWARD',
	WALK_BACKWARD = 'WALK_BACKWARD',
	STAND = 'STAND'
}

export type Actions = {
	[key: string]: THREE.AnimationAction;
}

export type Player = {
	object: THREE.Group;
	height: number;
	zWidth: number;
	rotation: 'left' | 'right' | null;
	state: PlayerStates;
	actions: Actions;
	animations: Animation[];
	activeAnimation: THREE.AnimationAction;
	mixer: THREE.AnimationMixer;
};

export enum PlayerRotation {
    RIGHT = 'right',
    LEFT = 'left'
}