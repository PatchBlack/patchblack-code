// particle-sim.js - Complete particle simulation with navigation and text transitions

import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/PatchBlack/patchblack-code@main';

// ==========================================
// TEXT CONTENT
// ==========================================

const CONTENT = {
  monitor: {
    heading: "Product Stories",
    description: "Interactive narratives that turn complex content into clear, engaging digital products.",
    subtext: "Reports · Case studies · Platforms",
    url: "/temp-demo"  // Change to your actual URL, or leave empty "" to show popup
  },
  phone: {
    heading: "Living Interfaces",
    description: "Interactions designed to respond, adapt, and guide users through story-led experiences.",
    subtext: "Apps · Web apps · Interactive systems",
    url: ""// Change to your actual URL, or leave empty "" to show popup
  },
  vr: {
    heading: "Immersive Narratives",
    description: "Stories extended into spatial and immersive environments that invite exploration.",
    subtext: "AR · VR · Spatial experiences",
    url: ""// Change to your actual URL, or leave empty "" to show popup
  }
};

const SHAPE_KEYS = ['monitor', 'phone', 'vr'];

// ==========================================
// GLOBALS
// ==========================================

let renderer, scene, camera;
const clock = new THREE.Clock();
const modelLoader = new GLTFLoader();

let monitorModel, mobileModel, vrModel;
let particleMesh;
let particlePositions, particleVelocities;
let cubeTargetPositions, coneTargetPositions, monkeyTargetPositions;
let cubePositions, conePositions, monkeyPositions;
let globalMinX, globalMaxX, globalMinY, globalMaxY, globalMinZ, globalMaxZ, globalMaxRange;

let currentShapeIndex = 0;
let nextShapeIndex = 1;
let morphProgress = 1.0;
let autoMorphRotation = 0;
let modelMorphProgress = 1.0;
let modelMorphDelay = 0.25;
const morphDuration = 0.1;
const fullRotation = Math.PI * 2;

let wave2Timer = -999;
let isWave2Active = false;
const wave2PreDelay = 0;
const wave2PostDelay = 0.5;
let morphQueued = false;
let manualMorphDirection = 0;

const shapeNames = ['Monitor', 'Phone', 'VR'];

const mouseCoord = new THREE.Vector3();
const prevMouseCoord = new THREE.Vector3();
const mouseRayOrigin = new THREE.Vector3();
const mouseRayDirection = new THREE.Vector3();
const mouseForce = new THREE.Vector3();

let elapsedTime = 0;

const dummy = new THREE.Object3D();
const tempColor = new THREE.Color();

const params = {
  particleCount: 40000,
  gravity: 0,
  springStrength: 100,
  morphSpringStrength: 45.0,
  damping: 0.5,
  turbulenceStrength: 0.1,
  turbulenceFreq: 35,
  wave2Strength: 75,
  wave2Freq: 15,
  distanceThreshold: 0.2,
  modelScale: 0.55,
  mouseIntensity: 20.0,
  mouseRange: 4.0,
  mouseFalloff: 3,
  mouseDepthMin: 0.0,
  mouseDepthMax: 1,
  vortexStrength: 100,
  vortexTightness: 1,
  vortexDirection: 1,
};

const inPlaceColor = { r: 0.690, g: 0.733, b: 0.796 };
const awayColor = { r: 1.0, g: 0.831, b: 0.255 };
const gamma = 2.2;

const venetianMaterials = [];
let particleColors = null;

// ==========================================
// VIDEO SETUP
// ==========================================

const monitorVideo = document.createElement('video');
monitorVideo.src = `${ASSET_BASE}/assets/video/particleSim-idle-v1.mp4`;
monitorVideo.loop = true;
monitorVideo.muted = true;
monitorVideo.playsInline = true;
monitorVideo.crossOrigin = "anonymous";

const monitorVideoTexture = new THREE.VideoTexture(monitorVideo);
monitorVideoTexture.minFilter = THREE.LinearFilter;
monitorVideoTexture.magFilter = THREE.LinearFilter;
monitorVideoTexture.center.set(0.5, 0.5);
monitorVideoTexture.repeat.set(-0.75, -0.9);
monitorVideoTexture.offset.set(0, 0);

const phoneVideo = document.createElement('video');
phoneVideo.src = `${ASSET_BASE}/assets/video/particleSim-idle-v1.mp4`;
phoneVideo.loop = true;
phoneVideo.muted = true;
phoneVideo.playsInline = true;
phoneVideo.crossOrigin = "anonymous";

