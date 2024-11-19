import { initializeApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { REACT_APP_FIREBASE_API } from "@env";
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: REACT_APP_FIREBASE_API,
  authDomain: "authflow-97602.firebaseapp.com",
  projectId: "authflow-97602",
  storageBucket: "authflow-97602.appspot.com",
  messagingSenderId: "395516645635",
  appId: "1:395516645635:web:5ad60a9f7ba71fca4d1936",
  measurementId: "G-02VK7G22D6",
};

// Initialize Firebase only if it hasn't been initialized yet
let app;
let analytics;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
export { app, analytics, auth, db, storage };
