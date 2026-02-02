import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/PatchBlack/patchblack-code@main';

// ===== LOADING MANAGER =====
const loadingManager = new THREE.LoadingManager();

loadingManager.onLoad = function() {
  if (window.onBoomboxLoaded && typeof window.onBoomboxLoaded === 'function') {
    window.onBoomboxLoaded();
  }
};

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

function isTablet() {
  const isTouch = isTouchDevice();
  const width = window.innerWidth;
  return isTouch && width >= 769 && width <= 1180;
}

// ===== SHADERS =====
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

const container = document.getElementById('canvas-container');
const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;

const camera = new THREE.PerspectiveCamera(45, containerWidth / containerHeight, 0.1, 1000);
const cameraZ = isTablet() ? 10 : 11;
camera.position.set(0, 0, cameraZ);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(containerWidth, containerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const chromaticPass = new ShaderPass(ChromaticAberrationShader);
chromaticPass.uniforms['amount'].value = 0.005;
composer.addPass(chromaticPass);
composer.addPass(new OutputPass());

const rgbeLoader = new RGBELoader(loadingManager);
rgbeLoader.load(`${ASSET_BASE}/assets/textures/royal_esplanade_1k.hdr`, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  }, undefined, () => {});

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

// ===== AUDIO & VIDEO SETUP =====
const audio = new Audio();
audio.crossOrigin = "anonymous";
audio.src = `${ASSET_BASE}/assets/audio/Boombox-audio-v2.mp3`;
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

const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
const ctx = canvas.getContext('2d', { alpha: true });

const canvasTexture = new THREE.CanvasTexture(canvas);
canvasTexture.minFilter = THREE.LinearFilter;
canvasTexture.magFilter = THREE.LinearFilter;
canvasTexture.center.set(0.5, 0.5);
canvasTexture.repeat.set(-1, -1);
canvasTexture.offset.set(0, -0.15);

const video = document.createElement('video');
video.src = `${ASSET_BASE}/assets/video/boombox-idle-v2.mp4`;
video.loop = true;
video.muted = true;
video.playsInline = true;
video.crossOrigin = "anonymous";

const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.center.set(0.5, 0.5);
videoTexture.repeat.set(1, -1);
videoTexture.offset.set(0, 0);

video.play().catch(() => {});

function drawWaveform() {
  if (!isPlaying) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  analyser.getByteFrequencyData(dataArray);

  const barCount = 28;
  const halfBars = 14;
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
    const numSegments = Math.floor(totalBarHeight / 15);
    const w = barWidth - barSpacing;

    const xLeft = (14 - i - 1) * barWidth + 1.5;
    const xRight = (14 + i) * barWidth + 1.5;

    for (let j = 0; j < numSegments; j++) {
      const y = canvas.height - (j + 1) * 15;
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

// ===== ANIMATION VARS =====
let mixer = null;
let tapeAction = null;
const clock = new THREE.Clock();

let playButton = null;
let pauseButton = null;
const buttonInitialRotations = new Map();
let speaker1Material = null;
let speaker2Material = null;
let boombox = null;

const mouse = { x: 0, y: 0 };
const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };

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
      else if (props.onComplete) props.onComplete();
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

// ===== INPUT HANDLING =====
function updateMouse(x, y, rect) {
  mouse.x = Math.max(-1, Math.min(1, ((x - rect.left) / rect.width) * 2 - 1));
  mouse.y = Math.max(-1, Math.min(1, ((y - rect.top) / rect.height) * 2 - 1));
  targetRotation.y = mouse.x * THREE.MathUtils.degToRad(20);
  targetRotation.x = mouse.y * THREE.MathUtils.degToRad(10);
}

window.addEventListener('mousemove', (event) => {
  const rect = container.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    updateMouse(event.clientX, event.clientY, rect);
  }
});

window.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  const rect = container.getBoundingClientRect();
  updateMouse(touch.clientX, touch.clientY, rect);
}, { passive: true });

function updateCursorText() {
  const cursorText = document.getElementById('cursor-text');
  if (!cursorText) return;
  
  const newText = isPlaying ? 'PAUSE MESSAGE' : 'PLAY MESSAGE';
  if (cursorText.textContent.trim() === newText) return;

  cursorText.innerHTML = '';
  newText.split('').forEach((letter, index) => {
    if (letter === ' ') {
      const space = document.createElement('span');
      space.innerHTML = '&nbsp;';
      space.style.display = 'inline-block';
      space.style.width = '0.5em';
      cursorText.appendChild(space);
      return;
    }
    const wrapper = document.createElement('span');
    wrapper.className = 'letter-wrapper';
    
    const s1 = document.createElement('span'); s1.className = 'letter'; s1.textContent = letter;
    const s2 = document.createElement('span'); s2.className = 'letter'; s2.textContent = letter;
    wrapper.append(s1, s2);
    cursorText.appendChild(wrapper);
    setTimeout(() => wrapper.classList.add('animate'), index * 50);
  });
}

