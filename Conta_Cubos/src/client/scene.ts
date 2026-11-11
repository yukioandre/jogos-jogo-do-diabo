import * as THREE from 'three';
import { CAMERA_ELEVATION_DEG } from '../shared/shapes';

/** Uma cor por camada (altura). Cores vizinhas bem diferentes para facilitar a contagem. */
export const LAYER_COLORS = [
  '#4f8ef7',
  '#f2a93b',
  '#3fbf7f',
  '#e5566d',
  '#9b6dde',
  '#2ec4c9',
  '#f27c3b',
  '#a3c43a',
  '#d65db1',
  '#8a8f99',
];

const ROTATION_SPEED = (2 * Math.PI) / 36; // uma volta a cada 36 s

function makeFaceTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 7;
  ctx.strokeRect(3.5, 3.5, 121, 121);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeGroundTexture(nx: number, nz: number): THREE.Texture {
  const px = 48;
  const c = document.createElement('canvas');
  c.width = nx * px;
  c.height = nz * px;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d9dde4';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#9aa2ae';
  ctx.lineWidth = 2;
  for (let x = 0; x <= nx; x++) {
    ctx.beginPath();
    ctx.moveTo(x * px, 0);
    ctx.lineTo(x * px, c.height);
    ctx.stroke();
  }
  for (let z = 0; z <= nz; z++) {
    ctx.beginPath();
    ctx.moveTo(0, z * px);
    ctx.lineTo(c.width, z * px);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class CubeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  private group = new THREE.Group();
  private faceTexture = makeFaceTexture();
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private target = new THREE.Vector3();
  private distance = 20;
  private last = performance.now();
  private spinning = true;
  currentId: number | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(6, 14, 9);
    this.scene.add(sun);
    this.scene.add(this.group);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  private placeCamera() {
    const el = (CAMERA_ELEVATION_DEG * Math.PI) / 180;
    // com tela estreita (celular), afasta a câmera para caber a largura
    const d = this.distance * Math.max(1, 1.1 / this.camera.aspect);
    this.camera.position.set(0, this.target.y + Math.sin(el) * d, Math.cos(el) * d);
    this.camera.lookAt(this.target);
  }

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.spinning) this.group.rotation.y += dt * ROTATION_SPEED;
    this.renderer.render(this.scene, this.camera);
  }

  setSpinning(on: boolean) {
    this.spinning = on;
  }

  clear() {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      if (child instanceof THREE.Mesh) {
        if (child.geometry !== this.boxGeometry) child.geometry.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (m.map && m.map !== this.faceTexture) m.map.dispose();
          m.dispose();
        }
      }
    }
    this.currentId = null;
  }

  setShape(id: number, nx: number, nz: number, heights: number[]) {
    if (this.currentId === id) return;
    this.clear();
    this.currentId = id;
    this.group.rotation.y = Math.PI / 5;

    const total = heights.reduce((a, b) => a + b, 0);
    const maxH = Math.max(1, ...heights);
    const material = new THREE.MeshLambertMaterial({ map: this.faceTexture });
    const mesh = new THREE.InstancedMesh(this.boxGeometry, material, Math.max(1, total));
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    let i = 0;
    for (let z = 0; z < nz; z++)
      for (let x = 0; x < nx; x++) {
        const h = heights[x + z * nx];
        for (let y = 0; y < h; y++) {
          m.makeTranslation(x - nx / 2 + 0.5, y + 0.5, z - nz / 2 + 0.5);
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, color.set(LAYER_COLORS[y % LAYER_COLORS.length]));
          i++;
        }
      }
    mesh.count = total;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(nx, nz),
      new THREE.MeshLambertMaterial({ map: makeGroundTexture(nx, nz) }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.002;
    this.group.add(ground);

    // enquadra a figura inteira em qualquer ângulo de rotação
    const halfDiag = Math.hypot(nx, nz) / 2;
    const radius = Math.hypot(halfDiag, maxH / 2);
    const fov = (this.camera.fov * Math.PI) / 180;
    this.distance = (radius / Math.sin(fov / 2)) * 1.05;
    this.target.set(0, maxH * 0.4, 0);
    this.placeCamera();
  }
}
