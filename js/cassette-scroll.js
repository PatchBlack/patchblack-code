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

// ===== DEVICE DETECTION =====
function isTouchDevice() {
  return (('ontouchstart' in window) ||
          (navigator.maxTouchPoints > 0) ||
          (navigator.msMaxTouchPoints > 0));
}

function isTablet() {
  const isTouch = isTouchDevice();
  const width = window.innerWidth;
  return isTouch && width >= 769 && width <= 1180;
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
const cameraZ = isTablet() ? 0 : 0;
camera.position.set(0, 0, cameraZ);

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
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  const wrapperHeight = wrapper.offsetHeight;
  const windowHeight = window.innerHeight;
  
  // Calculate how far we've scrolled through the wrapper
  const scrollStart = -rect.top;
  const scrollRange = wrapperHeight - windowHeight;
  
  // Clamp between 0 and 1
  scrollProgress = Math.max(0, Math.min(1, scrollStart / scrollRange));
}

// ===== MOUSE TRACKING FOR CAMERA ROTATION =====
const mouse = { x: 0, y: 0 };
const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };

window.addEventListener('mousemove', (event) => {
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  
  // Only track if container is in viewport
  const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
  if (!isVisible) return;
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  
  // Clamp values
  mouse.x = Math.max(-1, Math.min(1, mouse.x));
  mouse.y = Math.max(-1, Math.min(1, mouse.y));

  targetRotation.y = mouse.x * THREE.MathUtils.degToRad(20);
  targetRotation.x = mouse.y * THREE.MathUtils.degToRad(10);
});

// ===== TOUCH TRACKING FOR MOBILE =====
let isTouching = false;

window.addEventListener('touchstart', (event) => {
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  const touch = event.touches[0];
  
  // Check if touch is within canvas area
  const isInsideContainer = 
    touch.clientX >= rect.left && 
    touch.clientX <= rect.right && 
    touch.clientY >= rect.top && 
    touch.clientY <= rect.bottom;
  
  if (isInsideContainer) {
    isTouching = true;
    
    // Calculate initial position
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
  
  // Calculate normalized position
  mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = ((touch.clientY - rect.top) / rect.height) * 2 - 1;
  
  // Clamp values
  mouse.x = Math.max(-1, Math.min(1, mouse.x));
  mouse.y = Math.max(-1, Math.min(1, mouse.y));

  targetRotation.y = mouse.x * THREE.MathUtils.degToRad(20);
  targetRotation.x = mouse.y * THREE.MathUtils.degToRad(10);
}, { passive: true });

window.addEventListener('touchend', () => {
  isTouching = false;
});

window.addEventListener('touchcancel', () => {
  isTouching = false;
});

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
  'https://cdn.jsdelivr.net/gh/PatchBlack/patchblack-code@main/assets/models/Cassette-02.glb',
  (gltf) => {
    cassette = gltf.scene;

     // 🔍 DEBUG: Log all animation names
    console.log('📋 Available animations:');
    gltf.animations.forEach((clip, index) => {
      console.log(`  ${index}: "${clip.name}" (${clip.duration.toFixed(2)}s)`);
    });
    // End debug
    
    // Center the model
    const box = new THREE.Box3().setFromObject(cassette);
    const center = box.getCenter(new THREE.Vector3());
    cassette.position.sub(center);

    // Apply environment map intensity
    cassette.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.envMapIntensity = 1.5;
        child.material.needsUpdate = true;
      }
    });

    // Setup animations
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(cassette);
      
      // Find and setup animations
      gltf.animations.forEach((clip) => {
        if (clip.name === 'AudioCasetteTape_High_Plastic_0.001Action') {
          loopAction1 = mixer.clipAction(clip);
          loopAction1.loop = THREE.LoopRepeat;
          loopAction1.play();
          console.log('✅ Loop animation 1 started');
        } else if (clip.name === 'AudioCasetteTape_High_Plastic_0.002Action.001') {
          loopAction2 = mixer.clipAction(clip);
          loopAction2.loop = THREE.LoopRepeat;
          loopAction2.play();
          console.log('✅ Loop animation 2 started');
        } else if (clip.name === 'AudioCasetteHighAction') {
          scrollAction = mixer.clipAction(clip);
          scrollClipDuration = clip.duration;
          scrollAction.loop = THREE.LoopOnce;
          scrollAction.clampWhenFinished = true;
          // Don't play - we'll control time manually via scroll
          console.log(`✅ Scroll animation loaded (${scrollClipDuration.toFixed(2)}s)`);
        }
      });
    }

    scene.add(cassette);
    
    // Set initial rotation
    cassette.rotation.y = THREE.MathUtils.degToRad(20);
    cassette.rotation.x = THREE.MathUtils.degToRad(-10);
    
    currentRotation.y = THREE.MathUtils.degToRad(20);
    currentRotation.x = THREE.MathUtils.degToRad(-10);
    
    console.log('🎵 Cassette model loaded and ready!');
  },
  (progress) => {
    const percent = (progress.loaded / progress.total * 100).toFixed(0);
    console.log(`📦 Loading cassette: ${percent}%`);
  },
  (error) => console.error('❌ Error loading cassette model:', error)
);

// ===== ANIMATION LOOP =====
let isVisible = true;

function animate() {
  requestAnimationFrame(animate);
  
  if (!isVisible) return; // Skip rendering if off-screen
  
  const delta = clock.getDelta();

  // Update scroll progress
  updateScrollProgress();

  // Update mixer for looping animations
  if (mixer) {
    mixer.update(delta);
    
    // Control scroll-driven animation manually
    if (scrollAction && scrollClipDuration > 0) {
      scrollAction.time = scrollProgress * scrollClipDuration;
      scrollAction.play(); // Enable the action
      scrollAction.paused = true; // But keep it paused
      mixer.update(0); // Force update with 0 delta to apply time change
    }
  }

  // Lerp camera rotation based on mouse
  if (cassette) {
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.05;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.05;
    cassette.rotation.x = currentRotation.x;
    cassette.rotation.y = currentRotation.y;
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
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    camera.aspect = containerWidth / containerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(containerWidth, containerHeight);
    composer.setSize(containerWidth, containerHeight);
    
    const cameraZ = isTablet() ? 0 : 0;
    camera.position.z = cameraZ;
    
    console.log('🔄 Cassette scene resized');
  }, 150);
});

// ===== SCROLL LISTENER =====
window.addEventListener('scroll', () => {
  updateScrollProgress();
}, { passive: true });

// ===== INTERSECTION OBSERVER FOR PERFORMANCE =====
function setupIntersectionObserver() {
  if (!container) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isVisible = entry.isIntersecting;
      
      if (isVisible) {
        console.log('👁️ Cassette visible - rendering active');
        clock.start(); // Resume clock
      } else {
        console.log('🙈 Cassette off-screen - rendering paused');
      }
    });
  }, {
    threshold: 0.1
  });

  observer.observe(container);
}

setupIntersectionObserver();

console.log('🚀 Cassette scroll experience initialized');
