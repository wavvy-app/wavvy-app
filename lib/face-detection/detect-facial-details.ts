// lib/proctoring/detect-facial-details.ts
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// ============================================================================
// TYPES - What we detect (RAW DATA ONLY)
// ============================================================================

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type HeadPose = 
  | 'CENTER' 
  | 'LOOKING_UP' 
  | 'LOOKING_DOWN' 
  | 'LOOKING_LEFT' 
  | 'LOOKING_RIGHT';

export interface FaceDetectionResult {
  // Detection metadata
  timestamp: number;
  frameId: number;
  
  // What we detected
  faceCount: number;
  faces: Array<{
    landmarks: {
      nose: Point;
      leftEar: Point;
      rightEar: Point;
    };
    boundingBox: FaceBox;
    headPose: HeadPose;
    metrics: {
      yaw: number;      // -1 to 1 (left to right)
      pitch: number;    // -1 to 1 (up to down)
    };
  }>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const HEAD_POSE_THRESHOLDS = {
  YAW_LEFT: 0.25,
  YAW_RIGHT: 0.75,
  PITCH_UP: -0.1,
  PITCH_DOWN: 0.15
};

// ============================================================================
// MEDIAPIPE INITIALIZATION
// ============================================================================

let faceLandmarker: FaceLandmarker | null = null;
let isInitialized = false;

async function initializeFaceLandmarker(): Promise<void> {
  if (isInitialized && faceLandmarker) return;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numFaces: 2,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });

  isInitialized = true;
}

// ============================================================================
// PURE HELPER FUNCTIONS (No state, no side effects)
// ============================================================================

function calculateFaceBox(
  landmarks: Array<{ x: number; y: number }>,
  videoWidth: number,
  videoHeight: number
): FaceBox {
  const xCoords = landmarks.map(l => l.x * videoWidth);
  const yCoords = landmarks.map(l => l.y * videoHeight);

  return {
    x: Math.round(Math.min(...xCoords)),
    y: Math.round(Math.min(...yCoords)),
    width: Math.round(Math.max(...xCoords) - Math.min(...xCoords)),
    height: Math.round(Math.max(...yCoords) - Math.min(...yCoords))
  };
}

function analyzeHeadPose(
  nose: { x: number; y: number },
  leftEar: { x: number; y: number },
  rightEar: { x: number; y: number }
): {
  pose: HeadPose;
  metrics: { yaw: number; pitch: number };
} {
  // Calculate Yaw (horizontal)
  const faceWidth = rightEar.x - leftEar.x;
  const noseRelX = (nose.x - leftEar.x) / faceWidth;

  // Calculate Pitch (vertical)
  const earYAvg = (leftEar.y + rightEar.y) / 2;
  const noseDrop = nose.y - earYAvg;

  // Normalize metrics to -1 to 1 range
  const yaw = (noseRelX - 0.5) * 2;  // 0.0->-1, 0.5->0, 1.0->1
  const pitch = noseDrop;

  // Determine pose
  let pose: HeadPose = 'CENTER';

  if (noseDrop < HEAD_POSE_THRESHOLDS.PITCH_UP) {
    pose = 'LOOKING_UP';
  } else if (noseDrop > HEAD_POSE_THRESHOLDS.PITCH_DOWN) {
    pose = 'LOOKING_DOWN';
  } else if (noseRelX < HEAD_POSE_THRESHOLDS.YAW_LEFT) {
    pose = 'LOOKING_LEFT';
  } else if (noseRelX > HEAD_POSE_THRESHOLDS.YAW_RIGHT) {
    pose = 'LOOKING_RIGHT';
  }

  return { pose, metrics: { yaw, pitch } };
}

// ============================================================================
// MAIN DETECTION FUNCTION (PURE - No business logic)
// ============================================================================

export async function detectFaces(
  video: HTMLVideoElement
): Promise<FaceDetectionResult> {
  
  if (!isInitialized || !faceLandmarker) {
    await initializeFaceLandmarker();
  }

  if (!faceLandmarker || !video || video.readyState < 2) {
    return {
      timestamp: Date.now(),
      frameId: 0,
      faceCount: 0,
      faces: []
    };
  }

  const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(
    video,
    performance.now()
  );

  const videoWidth = video.videoWidth || video.clientWidth || 640;
  const videoHeight = video.videoHeight || video.clientHeight || 480;

  // No faces detected
  if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
    return {
      timestamp: Date.now(),
      frameId: Math.floor(video.currentTime * 1000),
      faceCount: 0,
      faces: []
    };
  }

  // Process all detected faces
  const faces = results.faceLandmarks.map(landmarks => {
    // MediaPipe indices: nose=1, leftEar=234, rightEar=454
    const noseLandmark = landmarks[1];
    const leftEarLandmark = landmarks[234];
    const rightEarLandmark = landmarks[454];

    const nose: Point = {
      x: Math.round(noseLandmark.x * videoWidth),
      y: Math.round(noseLandmark.y * videoHeight)
    };

    const leftEar: Point = {
      x: Math.round(leftEarLandmark.x * videoWidth),
      y: Math.round(leftEarLandmark.y * videoHeight)
    };

    const rightEar: Point = {
      x: Math.round(rightEarLandmark.x * videoWidth),
      y: Math.round(rightEarLandmark.y * videoHeight)
    };

    const headPoseAnalysis = analyzeHeadPose(
      noseLandmark,
      leftEarLandmark,
      rightEarLandmark
    );

    return {
      landmarks: { nose, leftEar, rightEar },
      boundingBox: calculateFaceBox(landmarks, videoWidth, videoHeight),
      headPose: headPoseAnalysis.pose,
      metrics: headPoseAnalysis.metrics
    };
  });

  return {
    timestamp: Date.now(),
    frameId: Math.floor(video.currentTime * 1000),
    faceCount: faces.length,
    faces
  };
}

// ============================================================================
// CONTINUOUS DETECTION (For React hooks)
// ============================================================================

export interface DetectionCallbacks {
  onDetection: (result: FaceDetectionResult) => void;
  onError?: (error: Error) => void;
}

export async function startContinuousDetection(
  video: HTMLVideoElement,
  callbacks: DetectionCallbacks,
  fps: number = 5 // 5 FPS default
): Promise<() => void> {
  
  await initializeFaceLandmarker();

  let intervalId: number | null = null;
  let lastVideoTime = -1;

  const detect = async () => {
    try {
      // Skip if same frame
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const result = await detectFaces(video);
      callbacks.onDetection(result);
      
    } catch (error) {
      callbacks.onError?.(error as Error);
    }
  };

  // Start detection loop
  const interval = 1000 / fps;
  intervalId = window.setInterval(detect, interval) as unknown as number;

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

export default detectFaces;