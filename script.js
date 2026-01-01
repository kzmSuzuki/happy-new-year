const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const sunElement = document.getElementById('sun');
const fujiElement = document.getElementById('fuji');
const titleElement = document.getElementById('title');
const bodyElement = document.body;
const popUpItems = document.querySelectorAll('.pop-up-item');
const banzaiPrompt = document.getElementById('banzai-prompt');

let sunriseLevel = 0.0; // 0.0 to 1.0
const SUNRISE_SPEED = 0.01; // Amount to increase per frame when banzai
const DECAY_SPEED = 0.000; // Do we want it to go down? User didn't say. Let's keep it monotonic or slow decay? 
// User says "Recognize banzai -> gradually brighten/rise". Doesn't explicitly say it falls back. 
// "Every time recognized... accumulate?" or "While recognized state is true, it moves"?
// "Recognizing banzai action... little by little brightness rises"
// I will implement "While holding Banzai, it rises".
let isCompleted = false;

function onResults(results) {
    let isBanzai = false;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Check all hands
        for (const landmarks of results.multiHandLandmarks) {
            // Simple Banzai Check: Wrist vs Shoulder?
            // MediaPipe Hands Landmarks:
            // 0: Wrist
            // 11: Left Shoulder (Pose) - we only have Hands. We don't have body pose.
            // With only Hands, we can check if Wrist is in the upper half of screen? or oriented up?
            // Actually, "Banzai" usually implies hands high up.
            // In the camera frame (0,0 is top-left), small Y means high.
            // We can check if wrist Y is < 0.5 (upper half) or < some threshold.
            // Or if we see two hands?
            
            // Let's assume seeing hands in upper area is good enough.
            const wrist = landmarks[0];
            const middleFingerTip = landmarks[12];
            
            // If wrist is high (y < 0.6?)
            if (wrist.y < 0.5) {
                isBanzai = true;
            }
        }
    }

    if (isBanzai && !isCompleted) {
        sunriseLevel += SUNRISE_SPEED;
        if (sunriseLevel >= 1.0) {
            sunriseLevel = 1.0;
            if (!isCompleted) {
                isCompleted = true;
                setTimeout(() => {
                    sunriseLevel = 0.0;
                    isCompleted = false;
                    banzaiPrompt.classList.remove('fade-out');
                    updateScene(sunriseLevel);
                }, 10000);
            }
        }
    } else {
        // Optional: Decay? Maybe not? 
        // If I stop, does the sun fall? "Days rises". Usually days don't fall back.
        // I will keep it.
    }

    updateScene(sunriseLevel);
}

function updateScene(level) {
    // 1. Background Color
    // Night (Dark Blue) -> Morning (Red/Orange) -> Day (Sky Blue)
    // 0.0 -> 0.4 -> 1.0
    
        // User requested: Dark Blue -> Pale Sky Blue -> Red -> Orange
        const t = level;
        
        const colors = [
            { pos: 0.0, r: 10,  g: 10,  b: 40 },   // Dark Blue
            { pos: 0.7, r: 80, g: 120, b: 150 }, // Pale Sky Blue
            { pos: 0.8, r: 220, g: 50,  b: 50 },  // Red
            { pos: 1.0, r: 255, g: 80, b: 0 }    // Orange
        ];

        let startColor = colors[0];
        let endColor = colors[1];

        // Find current segment
        for (let i = 0; i < colors.length - 1; i++) {
            if (t >= colors[i].pos && t <= colors[i+1].pos) {
                startColor = colors[i];
                endColor = colors[i+1];
                break;
            }
        }
        
        // Normalize t for the segment
        const segmentT = (t - startColor.pos) / (endColor.pos - startColor.pos);
        
        const r = Math.floor(startColor.r + segmentT * (endColor.r - startColor.r));
        const g = Math.floor(startColor.g + segmentT * (endColor.g - startColor.g));
        const b = Math.floor(startColor.b + segmentT * (endColor.b - startColor.b));
        
    bodyElement.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    
    // 2. Sun Position
    // Start -20% (hidden) to 70% (high)
    const startBottom = -20;
    const endBottom = 70;
    const currentBottom = startBottom + (level * (endBottom - startBottom));
    sunElement.style.bottom = `${currentBottom}%`;

    // 3. Fuji Brightness
    // 0.2 -> 1.0
    const brightness = 0.2 + (level * 0.8);
    const saturation = 1 + (level * 1);
    const sepia = level * 0.4;
    fujiElement.style.filter = `brightness(${brightness}) sepia(${sepia}) saturate(${saturation})`;

    // 4. Decorations
    if (level >= 1.0) {
        titleElement.classList.add('visible');
        popUpItems.forEach(item => item.classList.add('visible'));
    } else {
        titleElement.classList.remove('visible');
        popUpItems.forEach(item => item.classList.remove('visible'));
    }

    // Banzai Prompt Fade out
    if (level > 0.0) {
        banzaiPrompt.classList.add('fade-out');
    }
}

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// Camera
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 1280,
  height: 720
});
camera.start();
