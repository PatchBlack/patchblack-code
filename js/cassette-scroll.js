import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ===== CHROMATIC ABERRATION SHADER =====
const ChromaticAberrationShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'amount': { value: 0.004 }
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

// ===== DEVICE DETECTION =====
function isTouchDevice() {
  return (('ontouchstart' in window) ||
          (navigator.maxTouchPoints > 0) ||
          (navigator.msMaxTouchPoints > 0));
}

// ===== SCENE SETUP =====
const scene = new THREE.Scene();
scene.background = null;

const container = document.getElementById('cassette-canvas-container');
if (!container) {
  console.error('❌ Canvas container not found!');
  throw new Error('cassette-canvas-container element not found');
}

const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;

const camera = new THREE.PerspectiveCamera(
  45,
  containerWidth / containerHeight,
  0.1,
  1000
);

// ✅ CAMERA POSITION LOGIC
// Mobile (< 768px): Move back (Z=5) to fit the width.
// Desktop (> 768px): Move closer (Z=2.5) to make it look HUGE.
let initialZ;
if (window.innerWidth < 768) {
   initialZ = 1.0; 
} else {
   initialZ = 0.5; 
}
camera.position.set(0, 0, initialZ);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(containerWidth, containerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

// ===== POST-PROCESSING =====
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const chromaticPass = new ShaderPass(ChromaticAberrationShader);
chromaticPass.uniforms['amount'].value = 0.005;
composer.addPass(chromaticPass);

composer.addPass(new OutputPass());

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

// ===== SCROLL PROGRESS TRACKING =====
let scrollProgress = 0; // 0 to 1

function updateScrollProgress() {
  const wrapper = document.getElementById('cassette-scroll-wrapper');
  if (!wrapper) {
    console.warn('⚠️ cassette-scroll-wrapper not found!');
    return;
  }

  const rect = wrapper.getBoundingClientRect();
  const wrapperHeight = wrapper.offsetHeight;
  const windowHeight = window.innerHeight;
  
  const scrollStart = -rect.top;
  const scrollRange = wrapperHeight - windowHeight;
  
  const oldProgress = scrollProgress;
  scrollProgress = Math.max(0, Math.min(1, scrollStart / scrollRange));
  
  if (Math.abs(scrollProgress - oldProgress) > 0.01) {
    console.log(`📊 Scroll: ${(scrollProgress * 100).toFixed(0)}%`);
  }
}

// ===== MOUSE TRACKING FOR CAMERA ROTATION =====
const mouse = { x: 0, y: 0 };
const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };

window.addEventListener('mousemove', (event) => {
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  
  const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
  if (!isVisible) return;
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  
  mouse.x = Math.max(-1, Math.min(1, mouse.x));
  mouse.y = Math.max(-1, Math.min(1, mouse.y));

  // ✅ ROTATION AMOUNT (Increased as requested)
  targetRotation.y = mouse.x * THREE.MathUtils.degToRad(45);
  targetRotation.x = mouse.y * THREE.MathUtils.degToRad(35);
});

// ===== TOUCH TRACKING FOR MOBILE =====
let isTouching = false;

window.addEventListener('touchstart', (event) => {
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  const touch = event.touches[0];
  
  const isInsideContainer = 
    touch.clientX >= rect.left && 
    touch.clientX <= rect.right && 
    touch.clientY >= rect.top && 
    touch.clientY <= rect.bottom;
  
  if (isInsideContainer) {
    isTouching = true;
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = ((touch.clientY - rect.top) / rect.height) * 2 - 1;
    mouse.x = Math.max(-1, Math.min(1, mouse.x));
    mouse.y = Math.max(-1, Math.min(1, mouse.y));
  }
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  if (!isTouching || !container) return;
  
  const rect = container.getBoundingClientRect();
  const touch = event.touches[0];
  
  mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = ((touch.clientY - rect.top) / rect.height) * 2 - 1;
  
  mouse.x = Math.max(-1, Math.min(1, mouse.x));
  mouse.y = Math.max(-1, Math.min(1, mouse.y));

  // ✅ ROTATION AMOUNT (Mobile)
  targetRotation.y = mouse.x * THREE.MathUtils.degToRad(45);
  targetRotation.x = mouse.y * THREE.MathUtils.degToRad(35);
}, { passive: true });

window.addEventListener('touchend', () => { isTouching = false; });
window.addEventListener('touchcancel', () => { isTouching = false; });

// ===== ANIMATION MIXER & ACTIONS =====
let mixer = null;
let loopAction1 = null;
let loopAction2 = null;
let scrollAction = null;
let scrollClipDuration = 0;