const phoneVideoTexture = new THREE.VideoTexture(phoneVideo);
phoneVideoTexture.minFilter = THREE.LinearFilter;
phoneVideoTexture.magFilter = THREE.LinearFilter;
phoneVideoTexture.center.set(0.5, 0.5);
phoneVideoTexture.repeat.set(0.75, 0.75);
phoneVideoTexture.offset.set(0, 0);

const vrVideo = document.createElement('video');
vrVideo.src = `${ASSET_BASE}/assets/video/particleSim-idle-v1.mp4`;
vrVideo.loop = true;
vrVideo.muted = true;
vrVideo.playsInline = true;
vrVideo.crossOrigin = "anonymous";

const vrVideoTexture = new THREE.VideoTexture(vrVideo);
vrVideoTexture.minFilter = THREE.LinearFilter;
vrVideoTexture.magFilter = THREE.LinearFilter;
vrVideoTexture.center.set(0.5, 0.5);
vrVideoTexture.repeat.set(0.75, -0.75);
vrVideoTexture.offset.set(0, 0);

monitorVideo.play().catch(err => {});

// ==========================================
// TEXT TRANSITIONS
// ==========================================

function updateTextContent(shapeIndex) {
  const key = SHAPE_KEYS[shapeIndex];
  const content = CONTENT[key];
  
  const heading = document.getElementById('particle-heading');
  const description = document.getElementById('description-text');
  const subtext = document.getElementById('description-subtext');
  
  heading.style.opacity = '0';
  description.style.opacity = '0';
  subtext.style.opacity = '0';
  
  setTimeout(() => {
    const headingLines = content.heading.split(' ');
    heading.innerHTML = headingLines.join('<br>');
    description.textContent = content.description;
    subtext.textContent = content.subtext;
    
    heading.style.opacity = '1';
    description.style.opacity = '1';
    subtext.style.opacity = '1';
  }, 300);
}

function updateButtonState(shapeIndex) {
  const key = SHAPE_KEYS[shapeIndex];
  const url = CONTENT[key].url;
  const mainText = document.getElementById('particle-cursor-text');
  
  if (mainText) {
    if (!url || url === '') {
      mainText.innerHTML = 'ACCESS DENIED';
      console.log(`🚫 Button set to ACCESS DENIED for ${key}`);
    } else {
      mainText.innerHTML = 'VIEW DEMO';
      console.log(`✅ Button set to VIEW DEMO for ${key}`);
    }
  }
}

// Debug: Watch for changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    console.log('🔴 TEXT CHANGED BY:', mutation);
    console.trace(); // Shows what caused the change
  });
});

setTimeout(() => {
  const ctaWrapper = document.getElementById('particle-cta-wrapper');
  if (mainText) {
    observer.observe(mainText, { 
      childList: true, 
      characterData: true, 
      subtree: true 
    });
    console.log('👁️ Watching #cursor-text for changes');
  }
}, 2000);


function initTextTransitions() {
  const heading = document.getElementById('particle-heading');
  const description = document.getElementById('description-text');
  const subtext = document.getElementById('description-subtext');
  
  [heading, description, subtext].forEach(el => {
    el.style.transition = 'opacity 0.6s ease-in-out';
  });
  
  updateTextContent(0);
  updateButtonState(0);
}
// ==========================================
// BUTTON NAVIGATION
// ==========================================

function setupNavButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (morphProgress >= 1.0 && !isWave2Active && !morphQueued) {
        manualMorphDirection = -1;
        morphQueued = true;
        isWave2Active = true;
        wave2Timer = -wave2PreDelay;
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (morphProgress >= 1.0 && !isWave2Active && !morphQueued) {
        manualMorphDirection = 1;
        morphQueued = true;
        isWave2Active = true;
        wave2Timer = -wave2PreDelay;
      }
    });
  }
}

function setupCTAButton() {
  console.log('🔍 Setting up CTA button...');
  
  const ctaWrapper = document.getElementById('particle-cta-wrapper');
  // Select button INSIDE particle-cta-wrapper only
  const mainButton = ctaWrapper ? ctaWrapper.querySelector('.cursor-button-main') : null;
  
  console.log('🔍 CTA wrapper:', ctaWrapper);
  console.log('🔍 Main button:', mainButton);
  
  if (ctaWrapper) {
    ctaWrapper.addEventListener('click', (e) => {
      console.log('🖱️ CTA wrapper clicked!');
      
      const key = SHAPE_KEYS[currentShapeIndex];
      const url = CONTENT[key].url;
      
      console.log('🔍 URL:', url);
      
      if (!url || url === '') {
        console.log('🚫 ACCESS DENIED - Animating');
        
        // Just animate - text is already "ACCESS DENIED"
        if (mainButton) {
          mainButton.classList.add('access-denied');
          console.log('✅ Added access-denied class');
          
          // Remove animation class after it completes
          setTimeout(() => {
            mainButton.classList.remove('access-denied');
            console.log('✅ Removed access-denied class');
          }, 500);
        } else {
          console.error('❌ Main button not found!');
        }
        
      } else {
        console.log('✅ Navigating to:', url);
        window.location.href = url;
      }
    }, true);
    
    // Set initial button state
    updateButtonState(currentShapeIndex);
  }
}

