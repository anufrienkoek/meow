import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { SceneObject, ObjectType, Vector3 } from '../types';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private fpsControls: PointerLockControls;
  private transformControls: TransformControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private objectsMap: Map<string, THREE.Object3D>;
  private mountPoint: HTMLElement;
  private onObjectSelect: (id: string | null) => void;
  private onTransformChange: (id: string, updates: Partial<SceneObject>) => void;
  private animationFrameId: number | null = null;
  private isSimulating: boolean = false;
  private resizeObserver: ResizeObserver;
  private gltfLoader: GLTFLoader;
  private pointerDownHandler: (event: PointerEvent) => void;
  private keyDownHandler: (event: KeyboardEvent) => void;
  private keyUpHandler: (event: KeyboardEvent) => void;
  private fpsClickHandler: () => void;

  // FPS Movement State
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private prevTime = performance.now();
  private isFPSMode = false;

  constructor(
      mountPoint: HTMLElement, 
      onObjectSelect: (id: string | null) => void,
      onTransformChange: (id: string, updates: Partial<SceneObject>) => void
  ) {
    this.mountPoint = mountPoint;
    this.onObjectSelect = onObjectSelect;
    this.onTransformChange = onTransformChange;
    this.objectsMap = new Map();
    this.gltfLoader = new GLTFLoader();
    this.pointerDownHandler = (event: PointerEvent) => this.onPointerDown(event);
    this.keyDownHandler = (event: KeyboardEvent) => {
        if (!this.isFPSMode) return;
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.moveForward = true; break;
            case 'ArrowLeft':
            case 'KeyA': this.moveLeft = true; break;
            case 'ArrowDown':
            case 'KeyS': this.moveBackward = true; break;
            case 'ArrowRight':
            case 'KeyD': this.moveRight = true; break;
        }
    };
    this.keyUpHandler = (event: KeyboardEvent) => {
        if (!this.isFPSMode) return;
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.moveForward = false; break;
            case 'ArrowLeft':
            case 'KeyA': this.moveLeft = false; break;
            case 'ArrowDown':
            case 'KeyS': this.moveBackward = false; break;
            case 'ArrowRight':
            case 'KeyD': this.moveRight = false; break;
        }
    };
    this.fpsClickHandler = () => {
        if (this.isFPSMode && !this.fpsControls.isLocked) {
            this.fpsControls.lock();
        }
    };

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f7);
    
    // Grid Helper (Subtle)
    const gridHelper = new THREE.GridHelper(50, 50, 0xcccccc, 0xe5e5e5);
    this.scene.add(gridHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Camera
    const width = mountPoint.clientWidth || 1;
    const height = mountPoint.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(5, 5, 5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    if (mountPoint.firstChild) {
        mountPoint.removeChild(mountPoint.firstChild);
    }
    mountPoint.appendChild(this.renderer.domElement);

    // Orbit Controls (Editor Mode)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // FPS Controls (Sim Mode)
    this.fpsControls = new PointerLockControls(this.camera, document.body);

    // Transform Controls (Gizmo)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.addEventListener('dragging-changed', (event) => {
        this.controls.enabled = !event.value;
        if (!event.value) {
            const object = this.transformControls.object;
            if (object && object.userData.id) {
                this.onTransformChange(object.userData.id, {
                    position: [object.position.x, object.position.y, object.position.z],
                    rotation: [
                        THREE.MathUtils.radToDeg(object.rotation.x), 
                        THREE.MathUtils.radToDeg(object.rotation.y), 
                        THREE.MathUtils.radToDeg(object.rotation.z)
                    ],
                    scale: [object.scale.x, object.scale.y, object.scale.z]
                });
            }
        }
    });
    this.scene.add(this.transformControls);

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupEventListeners();
    
    // Auto Resize Observer
    this.resizeObserver = new ResizeObserver(() => {
        this.onWindowResize();
    });
    this.resizeObserver.observe(mountPoint);

    this.animate();
  }

  private setupEventListeners() {
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDownHandler);
    
    // FPS Keys
    document.addEventListener('keydown', this.keyDownHandler);

    document.addEventListener('keyup', this.keyUpHandler);
    
    // Lock pointer on click if simulation is running and we are in FPS mode
    this.renderer.domElement.addEventListener('click', this.fpsClickHandler);
  }

  private onPointerDown(event: PointerEvent) {
    if (this.isSimulating) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const objectsArray = Array.from(this.objectsMap.values());
    const intersects = this.raycaster.intersectObjects(objectsArray, true); 

    if (intersects.length > 0) {
      let selected: THREE.Object3D | null = intersects[0].object;
      while (selected && !selected.userData.id && selected.parent) {
          selected = selected.parent;
      }

      if (selected && selected.userData.id) {
          this.onObjectSelect(selected.userData.id);
          this.highlightObjectById(selected.userData.id);
      }
    } else {
      this.onObjectSelect(null);
      this.highlightObjectById(null);
    }
  }

  // ... (Highlight, Transform methods remain the same) ...
  public getIntersectedObjectId(event: MouseEvent): string | null {
     const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    const objectsArray = Array.from(this.objectsMap.values());
    const intersects = this.raycaster.intersectObjects(objectsArray, true);
    
    if (intersects.length > 0) {
        let selected: THREE.Object3D | null = intersects[0].object;
        while (selected && !selected.userData.id && selected.parent) {
            selected = selected.parent;
        }
        return selected?.userData.id || null;
    }
    return null;
  }

  public highlightObjectById(id: string | null) {
    this.clearHighlight();
    if (!id) {
        this.transformControls.detach();
        return;
    }
    const object = this.objectsMap.get(id);
    if (object) {
      object.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive.setHex(0x007AFF);
              child.material.emissiveIntensity = 0.4;
          }
      });
      if (!this.isSimulating) {
        this.transformControls.attach(object);
      }
    } else {
        this.transformControls.detach();
    }
  }

  public setTransformMode(mode: 'translate' | 'rotate' | 'scale') {
      this.transformControls.setMode(mode);
  }

  public setSnap(enabled: boolean) {
      this.transformControls.setTranslationSnap(enabled ? 0.5 : null);
      this.transformControls.setRotationSnap(enabled ? THREE.MathUtils.degToRad(15) : null);
  }

  public setSpace(space: 'world' | 'local') {
      this.transformControls.setSpace(space);
  }

  private clearHighlight() {
     this.objectsMap.forEach(obj => {
        obj.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                child.material.emissive.setHex(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });
    });
  }

  public moveSelectedObjectByArrow(xDir: number, yDir: number, step: number) {
      const object = this.transformControls.object;
      if (!object || !object.userData.id) return;
      // ... same implementation as before ...
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      let forward = new THREE.Vector3();
      if (Math.abs(direction.x) > Math.abs(direction.z)) {
          forward.set(Math.sign(direction.x), 0, 0);
      } else {
          forward.set(0, 0, Math.sign(direction.z));
      }
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
      const move = new THREE.Vector3().addScaledVector(right, xDir).addScaledVector(forward, yDir).multiplyScalar(step);
      object.position.add(move);
      this.onTransformChange(object.userData.id, {
          position: [object.position.x, object.position.y, object.position.z]
      });
  }

  public resize() {
      this.onWindowResize();
  }

  public getCanvas(): HTMLCanvasElement {
      return this.renderer.domElement;
  }

  public getStatistics() {
      // ... same statistics implementation ...
      let triangles = 0;
      let points = 0;
      this.objectsMap.forEach(obj => {
          obj.traverse((child) => {
             if (child instanceof THREE.Mesh && child.geometry) {
                 triangles += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
                 points += child.geometry.attributes.position.count;
             }
          });
      });
      return { objects: this.objectsMap.size, triangles: Math.floor(triangles), points: points };
  }

  private onWindowResize() {
    if (!this.mountPoint) return;
    const width = this.mountPoint.clientWidth;
    const height = this.mountPoint.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setSize(width, height);
  }

  // --- Animation Loop with FPS Logic ---
  private animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    
    const time = performance.now();
    const delta = (time - this.prevTime) / 1000;

    if (this.isFPSMode && this.fpsControls.isLocked) {
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= this.velocity.y * 10.0 * delta; // Gravity-ish or drag

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize(); // Ensure consistent speed in all directions

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 100.0 * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 100.0 * delta;

        this.fpsControls.moveRight(-this.velocity.x * delta);
        this.fpsControls.moveForward(-this.velocity.z * delta);
        
        // Optional: Simple "Flying" vertical movement with camera look direction if looking up/down
        // For true FPS we'd need collision with floor, but for a scene editor, flying is better.
        // The PointerLockControls moveForward moves along the camera vector, so Y is handled automatically if looking up/down.
    } else {
        this.controls.update();
    }
    
    this.prevTime = time;
    this.renderer.render(this.scene, this.camera);
  }

  // --- Object Management ---

  public syncScene(objects: SceneObject[]) {
     // ... same sync implementation ...
      const newIds = new Set(objects.map(o => o.id));
      const idsToRemove: string[] = [];
      this.objectsMap.forEach((_, id) => {
          if (!newIds.has(id)) idsToRemove.push(id);
      });
      idsToRemove.forEach(id => this.removeObject(id));
      objects.forEach(obj => {
          if (this.objectsMap.has(obj.id)) {
              this.updateObject(obj.id, obj);
          } else {
              this.addObject(obj);
          }
      });
  }

  public addObject(objData: SceneObject) {
    if (objData.type === ObjectType.GLTF && objData.modelData) {
        this.gltfLoader.parse(
            this.base64ToArrayBuffer(objData.modelData), 
            '', 
            (gltf) => {
                const model = gltf.scene;
                this.setupObject(model, objData);
            },
            (err) => console.error("GLTF Load Error", err)
        );
        return;
    }

    let geometry;
    let material: THREE.Material = new THREE.MeshStandardMaterial({ 
        color: objData.color,
        transparent: true,
        opacity: 1
    });
    let mesh: THREE.Object3D;

    switch (objData.type) {
      case ObjectType.CUBE: geometry = new THREE.BoxGeometry(); break;
      case ObjectType.SPHERE: geometry = new THREE.SphereGeometry(0.6, 32, 32); break;
      case ObjectType.PLANE: geometry = new THREE.PlaneGeometry(1, 1); break;
      case ObjectType.TORUS: geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100); break;
      case ObjectType.CONE: geometry = new THREE.ConeGeometry(0.5, 1, 32); break;
      
      case ObjectType.LIGHT:
        const light = new THREE.PointLight(objData.color, 1, 100);
        const bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: objData.color });
        mesh = new THREE.Mesh(bulbGeo, bulbMat);
        mesh.add(light);
        break;

      case ObjectType.CAMERA:
        geometry = new THREE.BoxGeometry(0.5, 0.5, 0.8);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 0.4;
        mesh = new THREE.Mesh(geometry, material);
        mesh.add(lens);
        break;

      case ObjectType.TEXT:
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
            canvas.width = 256;
            canvas.height = 128;
            context.fillStyle = objData.color;
            context.font = "bold 60px Arial";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("TEXT", 128, 64);
        }
        const tex = new THREE.CanvasTexture(canvas);
        material = new THREE.SpriteMaterial({ map: tex, color: 0xffffff });
        mesh = new THREE.Sprite(material as THREE.SpriteMaterial);
        mesh.scale.set(2, 1, 1);
        break;

      default: geometry = new THREE.BoxGeometry();
    }

    if (!mesh!) {
       mesh = new THREE.Mesh(geometry, material);
    }
    this.setupObject(mesh, objData);
  }

  private setupObject(object: THREE.Object3D, objData: SceneObject) {
    object.position.set(...objData.position);
    object.rotation.set(
        THREE.MathUtils.degToRad(objData.rotation[0]),
        THREE.MathUtils.degToRad(objData.rotation[1]),
        THREE.MathUtils.degToRad(objData.rotation[2])
    );
    object.scale.set(...objData.scale);
    object.visible = objData.visible;
    object.userData = { id: objData.id, type: objData.type }; // Store type to find camera later
    
    object.castShadow = true;
    object.receiveShadow = true;
    
    object.traverse(child => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.userData.id = objData.id; 
            if (!child.material) child.material = new THREE.MeshStandardMaterial({color: 0xcccccc});
        }
    });

    this.scene.add(object);
    this.objectsMap.set(objData.id, object);
  }

  public updateObject(id: string, data: Partial<SceneObject>) {
    // ... same update implementation ...
    const object = this.objectsMap.get(id);
    if (!object) return;
    if (data.position) object.position.set(...data.position);
    if (data.rotation) object.rotation.set(THREE.MathUtils.degToRad(data.rotation[0]), THREE.MathUtils.degToRad(data.rotation[1]), THREE.MathUtils.degToRad(data.rotation[2]));
    if (data.scale) object.scale.set(...data.scale);
    if (data.visible !== undefined) object.visible = data.visible;
    if (data.color) {
        object.traverse(child => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                child.material.color.set(data.color);
            } else if (child instanceof THREE.Light) {
                child.color.set(data.color);
            }
        });
    }
  }

  public removeObject(id: string) {
    // ... same remove ...
    const object = this.objectsMap.get(id);
    if (object) {
      if (this.transformControls.object === object) {
          this.transformControls.detach();
      }
      this.scene.remove(object);
      this.objectsMap.delete(id);
    }
  }

  public getMesh(id: string): THREE.Mesh | undefined {
    const obj = this.objectsMap.get(id);
    if (obj instanceof THREE.Mesh) return obj;
    let found: THREE.Mesh | undefined;
    obj?.traverse(child => {
        if (!found && child instanceof THREE.Mesh) found = child;
    });
    return found;
  }

  public setSimulating(simulating: boolean) {
    this.isSimulating = simulating;
    this.clearHighlight();

    if (simulating) {
        this.transformControls.detach();
        
        // Find a Camera Object
        let cameraObj: THREE.Object3D | null = null;
        for(const obj of this.objectsMap.values()) {
            if (obj.userData.type === ObjectType.CAMERA) {
                cameraObj = obj;
                break;
            }
        }

        if (cameraObj) {
            // Enter FPS Mode
            this.isFPSMode = true;
            this.controls.enabled = false; // Disable orbit
            
            // Sync Position
            this.camera.position.copy(cameraObj.position);
            this.camera.rotation.copy(cameraObj.rotation);
            
            // Lock Pointer immediately if possible, or wait for click
            this.fpsControls.lock();
            
            // Hide the camera object mesh itself so we don't see the inside of the box
            cameraObj.visible = false; 
        }

    } else {
        // Exit FPS Mode
        this.isFPSMode = false;
        this.controls.enabled = true;
        this.fpsControls.unlock();
        this.velocity.set(0,0,0);
        
        // Restore Camera Object Visibility
        for(const obj of this.objectsMap.values()) {
            if (obj.userData.type === ObjectType.CAMERA) {
                obj.visible = true; // or whatever logic visible state was
            }
        }
        
        // Reset Camera to a default-ish position or keep it? 
        // Keeping it allows "fly to edit", but let's reset to see the whole scene
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0,0,0);
    }
  }

  public dispose() {
    this.resizeObserver.disconnect();
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.renderer.domElement.removeEventListener('pointerdown', this.pointerDownHandler);
    this.renderer.domElement.removeEventListener('click', this.fpsClickHandler);
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    this.transformControls.dispose();
    this.controls.dispose();
    this.fpsControls.dispose(); // Dispose FPS controls
    this.renderer.dispose();
    if (this.mountPoint && this.renderer.domElement.parentNode === this.mountPoint) {
        this.mountPoint.removeChild(this.renderer.domElement);
    }
  }

  private base64ToArrayBuffer(base64: string) {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private getPixelRatio() {
    const ratio = window.devicePixelRatio || 1;
    const isMobile = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return isMobile ? Math.min(ratio, 2) : ratio;
  }
}
