import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate Firebase config
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
for (const field of requiredFields) {
  if (!firebaseConfig[field as keyof typeof firebaseConfig]) {
    console.error(`Missing Firebase config: ${field}`);
  }
}

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const firebaseAuth = getAuth(firebaseApp);

// Set persistence to LOCAL so users stay logged in (use proper Firebase persistence class)
setPersistence(firebaseAuth, browserLocalPersistence)
  .then(() => console.log('Firebase persistence set to LOCAL'))
  .catch(err => console.error('Firebase persistence error:', err));
