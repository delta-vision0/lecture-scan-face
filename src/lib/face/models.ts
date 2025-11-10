import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector_model'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68_model'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition_model'),
    ]);
    modelsLoaded = true;
    console.log('Face-api.js models loaded successfully');
  } catch (error) {
    console.error('Error loading face-api.js models:', error);
    throw error;
  }
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}