// ==========================================
// LOADING
// ==========================================

async function loadParticlePositions() {
  const [cubeData, coneData, monkeyData] = await Promise.all([
    fetch(`${ASSET_BASE}/assets/particles/monitor-particle.json`).then((r) => r.json()),
    fetch(`${ASSET_BASE}/assets/particles/phone-particle.json`).then((r) => r.json()),
    fetch(`${ASSET_BASE}/assets/particles/vr-particle.json`).then((r) => r.json()),
  ]);

  cubePositions = cubeData;
  conePositions = coneData;
  monkeyPositions = monkeyData;
}

async function loadModels() {
  const hdrLoader = new HDRLoader();
  const envMap = await hdrLoader.loadAsync(`${ASSET_BASE}/assets/textures/royal_esplanade_1k.hdr`);
  envMap.mapping = THREE.EquirectangularReflectionMapping;

  const [monitorGltf, mobileGltf, vrGltf] = await Promise.all([
    modelLoader.loadAsync(`${ASSET_BASE}/assets/models/monitor-v4.glb`),
    modelLoader.loadAsync(`${ASSET_BASE}/assets/models/mobile-v4.glb`),
    modelLoader.loadAsync(`${ASSET_BASE}/assets/models/vr-glass-v4.glb`),
  ]);

  const monitorContainer = new THREE.Group();
  const mobileContainer = new THREE.Group();
  const vrContainer = new THREE.Group();

  monitorContainer.position.set(0.5, 0.5, 0.5);
  mobileContainer.position.set(0.5, 0.5, 0.5);
  vrContainer.position.set(0.5, 0.5, 0.5);

  monitorModel = monitorGltf.scene;
  mobileModel = mobileGltf.scene;
  vrModel = vrGltf.scene;

  monitorModel.position.set(0, 0.05, 0);
  mobileModel.position.set(0, 0.05, 0);
  vrModel.position.set(0, 0, 0);

  monitorModel.scale.setScalar(params.modelScale);
  mobileModel.scale.setScalar(params.modelScale);
  vrModel.scale.setScalar(params.modelScale);

  [
    { model: monitorModel, index: 0 },
    { model: mobileModel, index: 1 },
    { model: vrModel, index: 2 }
  ].forEach(({ model, index }) => {
    model.traverse((child) => {
      if (child.isMesh) {
        if (child.name === 'monitor_screen' && index === 0) {
          const screenMat = child.material.clone();
          screenMat.map = monitorVideoTexture;
          screenMat.emissive = new THREE.Color(0xcccccc);
          screenMat.emissiveMap = monitorVideoTexture;
          screenMat.emissiveIntensity = 2.0;
          screenMat.roughness = 0.3;
          screenMat.metalness = 0.5;
          screenMat.transparent = true;
          screenMat.envMap = envMap;
          screenMat.envMapIntensity = 1.5;
          screenMat.needsUpdate = true;
          child.material = screenMat;
          venetianMaterials.push(screenMat);
        } else if (child.name === 'phone_screen' && index === 1) {
          const screenMat = child.material.clone();
          screenMat.map = phoneVideoTexture;
          screenMat.emissive = new THREE.Color(0xcccccc);
          screenMat.emissiveMap = phoneVideoTexture;
          screenMat.emissiveIntensity = 2.0;
          screenMat.roughness = 0.3;
          screenMat.metalness = 0.5;
          screenMat.transparent = true;
          screenMat.envMap = envMap;
          screenMat.envMapIntensity = 1.5;
          screenMat.needsUpdate = true;
          child.material = screenMat;
          venetianMaterials.push(screenMat);
        } else if (child.name === 'vr_screen' && index === 2) {
          const screenMat = child.material.clone();
          screenMat.map = vrVideoTexture;
          screenMat.emissive = new THREE.Color(0xcccccc);
          screenMat.emissiveMap = vrVideoTexture;
          screenMat.emissiveIntensity = 2.0;
          screenMat.roughness = 0.3;
          screenMat.metalness = 0.5;
          screenMat.transparent = true;
          screenMat.envMap = envMap;
          screenMat.envMapIntensity = 1.5;
          screenMat.needsUpdate = true;
          child.material = screenMat;
          venetianMaterials.push(screenMat);
        } else {
          const newMat = createVenetianMaterial(child.material, index, envMap);
          child.material = newMat;
          child.castShadow = true;
          child.receiveShadow = true;
          venetianMaterials.push(newMat);
        }
      }
    });
  });

  monitorContainer.add(monitorModel);
  mobileContainer.add(mobileModel);
  vrContainer.add(vrModel);

  monitorContainer.visible = true;
  mobileContainer.visible = false;
  vrContainer.visible = false;

  scene.add(monitorContainer);
  scene.add(mobileContainer);
  scene.add(vrContainer);

  window.monitorContainer = monitorContainer;
  window.mobileContainer = mobileContainer;
  window.vrContainer = vrContainer;

  [monitorContainer, mobileContainer, vrContainer].forEach(container => {
    container.layers.set(1);
    container.traverse((child) => child.layers.set(1));
  });
}

