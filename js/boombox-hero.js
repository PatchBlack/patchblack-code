import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Base CDN URL for assets
const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/PatchBlack/patchblack-code@main';

// ===== DEVICE DETECTION =====
function isTouchDevice() {
  return (('ontouchstart' in window) ||
          (navigator.maxTouchPoints > 0) ||
          (navigator.msMaxTouchPoints > 0));
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

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 13);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Ensure canvas does not block clicks underneath if needed, though we usually want it to catch 3D clicks
renderer.domElement.style.zIndex = '1'; 
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
  () => console.warn('HDR texture not found - using fallback lighting')
);

// ===== LIGHTING =====
scene.add(new THREE.AmbientLight(0xb0bbcb, 0.6));
const keyLight = new THREE.DirectionalLight(0xb0bbcb, 5);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
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

// Initialize AudioContext safely
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

function drawWaveform() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!isPlaying) {
    canvasTexture.needsUpdate = true;
    return;
  }

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

// ===== ANIMATION MIXER =====
let mixer = null;
let tapeAction = null;
const clock = new THREE.Clock();

// ===== BUTTON REFERENCES & GSAP =====
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

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (props.onComplete) {
        props.onComplete();
      }
    }
    animate();
  }
};

function animateButton(button, targetRotation) {
  if (!button) return;
  const initialRotation = buttonInitialRotations.get(button);
  const targetRad = THREE.MathUtils.degToRad(targetRotation);
  gsap.to(button.rotation, {
    x: initialRotation.x + targetRad,
    duration: 0.3,
    ease: "power2.out"
  });
}

// ===== BUTTON POSITIONING =====
function updateButtonPosition() {
  if (!boombox) return;
  
  const box = new THREE.Box3().setFromObject(boombox);
  const bottomY = box.min.y;
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  
  const screenPosition = new THREE.Vector3(centerX, bottomY, centerZ);
  screenPosition.project(camera);
  
  const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const y = (screenPosition.y * -0.5 + 0.5) * window.innerHeight;
  
  const button = document.getElementById('custom-cursor');
  if (button) {
    // Force styling to ensure it sits on top
    button.style.position = 'absolute';
    button.style.zIndex = '1000'; // CRITICAL FIX: Ensure it is above canvas
    button.style.left = x + 'px';
    button.style.top = (y + 40) + 'px'; // 40px padding below object
    button.style.transform = 'translate(-50%, 0)';
    button.style.display = 'flex';
  }
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

// ===== TEXT ANIMATION =====
function updateCursorText() {
  const cursorText = document.getElementById('cursor-text');
  if (!cursorText) return;
  
  const newText = isPlaying ? 'PAUSE' : 'PLAY';
  
  if (cursorText.textContent.trim() === newText) return;

  cursorText.innerHTML = '';
  const letters = newText.split('');

  letters.forEach((letter, index) => {
    const wrapper = document.createElement('span');
    wrapper.className = 'letter-wrapper';

    const span1 = document.createElement('span');
    span1.className = 'letter';
    span1.textContent = letter;
    wrapper.appendChild(span1);

    const span2 = document.createElement('span');
    span2.className = 'letter';
    span2.textContent = letter;
    wrapper.appendChild(span2);

    cursorText.appendChild(wrapper);

    setTimeout(() => wrapper.classList.add('animate'), index * 50);
  });
}

// ===== MODEL LOADER =====
let boombox = null;

const loader = new GLTFLoader();
loader.load(
  `${ASSET_BASE}/assets/models/Boombox-01.glb`,
  (gltf) => {
    boombox = gltf.scene;
    const box = new THREE.Box3().setFromObject(boombox);
    const center = box.getCenter(new THREE.Vector3());
    boombox.position.sub(center);

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
        if (child.name === 'Speakers_001' || child.name === 'Speakers_002') {
          const originalMaterial = child.material.clone();
          originalMaterial.map = canvasTexture;
          originalMaterial.emissive = new THREE.Color(0xffd441);
          originalMaterial.emissiveMap = canvasTexture;
          originalMaterial.emissiveIntensity = 1.5;
          originalMaterial.transparent = true;
          canvasTexture.center.set(0.5, 0.5);
          canvasTexture.repeat.set(1.5, -1.5);
          canvasTexture.offset.set(0, -0.15);
          child.material = originalMaterial;
          child.material.needsUpdate = true;
        } else if (child.material) {
          child.material.envMapIntensity = 1.5;
          child.material.needsUpdate = true;
        }
      }
    });

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(boombox);
      tapeAction = mixer.clipAction(gltf.animations[0]);
      tapeAction.loop = THREE.LoopRepeat;
      tapeAction.clampWhenFinished = false;
    }

    scene.add(boombox);
    handleResponsiveness();
    drawWaveform();
    
    // Ensure button is ready when model is loaded
    ensureButtonExists();
    updateCursorText();
    console.log('Boombox loaded successfully!');
  },
  undefined,
  (error) => console.error('Error loading model:', error)
);

