export type Vector3 = [number, number, number];

export enum ObjectType {
  CUBE = 'CUBE',
  SPHERE = 'SPHERE',
  PLANE = 'PLANE',
  TORUS = 'TORUS',
  CONE = 'CONE',
  CAMERA = 'CAMERA',
  LIGHT = 'LIGHT',
  TEXT = 'TEXT',
  GLTF = 'GLTF'
}

// --- LOGIC SYSTEM TYPES ---

export type LogicTriggerType = 'ON_START' | 'ON_CLICK' | 'ON_HOVER';
export type LogicActionType = 'MOVE' | 'ROTATE' | 'SCALE' | 'COLOR' | 'WAIT' | 'VISIBLE';

export interface LogicAction {
  id: string;
  type: LogicActionType;
  params: Record<string, any>;
}

export interface LogicEvent {
  id: string;
  type: LogicTriggerType;
  actions: LogicAction[];
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  color: string;
  visible: boolean;
  logicData: LogicEvent[];
  
  // Specific properties
  modelData?: string; // Base64 data for GLTF
  lightIntensity?: number;
  text?: string;
}

export const DEFAULT_LOGIC: LogicEvent[] = [
  { id: 'start_event', type: 'ON_START', actions: [] },
  { id: 'click_event', type: 'ON_CLICK', actions: [] }
];