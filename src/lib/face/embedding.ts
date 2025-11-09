import * as faceapi from 'face-api.js';

const detectionOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
});

export interface FaceDetectionResult {
  box: { x: number; y: number; width: number; height: number };
  descriptor: Float32Array;
}

export async function getEmbeddingFromVideo(
  videoEl: HTMLVideoElement
): Promise<FaceDetectionResult | null> {
  try {
    const detection = await faceapi
      .detectSingleFace(videoEl, detectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    const box = detection.detection.box;
    
    // Require face region >= 150x150 px
    if (box.width < 150 || box.height < 150) {
      return null;
    }

    return {
      box: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      descriptor: detection.descriptor,
    };
  } catch (error) {
    console.error('Error detecting face from video:', error);
    return null;
  }
}

export async function getEmbeddingFromImage(
  input: HTMLImageElement | File
): Promise<FaceDetectionResult | null> {
  try {
    let img: HTMLImageElement;

    if (input instanceof File) {
      img = await createImageElement(input);
    } else {
      img = input;
    }

    const detections = await faceapi
      .detectAllFaces(img, detectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      throw new Error('No face detected in the image');
    }

    if (detections.length > 1) {
      throw new Error('Multiple faces detected. Please use an image with exactly one face.');
    }

    const detection = detections[0];
    const box = detection.detection.box;

    // Require face region >= 150x150 px
    if (box.width < 150 || box.height < 150) {
      throw new Error('Face detected is too small. Please use a closer image.');
    }

    return {
      box: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      descriptor: detection.descriptor,
    };
  } catch (error) {
    throw error;
  }
}

function createImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export function euclideanDistance(a: Float32Array, b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Arrays must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}