const clock = new THREE.Clock();

// ===== CASSETTE MODEL LOADER =====
let cassette = null;

const loader = new GLTFLoader();
loader.load(
  'https://cdn.jsdelivr.net/gh/PatchBlack/patchblack-code@main/assets/models/Cassette-01.glb',
  (gltf) => {
    cassette = gltf.scene;

    // ✅ SCALE: 1.5x bigger
    cassette.scale.setScalar(1.5); 
    
    // Center the model
    const box = new THREE.Box3().setFromObject(cassette);
    const center = box.getCenter(new THREE.Vector3());
    cassette.position.sub(center);

    cassette.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.envMapIntensity = 1.5;
        child.material.needsUpdate = true;
      }
    });

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(cassette);
      const mainClip = gltf.animations[0];

      const tape1Tracks = mainClip.tracks.filter(track => 
        track.name.includes('AudioCasetteTape_High_Plastic_0001')
      );
      
      const tape2Tracks = mainClip.tracks.filter(track => 
        track.name.includes('AudioCasetteTape_High_Plastic_0002')
      );
      
      // ✅ FILTER: Separate scroll animation from tapes
      const scrollTracks = mainClip.tracks.filter(track => 
        track.name.includes('AudioCasetteHigh') && 
        !track.name.includes('AudioCasetteTape')
      );
      
      if (tape1Tracks.length > 0) {
        const tape1Clip = new THREE.AnimationClip('Tape1Loop', mainClip.duration, tape1Tracks);
        loopAction1 = mixer.clipAction(tape1Clip);
        loopAction1.loop = THREE.LoopRepeat;
        loopAction1.play();
      }
      
      if (tape2Tracks.length > 0) {
        const tape2Clip = new THREE.AnimationClip('Tape2Loop', mainClip.duration, tape2Tracks);
        loopAction2 = mixer.clipAction(tape2Clip);
        loopAction2.loop = THREE.LoopRepeat;
        loopAction2.play();
      }
      
      if (scrollTracks.length > 0) {
        const scrollClip = new THREE.AnimationClip('ScrollAnim', mainClip.duration, scrollTracks);
        scrollAction = mixer.clipAction(scrollClip);
        scrollClipDuration = scrollClip.duration;
        
        scrollAction.loop = THREE.LoopOnce;
        scrollAction.clampWhenFinished = true;
        scrollAction.play(); 
        scrollAction.paused = true; 
      }
    }

    scene.add(cassette);
    
    currentRotation.y = THREE.MathUtils.degToRad(20);
    currentRotation.x = THREE.MathUtils.degToRad(-10);
    
    console.log('🎵 Cassette model loaded and ready!');
  },
  undefined,
  (error) => console.error('❌ Error loading cassette model:', error)
);

// ===== ANIMATION LOOP =====
let isVisible = true;

function animate() {
  requestAnimationFrame(animate);
  
  if (!isVisible) return;
  
  const delta = clock.getDelta();

  updateScrollProgress();

  if (mixer) {
    // ✅ AUTO-STOP: Stop tapes when scroll ends (> 99%)
    const isScrollFinished = scrollProgress > 0.99;

    if (loopAction1) loopAction1.paused = isScrollFinished;
    if (loopAction2) loopAction2.paused = isScrollFinished;

    mixer.update(delta);
    
    if (scrollAction && scrollClipDuration > 0) {
      scrollAction.time = scrollProgress * scrollClipDuration;
    }
  }

  if (cassette) {
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.05;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.05;
    
    cassette.rotation.x = currentRotation.x;
    
    // ✅ FLIP: 180 Degrees
    cassette.rotation.y = currentRotation.y + Math.PI;
  }

  composer.render();
}
animate();

// ===== RESIZE HANDLER =====
let resizeTimeout;

window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);

    // ✅ RESIZE LOGIC: Keep Desktop Big, Mobile Small
    if (w < 768) {
       camera.position.set(0, 0, 1.0); // Mobile
    } else {
       camera.position.set(0, 0, 0.5); // Desktop
    }
  }, 150);
});

// ===== SCROLL LISTENER =====
window.addEventListener('scroll', updateScrollProgress, { passive: true });

// ===== INTERSECTION OBSERVER =====
function setupIntersectionObserver() {
  if (!container) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isVisible = entry.isIntersecting;
      if (isVisible) clock.start();
    });
  }, { threshold: 0.1 });
  observer.observe(container);
}
setupIntersectionObserver();

console.log('🚀 Cassette scroll experience initialized');
