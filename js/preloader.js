// ===== SMART PRELOADER - Works with or without Boombox =====
document.addEventListener("DOMContentLoaded", () => {
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  const digitH = document.getElementById("digit-hundreds");
  const digitT = document.getElementById("digit-tens");
  const digitU = document.getElementById("digit-units");
  const percentSign = document.getElementById("percentSign");
  const progressText = document.getElementById("progressText");

  // Get static circles
  const staticCircle1 = document.querySelector(".static-circle-1");
  const staticCircle2 = document.querySelector(".static-circle-2");

  // Detect mobile devices
  const isMobile = window.innerWidth <= 768;

  let progress = 0;
  let lastDisplayed = -1;
  const RISE_DISTANCE = isMobile ? 15 : 20;
  const RISE_DURATION = 220;

  // ===== SMART DETECTION =====
  const hasBoombox = document.getElementById('boombox-hero-container') !== null;
  let boomboxLoaded = false;
  let loadingInterval = null;

  // Random stop points for hybrid tracking
  const firstStop = hasBoombox ? Math.floor(Math.random() * 21) + 40 : null; // 40-60%
  const shouldUseSecondStop = hasBoombox ? Math.random() > 0.5 : false; // 50% chance
  const secondStop = shouldUseSecondStop ? Math.floor(Math.random() * 11) + 70 : null; // 70-80%

  console.log('Preloader mode:', hasBoombox ? 'HYBRID (with boombox)' : 'FAKE ONLY');
  if (hasBoombox) {
    console.log(`First stop: ${firstStop}%`, shouldUseSecondStop ? `Second stop: ${secondStop}%` : 'Direct to 100%');
  }

  // ===== DIGIT ANIMATION =====
  function animateDigitIn(el) {
    el.style.transition = "none";
    el.style.transform = `translateY(${RISE_DISTANCE}px)`;
    el.style.opacity = "0";
    el.offsetHeight;
    el.style.transition = `transform ${RISE_DURATION}ms cubic-bezier(.2,.9,.2,1), opacity ${RISE_DURATION}ms linear`;
    el.style.transform = "translateY(0)";
    el.style.opacity = "1";
  }

  function setProgress(value) {
    value = Math.max(0, Math.min(100, value));
    progress = value;

    progressFill.style.height = progress + "%";

    const display = Math.floor(progress);
    if (display !== lastDisplayed) {
      const prev = String(lastDisplayed === -1 ? 0 : lastDisplayed).padStart(3, "0");
      const s = String(display).padStart(3, "0");

      if (s[0] !== prev[0]) {
        digitH.textContent = s[0];
        animateDigitIn(digitH);
      }
      if (s[1] !== prev[1]) {
        digitT.textContent = s[1];
        animateDigitIn(digitT);
      }
      if (s[2] !== prev[2]) {
        digitU.textContent = s[2];
        animateDigitIn(digitU);
      }

      lastDisplayed = display;
    }
  }

  // ===== BOOMBOX LOADED CALLBACK =====
  if (hasBoombox) {
    window.onBoomboxLoaded = function() {
      console.log('Boombox loaded! Current progress:', progress);
      boomboxLoaded = true;
      
      // If we're still loading, continue to next phase
      if (loadingInterval) {
        continueToNextPhase();
      }
    };
  }

  // ===== LOADING PHASES =====
  function startLoading() {
    const speed = Math.random() * 2 + 2; // 2-4% increment
    
    loadingInterval = setInterval(() => {
      progress += speed;

      // PHASE 1: Fake loading to first stop (or 100% if no boombox)
      if (!hasBoombox) {
        if (progress >= 100) {
          setProgress(100);
          clearInterval(loadingInterval);
          setTimeout(() => runAnimationSequence(), 300);
        } else {
          setProgress(progress);
        }
      } else {
        // Has boombox - stop at first checkpoint
        if (progress >= firstStop && !boomboxLoaded) {
          setProgress(firstStop);
          clearInterval(loadingInterval);
          loadingInterval = null;
          console.log(`Waiting at ${firstStop}% for boombox...`);
          // Now we wait for boombox to load
        } else if (progress >= firstStop && boomboxLoaded) {
          // Boombox already loaded before we hit first stop
          continueToNextPhase();
        } else {
          setProgress(progress);
        }
      }
    }, 50);
  }

  // ===== CONTINUE AFTER BOOMBOX LOADS =====
  function continueToNextPhase() {
    if (loadingInterval) {
      clearInterval(loadingInterval);
    }

    // Check if we should use second stop
    if (shouldUseSecondStop && secondStop) {
      console.log(`Moving to second stop: ${secondStop}%`);
      
      // Animate to second stop
      const currentProgress = progress;
      const distance = secondStop - currentProgress;
      const duration = 800; // ms
      const startTime = Date.now();

      const moveToSecondStop = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressRatio = Math.min(elapsed / duration, 1);
        const easedProgress = currentProgress + (distance * progressRatio);

        setProgress(easedProgress);

        if (progressRatio >= 1) {
          clearInterval(moveToSecondStop);
          // Wait 500ms at second stop
          setTimeout(() => {
            moveToComplete();
          }, 500);
        }
      }, 16);
    } else {
      // Go directly to 100%
      moveToComplete();
    }
  }

  // ===== MOVE TO 100% =====
  function moveToComplete() {
    console.log('Moving to 100%');
    
    const currentProgress = progress;
    const distance = 100 - currentProgress;
    const duration = 1200; // ms
    const startTime = Date.now();

    const moveToHundred = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      const easedProgress = currentProgress + (distance * progressRatio);

      setProgress(easedProgress);

      if (progressRatio >= 1) {
        clearInterval(moveToHundred);
        setProgress(100);
        setTimeout(() => {
          runAnimationSequence();
        }, 300);
      }
    }, 16);
  }

  // ===== ANIMATION SEQUENCE (same as before) =====
  const DROP_DISTANCE = isMobile ? 150 : 200;
  const DROP_DURATION = 600;
  const DROP_STAGGER = 140;
  const CIRCLE_MOVE_DURATION = 400;
  const PAUSE_BEFORE_COLLAPSE = 250;
  const ELASTIC_COLLAPSE_DURATION = 800;
  const BACKGROUND_FADE_DURATION = 800;

  function runAnimationSequence() {
    setProgress(100);

    // STEP 2: Fade out text + Drop digits
    progressText.style.transition = "opacity 0.6s ease";
    progressText.style.opacity = "0";

    const fallOrder = [digitH, digitT, digitU, percentSign];
    fallOrder.forEach((el, i) => {
      setTimeout(() => {
        el.style.transition = `transform ${DROP_DURATION}ms cubic-bezier(0.55, 0.085, 0.68, 0.53), opacity ${DROP_DURATION}ms`;
        el.style.transform = `translateY(${DROP_DISTANCE}px)`;
        el.style.opacity = "0";
      }, i * DROP_STAGGER);
    });

    const dropCompleteTime = fallOrder.length * DROP_STAGGER + DROP_DURATION;

    // STEP 3: Move static circles
    setTimeout(() => {
      staticCircle1.style.transition = `top ${CIRCLE_MOVE_DURATION}ms ease-out`;
      staticCircle1.style.top = "0";

      staticCircle2.style.transition = `top ${CIRCLE_MOVE_DURATION}ms ease-out`;
      staticCircle2.style.top = "0";
    }, dropCompleteTime);

    const allCircles = [progressBar, staticCircle1, staticCircle2];

    // STEP 4: Elastic collapse
    setTimeout(() => {
      allCircles.forEach(circle => {
        circle.style.transformOrigin = "center";
        circle.style.transition = `transform ${ELASTIC_COLLAPSE_DURATION}ms cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
        circle.style.transform = "scale(0)";
      });
    }, dropCompleteTime + CIRCLE_MOVE_DURATION + PAUSE_BEFORE_COLLAPSE);

    // STEP 5: Fade out background
    setTimeout(() => {
      const preloader = document.getElementById("preloader");
      preloader.style.transition = `opacity ${BACKGROUND_FADE_DURATION}ms ease`;
      preloader.style.opacity = "0";

      setTimeout(() => {
        preloader.style.display = "none";
      }, BACKGROUND_FADE_DURATION);
    }, dropCompleteTime + CIRCLE_MOVE_DURATION + PAUSE_BEFORE_COLLAPSE + ELASTIC_COLLAPSE_DURATION);
  }

  // ===== INITIALIZE =====
  setProgress(0);
  animateDigitIn(digitH);
  animateDigitIn(digitT);
  animateDigitIn(digitU);
  
  // Start loading
  startLoading();
});