// ==========================================
// VENETIAN BLIND MATERIAL
// ==========================================

function createVenetianMaterial(originalMat, modelIndex, envMap) {
  const mat = new THREE.MeshStandardMaterial({
    color: originalMat.color || 0xffffff,
    map: originalMat.map,
    roughness: originalMat.roughness !== undefined ? originalMat.roughness : 0.5,
    metalness: originalMat.metalness !== undefined ? originalMat.metalness : 0.0,
    transparent: true,
    opacity: 1.0,
    envMap: envMap,
    envMapIntensity: 1.0,
    side: originalMat.side || THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uModelIndex = { value: modelIndex };
    shader.uniforms.uCurrentShapeIndex = { value: 0 };
    shader.uniforms.uNextShapeIndex = { value: 1 };
    shader.uniforms.uCurrentThreshold = { value: -1.0 };
    shader.uniforms.uNextThreshold = { value: 1.0 };

    mat.userData.shader = shader;

    shader.vertexShader = 'varying vec3 vWorldPos;\n' + shader.vertexShader;
    
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
      `
    );

    shader.fragmentShader = `
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform int uModelIndex;
      uniform int uCurrentShapeIndex;
      uniform int uNextShapeIndex;
      uniform float uCurrentThreshold;
      uniform float uNextThreshold;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float worldY = vWorldPos.y;
      float t = uTime;
      
      float scan1 = sin(worldY * 80.0 + t * 25.0);
      float scan2 = sin(worldY * 120.0 - t * 40.0);
      float scan3 = sin(worldY * 200.0 + t * 60.0);
      float scan4 = sin(worldY * 150.0 - t * 35.0);
      
      float jitter = sin(worldY * 300.0 + t * 100.0);
      
      float glitchPattern = scan1 * 0.4 + scan2 * 0.25 + scan3 * 0.15 + scan4 * 0.15 + jitter * 0.2;
      
      float threshold = 2.0;
      
      if (uModelIndex == uCurrentShapeIndex) {
        threshold = uCurrentThreshold * 2.0 - 1.0;
      } else if (uModelIndex == uNextShapeIndex) {
        threshold = uNextThreshold * 2.0 - 1.0;
      }
      
      float bandVisible = step(threshold, glitchPattern);
      
      if (bandVisible < 0.5) {
        discard;
      }
      
      #include <opaque_fragment>
      `
    );
  };

  return mat;
}

// ==========================================
// PARTICLES
// ==========================================

function calculateGlobalBoundingBox() {
  globalMinX = Infinity; globalMinY = Infinity; globalMinZ = Infinity;
  globalMaxX = -Infinity; globalMaxY = -Infinity; globalMaxZ = -Infinity;

  [cubePositions, conePositions, monkeyPositions].forEach((shapes) => {
    for (let i = 0; i < Math.min(params.particleCount, shapes.length); i++) {
      const pos = shapes[i];
      globalMinX = Math.min(globalMinX, pos[0]);
      globalMinY = Math.min(globalMinY, pos[1]);
      globalMinZ = Math.min(globalMinZ, pos[2]);
      globalMaxX = Math.max(globalMaxX, pos[0]);
      globalMaxY = Math.max(globalMaxY, pos[1]);
      globalMaxZ = Math.max(globalMaxZ, pos[2]);
    }
  });

  const rangeX = globalMaxX - globalMinX;
  const rangeY = globalMaxY - globalMinY;
  const rangeZ = globalMaxZ - globalMinZ;
  globalMaxRange = Math.max(rangeX, rangeY, rangeZ);
}

function normalizePosition(pos) {
  return {
    x: 0.5 - ((pos[0] - (globalMinX + globalMaxX) / 2) / globalMaxRange) * 1,
    y: 0.5 + ((pos[2] - (globalMinZ + globalMaxZ) / 2) / globalMaxRange) * 1,
    z: 0.5 + ((pos[1] - (globalMinY + globalMaxY) / 2) / globalMaxRange) * 1,
  };
}

function createParticlePositions() {
  calculateGlobalBoundingBox();
  const count = Math.min(params.particleCount, cubePositions.length);

  particlePositions = new Float32Array(count * 3);
  particleVelocities = new Float32Array(count * 3);
  cubeTargetPositions = new Float32Array(count * 3);
  coneTargetPositions = new Float32Array(count * 3);
  monkeyTargetPositions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const cubeNorm = normalizePosition(cubePositions[i]);
    const coneNorm = normalizePosition(conePositions[i]);
    const monkeyNorm = normalizePosition(monkeyPositions[i]);

    cubeTargetPositions[i * 3] = cubeNorm.x;
    cubeTargetPositions[i * 3 + 1] = cubeNorm.y;
    cubeTargetPositions[i * 3 + 2] = cubeNorm.z;

    coneTargetPositions[i * 3] = coneNorm.x;
    coneTargetPositions[i * 3 + 1] = coneNorm.y;
    coneTargetPositions[i * 3 + 2] = coneNorm.z;

    monkeyTargetPositions[i * 3] = monkeyNorm.x;
    monkeyTargetPositions[i * 3 + 1] = monkeyNorm.y;
    monkeyTargetPositions[i * 3 + 2] = monkeyNorm.z;

    particlePositions[i * 3] = cubeNorm.x;
    particlePositions[i * 3 + 1] = cubeNorm.y;
    particlePositions[i * 3 + 2] = cubeNorm.z;
  }

  return count;
}

function setupParticles() {
  const count = createParticlePositions();
  const geometry = BufferGeometryUtils.mergeVertices(
    new THREE.IcosahedronGeometry(0.0035, 1)
  );
  geometry.deleteAttribute('uv');

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.85,
  });

  particleMesh = new THREE.InstancedMesh(geometry, material, count);
  particleMesh.position.set(0.5, 0.5, 0.5);
  particleMesh.frustumCulled = false;
  particleMesh.castShadow = true;
  particleMesh.receiveShadow = true;
  particleMesh.layers.set(0);

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    dummy.position.set(
      particlePositions[idx] - 0.5,
      particlePositions[idx + 1] - 0.5,
      particlePositions[idx + 2] - 0.5
    );
    dummy.updateMatrix();
    particleMesh.setMatrixAt(i, dummy.matrix);

    tempColor.setRGB(
      Math.pow(inPlaceColor.r, gamma),
      Math.pow(inPlaceColor.g, gamma),
      Math.pow(inPlaceColor.b, gamma)
    );
    particleMesh.setColorAt(i, tempColor);
  }

  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) {
    particleMesh.instanceColor.needsUpdate = true;
  }

  scene.add(particleMesh);
}

function setupMouse() {
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  renderer.domElement.addEventListener('pointermove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    
    const pointer = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);

    const center = new THREE.Vector3(0.5, 0.5, 0.5);
    const angle = -particleMesh.rotation.y;
    const axis = new THREE.Vector3(0, 1, 0);

    point.sub(center).applyAxisAngle(axis, angle).add(center);
    mouseCoord.copy(point);

    const origin = raycaster.ray.origin.clone();
    origin.sub(center).applyAxisAngle(axis, angle).add(center);
    mouseRayOrigin.copy(origin);

    const dir = raycaster.ray.direction.clone();
    dir.applyAxisAngle(axis, angle);
    mouseRayDirection.copy(dir);
  });
}

// ==========================================
// VIDEO PLAYBACK CONTROL
// ==========================================

function updateVideoPlayback() {
  monitorVideo.pause();
  phoneVideo.pause();
  vrVideo.pause();
  
  if (currentShapeIndex === 0) {
    monitorVideo.play().catch(err => {});
  } else if (currentShapeIndex === 1) {
    phoneVideo.play().catch(err => {});
  } else if (currentShapeIndex === 2) {
    vrVideo.play().catch(err => {});
  }
}

// ==========================================
// MORPHING
// ==========================================

function startMorph() {
  morphProgress = 0;
  modelMorphProgress = -modelMorphDelay;
  
  if (manualMorphDirection === -1) {
    nextShapeIndex = (currentShapeIndex - 1 + 3) % 3;
  } else {
    nextShapeIndex = (currentShapeIndex + 1) % 3;
  }
}

function updateMorphing(deltaTime, rotationDelta) {
  autoMorphRotation += rotationDelta;

  const rotationSpeed = 1.0;
  const preRotation = rotationSpeed * wave2PreDelay;
  
  if (autoMorphRotation >= (fullRotation - preRotation) && !isWave2Active && !morphQueued && morphProgress >= 1.0) {
    morphQueued = true;
    isWave2Active = true;
    wave2Timer = -wave2PreDelay;
    manualMorphDirection = 0;
  }

  if (isWave2Active) {
    wave2Timer += deltaTime;
    
    if (wave2Timer >= 0 && morphProgress >= 1.0 && morphQueued) {
      if (autoMorphRotation >= fullRotation && manualMorphDirection === 0) {
        autoMorphRotation = 0;
      }
      startMorph();
      morphQueued = false;
    }
  }

  if (morphProgress < 1.0) {
    morphProgress += deltaTime / morphDuration;
    if (morphProgress >= 0.5 && morphProgress - (deltaTime / morphDuration) < 0.5) {
      updateTextContent(nextShapeIndex);
    }
    if (morphProgress >= 1.0) {
      morphProgress = 1.0;
      currentShapeIndex = nextShapeIndex;
      manualMorphDirection = 0;
      updateVideoPlayback();
       updateButtonState(currentShapeIndex);
    }
  }

  if (modelMorphProgress < 1.0) {
    modelMorphProgress += deltaTime / morphDuration;
    modelMorphProgress = Math.min(1.0, modelMorphProgress);
  }

  if (isWave2Active && wave2Timer >= (morphDuration + wave2PostDelay)) {
    isWave2Active = false;
    wave2Timer = -999;
  }
}

function updateModels() {
  const containers = [window.monitorContainer, window.mobileContainer, window.vrContainer];

  containers.forEach(c => {
    if (c) c.rotation.y = particleMesh.rotation.y + Math.PI;
  });

  const isMorphing = morphProgress < 1.0;
  const isModelMorphing = modelMorphProgress >= 0 && modelMorphProgress < 1.0;

  const currentThreshold = isModelMorphing ? modelMorphProgress : -1.0;
  const nextThreshold = isModelMorphing ? (1.0 - modelMorphProgress) : 1.0;

  if (isModelMorphing) {
    containers[currentShapeIndex].visible = true;
    containers[nextShapeIndex].visible = true;
    const other = [0, 1, 2].find(i => i !== currentShapeIndex && i !== nextShapeIndex);
    containers[other].visible = false;
  } else {
    containers.forEach((c, i) => {
      c.visible = (i === currentShapeIndex);
    });
  }

  venetianMaterials.forEach((mat) => {
    if (mat.userData.shader) {
      const s = mat.userData.shader;
      s.uniforms.uTime.value = elapsedTime;
      s.uniforms.uCurrentShapeIndex.value = currentShapeIndex;
      s.uniforms.uNextShapeIndex.value = nextShapeIndex;
      s.uniforms.uCurrentThreshold.value = currentThreshold;
      s.uniforms.uNextThreshold.value = nextThreshold;
    }
  });
}

function getTargetPositions(idx) {
  if (idx === 0) return cubeTargetPositions;
  if (idx === 1) return coneTargetPositions;
  return monkeyTargetPositions;
}

function updateParticles(deltaTime) {
  const count = params.particleCount;
  const currentTargets = getTargetPositions(currentShapeIndex);
  const nextTargets = getTargetPositions(nextShapeIndex);
  const isMorphing = morphProgress < 1.0;

  const mouseDelta = new THREE.Vector3().copy(mouseCoord).sub(prevMouseCoord);
  const mouseMovement = mouseDelta.length();

  if (mouseMovement > 0.001) {
    mouseForce.copy(mouseDelta).multiplyScalar(params.mouseIntensity || 10);
    const mouseForceLength = mouseForce.length();
    if (mouseForceLength > 0.3) {
      mouseForce.multiplyScalar((params.mouseIntensity || 10) / mouseForceLength);
    }
  } else {
    mouseForce.set(0, 0, 0);
  }

  prevMouseCoord.copy(mouseCoord);
  const t = elapsedTime;

  const freq = params.turbulenceFreq;
  const turbStr = params.turbulenceStrength * deltaTime;
  const freq2 = params.wave2Freq;
  const wave2Str = params.wave2Strength * deltaTime;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const px = particlePositions[idx];
    const py = particlePositions[idx + 1];
    const pz = particlePositions[idx + 2];

    let vx = particleVelocities[idx];
    let vy = particleVelocities[idx + 1];
    let vz = particleVelocities[idx + 2];

    let tx, ty, tz;
    if (isMorphing) {
      tx = currentTargets[idx] + (nextTargets[idx] - currentTargets[idx]) * morphProgress;
      ty = currentTargets[idx + 1] + (nextTargets[idx + 1] - currentTargets[idx + 1]) * morphProgress;
      tz = currentTargets[idx + 2] + (nextTargets[idx + 2] - currentTargets[idx + 2]) * morphProgress;
    } else {
      tx = currentTargets[idx];
      ty = currentTargets[idx + 1];
      tz = currentTargets[idx + 2];
    }

    const dx = tx - px;
    const dy = ty - py;
    const dz = tz - pz;
    const distToTargetSq = dx * dx + dy * dy + dz * dz;
    const isAway = !isMorphing && distToTargetSq > (params.distanceThreshold * params.distanceThreshold);

    vx += Math.sin(py * freq + t) * Math.cos(pz * freq + t * 1.3) * turbStr;
    vy += Math.sin(pz * freq + t * 1.1) * Math.cos(px * freq + t * 0.9) * turbStr;
    vz += Math.sin(px * freq + t * 0.8) * Math.cos(py * freq + t * 1.2) * turbStr;

    if (isWave2Active) {
      let wave2Multiplier = 1.0;
      
      if (morphProgress >= 1.0) {
        const timeSinceEnd = wave2Timer - morphDuration;
        const fadeProgress = timeSinceEnd / wave2PostDelay;
        wave2Multiplier = Math.max(0, 1.0 - fadeProgress);
      }
      
      const strength = wave2Str * wave2Multiplier;
      vx += Math.sin(py * freq2 + t) * Math.cos(pz * freq2 + t * 1.3) * strength;
      vy += Math.sin(pz * freq2 + t * 1.1) * Math.cos(px * freq2 + t * 0.9) * strength;
      vz += Math.sin(px * freq2 + t * 0.8) * Math.cos(py * freq2 + t * 1.2) * strength;
    }

    if (pz >= params.mouseDepthMin && pz <= params.mouseDepthMax) {
      const dmx = px - mouseRayOrigin.x;
      const dmy = py - mouseRayOrigin.y;
      const dmz = pz - mouseRayOrigin.z;

      const crx = mouseRayDirection.y * dmz - mouseRayDirection.z * dmy;
      const cry = mouseRayDirection.z * dmx - mouseRayDirection.x * dmz;
      const crz = mouseRayDirection.x * dmy - mouseRayDirection.y * dmx;
      const dist = Math.sqrt(crx * crx + cry * cry + crz * crz);
      
      const forceMagnitude = Math.max(0, Math.pow(Math.max(0, 1 - dist * params.mouseRange), params.mouseFalloff));
      
      if (forceMagnitude > 0.01) {
        let pushX = mouseForce.x * forceMagnitude;
        let pushY = mouseForce.y * forceMagnitude;
        let pushZ = mouseForce.z * forceMagnitude;
        
        if (isAway && params.vortexStrength > 0) {
          const pushLen = Math.sqrt(pushX * pushX + pushY * pushY + pushZ * pushZ);
          
          if (pushLen > 0.001) {
            const pushNormX = pushX / pushLen;
            const pushNormY = pushY / pushLen;
            const pushNormZ = pushZ / pushLen;
            
            const upX = 0, upY = 1, upZ = 0;
            let tangentX = pushNormY * upZ - pushNormZ * upY;
            let tangentY = pushNormZ * upX - pushNormX * upZ;
            let tangentZ = pushNormX * upY - pushNormY * upX;
            
            const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ);
            if (tangentLen > 0.001) {
              tangentX /= tangentLen;
              tangentY /= tangentLen;
              tangentZ /= tangentLen;
              
              const vortexAmount = params.vortexStrength * 0.01 * params.vortexDirection;
              pushX += tangentX * pushLen * vortexAmount;
              pushY += tangentY * pushLen * vortexAmount;
              pushZ += tangentZ * pushLen * vortexAmount;
            }
          }
        }
        
        vx += pushX;
        vy += pushY;
        vz += pushZ;
      }
    }

    const effectiveSpring = isMorphing ? params.morphSpringStrength : params.springStrength;

    let spring;
    if (isMorphing) {
      spring = effectiveSpring * deltaTime;
    } else {
      spring = effectiveSpring * deltaTime * 5;
    }

    vx += dx * spring;
    vy += dy * spring;
    vz += dz * spring;

    vx *= params.damping;
    vy *= params.damping;
    vz *= params.damping;

    vy += params.gravity * deltaTime;

    let nx = px + vx * deltaTime;
    let ny = py + vy * deltaTime;
    let nz = pz + vz * deltaTime;
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
    nz = Math.max(0, Math.min(1, nz));

    particlePositions[idx] = nx;
    particlePositions[idx + 1] = ny;
    particlePositions[idx + 2] = nz;
    particleVelocities[idx] = vx;
    particleVelocities[idx + 1] = vy;
    particleVelocities[idx + 2] = vz;

    dummy.position.set(nx - 0.5, ny - 0.5, nz - 0.5);
    dummy.updateMatrix();
    particleMesh.setMatrixAt(i, dummy.matrix);

    const color = isMorphing ? inPlaceColor : (isAway ? awayColor : inPlaceColor);
    
    if (!particleColors || particleColors[i] !== color) {
      tempColor.setRGB(
        Math.pow(color.r, gamma),
        Math.pow(color.g, gamma),
        Math.pow(color.b, gamma)
      );
      particleMesh.setColorAt(i, tempColor);
      
      if (!particleColors) particleColors = new Array(count);
      particleColors[i] = color;
    }
  }

  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
}

// ==========================================
// INIT
// ==========================================

async function init() {
  await loadParticlePositions();

  const canvas = document.getElementById('particle-canvas');
  if (!canvas) {
    return;
  }

  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true, 
    alpha: true, 
    powerPreference: "high-performance" 
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.00;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 0.01, 1000);
  if (window.innerWidth < 480) camera.position.set(0.5, 0.5, -13);
  else if (window.innerWidth < 768) camera.position.set(0.5, 0.5, -12);
  else if (window.innerWidth < 1024) camera.position.set(0.5, 0.5, -11);
  else camera.position.set(0.5, 0.5, -10);
  camera.rotation.set(0, Math.PI, 0);
  camera.layers.enable(0);
  camera.layers.enable(1);

  scene = new THREE.Scene();

  await loadModels();

  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(-10, 6, -4);
  light.target.position.set(0.5, 0.5, 0.5);
  scene.add(light.target);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 30;
  light.shadow.camera.left = -3;
  light.shadow.camera.right = 3;
  light.shadow.camera.top = 3;
  light.shadow.camera.bottom = -3;
  light.shadow.bias = -0.0001;
  light.shadow.radius = 2;
  scene.add(light);
  light.layers.set(0);

  const light2 = new THREE.DirectionalLight(0xe4edff, 0.2);
  light2.position.set(2, -2, -3);
  light2.target.position.set(0.5, 0.5, 0.5);
  scene.add(light2.target);
  light2.layers.set(0);
  scene.add(light2);

  const ambient = new THREE.AmbientLight(0xb7c6e3, 1.0);
  scene.add(ambient);
  ambient.layers.set(0);

  const modelLight = new THREE.DirectionalLight(0xb0bbcb, 0.8);
  modelLight.position.set(-5, 3, -2);
  modelLight.target.position.set(0.5, 0.5, 0.5);
  scene.add(modelLight.target);
  modelLight.castShadow = true;
  modelLight.shadow.mapSize.set(1024, 1024);
  modelLight.shadow.camera.near = 0.1;
  modelLight.shadow.camera.far = 20;
  modelLight.shadow.camera.left = -2;
  modelLight.shadow.camera.right = 2;
  modelLight.shadow.camera.top = 2;
  modelLight.shadow.camera.bottom = -2;
  modelLight.layers.set(1);
  scene.add(modelLight);

  const modelFill = new THREE.DirectionalLight(0xb0bbcb, 0.3);
  modelFill.position.set(3, 1, 2);
  modelFill.layers.set(1);
  scene.add(modelFill);

  const modelAmbient = new THREE.AmbientLight(0xffffff, 0.4);
  modelAmbient.layers.set(1);
  scene.add(modelAmbient);

  setupParticles();
  setupMouse();
  setupNavButtons();
  setupCTAButton();
  initTextTransitions();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(render);

  setupIntersectionObserver();
}

// ==========================================
// RENDER
// ==========================================

function render() {
  const dt = THREE.MathUtils.clamp(clock.getDelta(), 0.00001, 1 / 60);
  elapsedTime = clock.getElapsedTime();

  const rot = dt * 1;
  particleMesh.rotation.y += rot;

  updateMorphing(dt, rot);
  updateModels();
  updateParticles(dt);
  
  renderer.render(scene, camera);
}

function setupIntersectionObserver() {
  const container = document.getElementById('particle-sim-wrapper');
  
  if (!container) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        renderer.setAnimationLoop(render);
        updateVideoPlayback();
      } else {
        renderer.setAnimationLoop(null);
        monitorVideo.pause();
        phoneVideo.pause();
        vrVideo.pause();
      }
    });
  }, {
    threshold: 0.1
  });
  
  observer.observe(container);
}

init();
