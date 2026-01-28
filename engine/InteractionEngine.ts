import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { SceneObject } from '../types';

interface CompiledBehavior {
  onStart?: () => Promise<void>;
  onClick?: () => Promise<void>;
  onHover?: () => Promise<void>;
  onKey?: (key: string) => Promise<void>;
}

export class InteractionEngine {
  private sceneManager: SceneManager;
  private behaviors: Map<string, CompiledBehavior>;
  private isRunning: boolean = false;
  private cleanupFunctions: Function[] = [];

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.behaviors = new Map();
  }

  public async start(objects: SceneObject[], codeMap: Map<string, string>) {
    this.isRunning = true;
    this.behaviors.clear();

    // Compile code for each object
    for (const obj of objects) {
      const code = codeMap.get(obj.id);
      if (code) {
        console.log(`Compiling code for ${obj.name}`);
        const behavior = this.compileCode(obj.id, code);
        this.behaviors.set(obj.id, behavior);
      }
    }

    // Bind interaction events directly to the SceneManager's canvas
    const canvas = this.sceneManager.getCanvas();
    if (canvas) {
      const clickHandler = (e: MouseEvent) => this.handleClick(e);
      const keyHandler = (e: KeyboardEvent) => this.handleKey(e);
      
      canvas.addEventListener('click', clickHandler);
      window.addEventListener('keydown', keyHandler); // Use window for keys to ensure capture
      
      this.cleanupFunctions.push(() => canvas.removeEventListener('click', clickHandler));
      this.cleanupFunctions.push(() => window.removeEventListener('keydown', keyHandler));
    } else {
        console.error("InteractionEngine: Could not find canvas to bind events.");
    }

    // Run onStart for all objects
    const startPromises: Promise<void>[] = [];
    this.behaviors.forEach((behavior, id) => {
      if (behavior.onStart) {
        // We catch errors individually so one failure doesn't stop the whole scene
        startPromises.push(
            behavior.onStart().catch(err => {
                console.error(`Error executing onStart for object ${id}:`, err);
            })
        );
      }
    });

    await Promise.all(startPromises);
  }

  public stop() {
    this.isRunning = false;
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
    this.behaviors.clear();
  }

  private handleClick(e: MouseEvent) {
    if (!this.isRunning) return;
    // Calculate intersection
    const id = this.sceneManager.getIntersectedObjectId(e);
    if (id) {
      const behavior = this.behaviors.get(id);
      if (behavior && behavior.onClick) {
        behavior.onClick().catch(err => {
            console.error(`Error executing onClick for object ${id}:`, err);
        });
      }
    }
  }

  private handleKey(e: KeyboardEvent) {
    if (!this.isRunning) return;
    this.behaviors.forEach(behavior => {
        if (behavior.onKey) {
            behavior.onKey(e.key).catch(err => {
                console.error("Error executing onKey:", err);
            });
        }
    });
  }

  private compileCode(objectId: string, code: string): CompiledBehavior {
    const mesh = this.sceneManager.getMesh(objectId);
    if (!mesh) return {};

    // Context for the execution - these functions capture 'this' (InteractionEngine instance)
    const context = {
      // Motion
      moveBy: async (axis: 'x'|'y'|'z', amount: number) => {
        if (!this.isRunning) return;
        const target = mesh.position[axis] + amount;
        await this.animateProperty(mesh.position, axis, target, 30);
      },
      moveTo: async (x: number, y: number, z: number, seconds: number) => {
         if (!this.isRunning) return;
         if (seconds <= 0) {
             mesh.position.set(x, y, z);
             return;
         }
         // Parallel animation for X, Y, Z
         const frames = seconds * 60;
         const startX = mesh.position.x;
         const startY = mesh.position.y;
         const startZ = mesh.position.z;
         
         for(let i=1; i<=frames; i++) {
             if (!this.isRunning) return;
             const t = i/frames; // Linear. Could use ease out
             mesh.position.set(
                 THREE.MathUtils.lerp(startX, x, t),
                 THREE.MathUtils.lerp(startY, y, t),
                 THREE.MathUtils.lerp(startZ, z, t)
             );
             await new Promise(r => setTimeout(r, 16));
         }
      },
      rotateBy: async (axis: 'x'|'y'|'z', amount: number) => {
         if (!this.isRunning) return;
         const rad = THREE.MathUtils.degToRad(amount);
         // Rotate on axis relative to world or local? 
         // Simple rotation property update for now
         const current = mesh.rotation[axis];
         await this.animateProperty(mesh.rotation, axis, current + rad, 30);
      },
      setScale: (scale: number) => {
        mesh.scale.set(scale, scale, scale);
      },
      // Looks
      setColor: (color: string) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.color.set(color);
        }
      },
      setOpacity: (opacity: number) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
             mesh.material.transparent = true;
             mesh.material.opacity = opacity / 100;
             mesh.material.needsUpdate = true;
        }
      },
      setVisible: (visible: boolean) => {
          mesh.visible = visible;
      },
      // Control
      wait: (seconds: number) => {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
      }
    };

    try {
      // We inject a specialized 'events' object that accumulates handlers
      // The generated code assigns functions to these handlers
      // We destructure context so functions are available as direct variables (moveBy vs this.moveBy)
      const createBehavior = new Function('context', `
        const events = {
            onStart: null,
            onClick: null,
            onHover: null,
            onKeyHandlers: [] 
        };
        const { moveBy, moveTo, rotateBy, setScale, setColor, setOpacity, setVisible, wait } = context;
        
        const onKeyPress = (key, handler) => {
            events.onKeyHandlers.push({ key: key.toLowerCase(), handler });
        };

        const api = {
          moveBy, moveTo, rotateBy, setScale, setColor, setOpacity, setVisible, wait, onKeyPress
        };
        
        // Execute Code
        // The code inside uses 'moveBy', 'rotateBy' etc directly from closure scope
        (async function() {
           try {
             ${code}
           } catch(e) {
             console.error("Runtime error during behavior initialization:", e);
           }
        }).call(api);

        // Convert key handlers array to a single dispatcher
        if (events.onKeyHandlers.length > 0) {
            events.onKey = async (pressedKey) => {
                const k = pressedKey.toLowerCase();
                for(const h of events.onKeyHandlers) {
                    if (h.key === k) await h.handler();
                }
            }
        }

        return events;
      `);

      return createBehavior(context);
    } catch (err) {
      console.error(`Error compiling behavior for object ${objectId}`, err);
      return {};
    }
  }

  // Simple linear interpolation animation helper
  private async animateProperty(target: any, prop: string, endValue: number, frames: number) {
      const startValue = target[prop];
      for(let i=1; i<=frames; i++) {
         if (!this.isRunning) return;
         const t = i / frames;
         // Ease out cubic
         const ease = 1 - Math.pow(1 - t, 3); 
         target[prop] = THREE.MathUtils.lerp(startValue, endValue, ease);
         await new Promise(r => setTimeout(r, 16));
      }
  }
}