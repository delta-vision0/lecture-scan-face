const CACHE_NAME = 'lecture-scan-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/models/tiny_face_detector_model/tiny_face_detector_model-weights_manifest.json',
  '/models/tiny_face_detector_model/tiny_face_detector_model-shard1',
  '/models/face_landmark_68_model/face_landmark_68_model-weights_manifest.json',
  '/models/face_landmark_68_model/face_landmark_68_model-shard1',
  '/models/face_recognition_model/face_recognition_model-weights_manifest.json',
  '/models/face_recognition_model/face_recognition_model-shard1',
  '/models/face_recognition_model/face_recognition_model-shard2',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});