// ===== LOAD MODEL =====
const loader = new GLTFLoader(loadingManager);
loader.load(`${ASSET_BASE}/assets/models/Boombox-01.glb`, (gltf) => {
    boombox = gltf.scene;
    const box = new THREE.Box3().setFromObject(boombox);
    boombox.position.sub(box.getCenter(new THREE.Vector3()));
    boombox.position.y = -(box.max.y - box.min.y) / 2 - 2;

    gltf.scene.traverse((child) => {
      if (child.name === 'play-button') {
        playButton = child;
        buttonInitialRotations.set(playButton, { ...child.rotation });
      } else if (child.name === 'pause-button') {
        pauseButton = child;
        buttonInitialRotations.set(pauseButton, { ...child.rotation });
      } else if (child.isMesh) {
        if (child.name === 'Speakers_001' || child.name === 'Speakers_002') {
          const mat = child.material.clone();
          mat.map = videoTexture;
          mat.emissive = new THREE.Color(0x444444);
          mat.emissiveMap = videoTexture;
          mat.emissiveIntensity = 8.0;
          mat.transparent = true;
          child.material = mat;
          child.material.needsUpdate = true;
          if (child.name === 'Speakers_001') speaker1Material = mat;
          if (child.name === 'Speakers_002') speaker2Material = mat;
        } else if (child.material) {
          child.material.envMapIntensity = 1.5;
          child.material.needsUpdate = true;
        }
      }
    });

    if (gltf.animations?.length > 0) {
      mixer = new THREE.AnimationMixer(boombox);
      tapeAction = mixer.clipAction(gltf.animations[0]);
      tapeAction.loop = THREE.LoopRepeat;
      tapeAction.clampWhenFinished = false;
    }

    scene.add(boombox);
    boombox.rotation.y = THREE.MathUtils.degToRad(20);
    boombox.rotation.x = THREE.MathUtils.degToRad(-10);
    currentRotation.y = THREE.MathUtils.degToRad(20);
    currentRotation.x = THREE.MathUtils.degToRad(-10);
    
    handleResponsiveness();
    drawWaveform();
    setupButton();
    updateCursorText();
  }, undefined, () => {});

// ===== AUDIO LOGIC =====
audio.addEventListener("ended", () => {
  isPlaying = false;
  if (tapeAction) tapeAction.paused = true;
  animateButton(playButton, 0);
  
  const resetMat = (mat) => {
      if(!mat) return;
      mat.map = videoTexture;
      mat.emissiveMap = videoTexture;
      mat.emissive.set(0x444444);
      mat.emissiveIntensity = 8.0;
      mat.needsUpdate = true;
  };
  resetMat(speaker1Material);
  resetMat(speaker2Material);
  video.play();
  updateCursorText();
});

function toggleAudio() {
  if (audioContext.state === "suspended") {
    audioContext.resume().then(performToggle);
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
    audio.play().then(() => {
        if (tapeAction) {
          if (!tapeAction.isRunning()) tapeAction.play();
          tapeAction.paused = false;
        }
        if (pauseButton) animateButton(pauseButton, 0);
        animateButton(playButton, 16);
        isPlaying = true;
        
        const setCanvasMat = (mat) => {
            if(!mat) return;
            mat.map = canvasTexture;
            mat.emissiveMap = canvasTexture;
            mat.emissive.set(0xffd441);
            mat.emissiveIntensity = 1.5;
            mat.needsUpdate = true;
        };
        setCanvasMat(speaker1Material);
        setCanvasMat(speaker2Material);
        
        video.pause();
        updateCursorText();
      }).catch(() => {});
  }
  updateCursorText();
}

function setupButton() {
  const btn = document.getElementById('custom-cursor');
  if (btn) btn.onclick = (e) => { e.stopPropagation(); toggleAudio(); };
}

// ===== RESIZE HANDLING =====
function handleResponsiveness() {
  if (!boombox) return;
  if (shouldRotateBoombox()) {
    boombox.rotation.z = THREE.MathUtils.degToRad(90);
    boombox.scale.setScalar(0.6);
  } else if (isTouchDevice()) {
    boombox.rotation.z = 0;
    boombox.scale.setScalar(0.8);
  } else {
    boombox.rotation.z = 0;
    boombox.scale.setScalar(1);
  }
  
  const box = new THREE.Box3().setFromObject(boombox);
  boombox.position.sub(box.getCenter(new THREE.Vector3()));
}

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.position.z = isTablet() ? 10 : 13;
    
    handleResponsiveness();
  }, 150);
});

// ===== RENDER LOOP & LIFECYCLE =====
function render() {
  const delta = clock.getDelta();

  if (mixer && isPlaying) mixer.update(delta);
  drawWaveform();

  if (boombox) {
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.05;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.05;
    boombox.rotation.x = currentRotation.x;
    boombox.rotation.y = currentRotation.y;
  }
  composer.render();
}

function setupLifecycle() {
  if (!container) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        renderer.setAnimationLoop(render);
        if (!isPlaying && video.paused) {
