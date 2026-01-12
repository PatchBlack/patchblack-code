import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/PatchBlack/patchblack-code@main';

// ===== DEVICE DETECTION =====
function isTouchDevice() {
  return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
}

function shouldRotateBoombox() {
  const isTouch = isTouchDevice();
  const isPortrait = window.innerHeight > window.innerWidth;
  return isTouch && (isPortrait || window.innerWidth <= 768);
}

// ===== CHROMATIC ABERRATION SHADER =====
const ChromaticAberrationShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'amount': { value: 0.002 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 offset = amount * (vUv - 0.5);
      vec4 cr = texture2D(tDiffuse, vUv + offset);
      vec4 cga = texture2D(tDiffuse, vUv);
      vec4 cb = texture2D(tDiffuse, vUv - offset);
      gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
    }
  `
};

// ===== SCENE SETUP =====
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 13);

// OPTIMIZATION 1: Disable native antialias (Composer handles it) & set power preference
const renderer = new THREE.WebGLRenderer({ 
  antialias: false, // False because EffectComposer renders to a buffer anyway
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);

// OPTIMIZATION 2: Cap Pixel Ratio at 1.5 for performance vs quality balance
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; // Ensure shadows are enabled
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer, nicer shadows

renderer.domElement.style.zIndex = '1';
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
document.getElementById('canvas-container').appendChild(renderer.domElement);

// ===== POST-PROCESSING =====
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const chromaticPass = new ShaderPass(ChromaticAberrationShader);
chromaticPass.uniforms['amount'].value = 0.005;
composer.addPass(chromaticPass);
composer.addPass(new OutputPass());

// ===== HDR ENVIRONMENT =====
const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  `${ASSET_BASE}/assets/textures/royal_esplanade_1k.hdr`,
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  },
  undefined,
  () => console.warn('HDR texture not found')
);

// ===== LIGHTING & SHADOW OPTIMIZATION =====
scene.add(new THREE.AmbientLight(0xb0bbcb, 0.6));

const keyLight = new THREE.DirectionalLight(0xb0bbcb, 5);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;

// OPTIMIZATION 3: Tighten shadow map settings
keyLight.shadow.mapSize.width = 1024; // Default is often higher, 1024 is plenty
keyLight.shadow.mapSize.height = 1024;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 25;
// Constrain shadow camera to just the boombox area to increase resolution
keyLight.shadow.camera.left = -5;
keyLight.shadow.camera.right = 5;
keyLight.shadow.camera.top = 5;
keyLight.shadow.camera.bottom = -5;
keyLight.shadow.bias = -0.001; // Reduce artifacts

scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xb0bbcb, 1.5);
rimLight.position.set(-5, 3, -5);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xb0bbcb, 0.5);
fillLight.position.set(0, -3, 5);
scene.add(fillLight);

// ===== AUDIO SETUP =====
const audio = new Audio();
audio.crossOrigin = "anonymous";
audio.src = `${ASSET_BASE}/assets/audio/Boombox-audio.mp3`;
audio.preload = "auto";

let isPlaying = false;
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const audioSource = audioContext.createMediaElementSource(audio);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 64;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);
audioSource.connect(analyser);
analyser.connect(audioContext.destination);

audio.addEventListener("ended", () => {
  isPlaying = false;
  if (tapeAction) tapeAction.paused = true;
  animateButton(playButton, 0);
  updateCursorText();
});

// ===== CANVAS WAVEFORM =====
const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
const ctx = canvas.getContext('2d', { alpha: true });
const canvasTexture = new THREE.CanvasTexture(canvas);
canvasTexture.minFilter = THREE.LinearFilter;
canvasTexture.magFilter = THREE.LinearFilter;

// OPTIMIZATION 4: Frame skipping for texture uploads
let frameCount = 0;

function drawWaveform() {
  if (!isPlaying) {
    if (frameCount % 10 === 0) { // Keep updating occasionally for responsiveness
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvasTexture.needsUpdate = true;
    }
    return;
  }

  // Only update texture every 2nd frame (30fps) to save CPU/GPU bandwidth
  frameCount++;
  if (frameCount % 2 !== 0) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  analyser.getByteFrequencyData(dataArray);

  const barCount = 28;
  const halfBars = Math.floor(barCount / 2);
  const barWidth = canvas.width / barCount;
  const barSpacing = 3;
  const segmentHeight = 12;
  const segmentGap = 3;

  ctx.shadowBlur = 1;
  ctx.shadowColor = '#ffd441';

  for (let i = 0; i < halfBars; i++) {
    const dataIndex = Math.floor(i * bufferLength / halfBars);
    const value = dataArray[dataIndex] / 255;
    const totalBarHeight = value * canvas.height * 0.85;
    const numSegments = Math.floor(totalBarHeight / (segmentHeight + segmentGap));
    const w = barWidth - barSpacing;

    const centerIndex = barCount / 2;
    const xLeft = (centerIndex - i - 1) * barWidth + barSpacing / 2;
    const xRight = (centerIndex + i) * barWidth + barSpacing / 2;

    for (let j = 0; j < numSegments; j++) {
      const y = canvas.height - (j + 1) * (segmentHeight + segmentGap);
      const intensity = 0.5 + (j / numSegments) * 0.5;
      const r = Math.floor(255 * intensity);
      const g = Math.floor(212 * intensity);
      const b = Math.floor(65 * intensity);
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(xLeft, y, w, segmentHeight);
      ctx.fillRect(xRight, y, w, segmentHeight);
    }
  }
  ctx.shadowBlur = 0;
  canvasTexture.needsUpdate = true;
}

// ===== ANIMATION MIXER & GSAP =====
let mixer = null;
let tapeAction = null;
const clock = new THREE.Clock();
let playButton = null;
let pauseButton = null;
const buttonInitialRotations = new Map();

const gsap = {
  to: (target, props) => {
    const start = { x: target.x, y: target.y, z: target.z };
    const duration = props.duration * 1000;
    const startTime = Date.now();
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (props.x !== undefined) target.x = start.x + (props.x - start.x) * eased;
      if (props.y !== undefined) target.y = start.y + (props.y - start.y) * eased;
      if (props.z !== undefined) target.z = start.z + (props.z - start.z) * eased;
      if (progress < 1) requestAnimationFrame(animate);
    }
    animate();
  }
};

function animateButton(button, targetRotation) {
  if (!button) return;
  const initialRotation = buttonInitialRotations.get(button);
  const targetRad = THREE.MathUtils.degToRad(targetRotation);
  gsap.to(button.rotation, { x: initialRotation.x + targetRad, duration: 0.3, ease: "power2.out" });
}

// ===== MOUSE TRACKING =====
const mouse = { x: 0, y: 0 };
const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (event.clientY / window.innerHeight) * 2 - 1;
  targetRotation.y = mouse.x * THREE.MathUtils.degToRad(20);
  targetRotation.x = mouse.y * THREE.MathUtils.degToRad(10);
});

// ===== UI LOGIC =====
function updateCursorText() {
  const cursorText = document.getElementById('cursor-text');
  if (!cursorText) return;
  const newText = isPlaying ? 'PAUSE' : 'PLAY';
  if (cursorText.textContent.trim() === newText) return;
  cursorText.innerHTML = '';
  newText.split('').forEach((letter, index) => {
    const wrapper = document.createElement('span');
    wrapper.className = 'letter-wrapper';
    const span1 = document.createElement('span'); span1.className = 'letter'; span1.textContent = letter;
    const span2 = document.createElement('span'); span2.className = 'letter'; span2.textContent = letter;
    wrapper.appendChild(span1); wrapper.appendChild(span2);
    cursorText.appendChild(wrapper);
    setTimeout(() => wrapper.classList.add('animate'), index * 50);
  });
}

function ensureButtonExists() {
  let btn = document.getElementById('custom-cursor');
  if (!btn) {
    btn = document.createElement('div');
    btn.id = 'custom-cursor';
    btn.innerHTML = '<div id="cursor-text">PLAY</div>';
    document.body.appendChild(btn);
  }
  
  const isMobile = isTouchDevice();
  
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: isMobile ? '15%' : '5%',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '1000',
    pointerEvents: 'auto',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    width: 'auto',
    height: 'auto'
  });
  
  btn.onclick = (e) => { e.stopPropagation(); toggleAudio(); };
}

// ===== LOADER =====
const loader = new GLTFLoader();
loader.load(
  `${ASSET_BASE}/assets/models/Boombox-01.glb`,
  (gltf) => {
    let boombox = gltf.scene;
    const box = new THREE.Box3().setFromObject(boombox);
    boombox.position.sub(box.getCenter(new THREE.Vector3()));

    gltf.scene.traverse((child) => {
      if (child.name === 'play-button') {
        playButton = child;
        buttonInitialRotations.set(playButton, { x: child.rotation.x, y: child.rotation.y, z: child.rotation.z });
      }
      if (child.name === 'pause-button') {
        pauseButton = child;
        buttonInitialRotations.set(pauseButton, { x: child.rotation.x, y: child.rotation.y, z: child.rotation.z });
      }
      if (child.isMesh) {
        // Shadow optimization for meshes
        child.castShadow = true;
        child.receiveShadow = true;
        
        if (child.name.includes('Speakers')) {
          const mat = child.material.clone();
          mat.map = canvasTexture;
          mat.emissive = new THREE.Color(0xffd441);
          mat.emissiveMap = canvasTexture;
          mat.emissiveIntensity = 1.5;
          mat.transparent = true;
          canvasTexture.center.set(0.5, 0.5);
          canvasTexture.repeat.set(1.5, -1.5);
          canvasTexture.offset.set(0, -0.15);
          child.material = mat;
        } else if (child.material) {
          child.material.envMapIntensity = 1.5;
        }
      }
    });

    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(boombox);
      tapeAction = mixer.clipAction(gltf.animations[0]);
      tapeAction.loop = THREE.LoopRepeat;
    }

    // Attach boombox to global scope for animation loop
    window.boombox = boombox; 
    scene.add(boombox);
    handleResponsiveness();
    drawWaveform();
    ensureButtonExists();
    updateCursorText();
  }
);

function toggleAudio() {
  if (audioContext.state === "suspended") audioContext.resume();
  
  if (isPlaying) {
    audio.pause();
    if (tapeAction) tapeAction.paused = true;
    if (pauseButton) animateButton(pauseButton, 16);
    isPlaying = false;
  } else {
    audio.play().then(() => {
      if (tapeAction) { if(!tapeAction.isRunning()) tapeAction.play(); tapeAction.paused = false; }
      if (pauseButton) animateButton(pauseButton, 0);
      animateButton(playButton, 16);
      isPlaying = true;
    }).catch(console.error);
  }
  updateCursorText();
}

// ===== ANIMATION LOOP =====
// OPTIMIZATION 5: Stop rendering if tab is inactive to save battery
let isPageVisible = true;
document.addEventListener("visibilitychange", () => {
  isPageVisible = document.visibilityState === 'visible';
});

function animate() {
  requestAnimationFrame(animate);
  if (!isPageVisible) return;

  const delta = clock.getDelta();
  if (mixer && isPlaying) mixer.update(delta);
  drawWaveform();

  if (window.boombox) {
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.05;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.05;
    window.boombox.rotation.x = currentRotation.x;
    window.boombox.rotation.y = currentRotation.y;
  }
  composer.render();
}
animate();

function handleResponsiveness() {
  if (!window.boombox) return;
  const isMob = isTouchDevice();
  const rotate = shouldRotateBoombox();
  
  if (rotate) {
    window.boombox.rotation.z = Math.PI / 2;
    window.boombox.scale.set(0.6, 0.6, 0.6);
  } else {
    window.boombox.rotation.z = 0;
    window.boombox.scale.set(isMob ? 0.8 : 1, isMob ? 0.8 : 1, isMob ? 0.8 : 1);
  }
  
  const box = new THREE.Box3().setFromObject(window.boombox);
  window.boombox.position.sub(box.getCenter(new THREE.Vector3()));
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  handleResponsiveness();
});

window.addEventListener('DOMContentLoaded', ensureButtonExists);