// ===== AUDIO TOGGLE LOGIC =====
function toggleAudio() {
  // Always try to resume context first (Chrome/Safari requirement)
  if (audioContext.state === "suspended") {
    audioContext.resume().then(() => performToggle()).catch(console.error);
  } else {
    performToggle();
  }
}

function performToggle() {
  if (isPlaying) {
    audio.pause();
    if (tapeAction) tapeAction.paused = true;
    if (pauseButton) animateButton(pauseButton, 16);
    isPlaying = false;
  } else {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (tapeAction) {
          if (!tapeAction.isRunning()) tapeAction.play();
          tapeAction.paused = false;
        }
        if (pauseButton) animateButton(pauseButton, 0);
        animateButton(playButton, 16);
        isPlaying = true;
        updateCursorText();
      }).catch(error => {
        console.error("Playback failed:", error);
      });
    }
  }
  updateCursorText();
}

// ===== UI SAFETY INJECTION =====
// This ensures the button exists in the DOM with correct styles even if HTML is missing
function ensureButtonExists() {
  let btn = document.getElementById('custom-cursor');
  
  if (!btn) {
    console.log("Creating custom-cursor element...");
    btn = document.createElement('div');
    btn.id = 'custom-cursor';
    btn.innerHTML = '<div id="cursor-text">PLAY</div>';
    document.body.appendChild(btn);
  }

  // Force critical styles to ensure it works
  Object.assign(btn.style, {
    position: 'absolute',
    zIndex: '9999', // Very high Z-index
    pointerEvents: 'auto', // Ensure it captures clicks
    cursor: 'pointer',
    // Add basic styling if missing
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100px', // Fallback sizing
    height: '40px'
  });
  
  // Attach event listener explicitly
  // Remove old listeners by cloning node if necessary, but simple add is usually fine here
  btn.onclick = (e) => {
    e.stopPropagation();
    console.log("Button clicked!"); // Debug log
    toggleAudio();
  };

  const cursorText = document.getElementById('cursor-text');
  if(cursorText) cursorText.style.pointerEvents = 'none'; // Text shouldn't block click
}

// ===== ANIMATION LOOP =====
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer && isPlaying) mixer.update(delta);
  drawWaveform();

  if (boombox) {
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.05;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.05;
    boombox.rotation.x = currentRotation.x;
    boombox.rotation.y = currentRotation.y;
    updateButtonPosition();
  }
  composer.render();
}
animate();

// ===== RESIZE & RESPONSIVENESS =====
function handleResponsiveness() {
  if (!boombox) return;
  
  if (shouldRotateBoombox()) {
    boombox.rotation.z = THREE.MathUtils.degToRad(90);
    boombox.scale.set(0.6, 0.6, 0.6);
  } else if (isTouchDevice()) {
    boombox.rotation.z = 0;
    boombox.scale.set(0.8, 0.8, 0.8);
  } else {
    boombox.rotation.z = 0;
    boombox.scale.set(1, 1, 1);
  }
  
  const box = new THREE.Box3().setFromObject(boombox);
  const center = box.getCenter(new THREE.Vector3());
  boombox.position.sub(center);
  
  updateButtonPosition();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  handleResponsiveness();
});

window.addEventListener('DOMContentLoaded', ensureButtonExists);
