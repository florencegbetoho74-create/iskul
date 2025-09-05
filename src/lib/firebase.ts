import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth, initializeAuth, Auth,
  getReactNativePersistence
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// ⚠️ Pas d'import "firebase/auth/react-native" avec Firebase 12.x
// Utiliser getReactNativePersistence depuis "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyBMO121U-6cdMs07OK5dhei6Wf6QSEF0HE",
  authDomain: "iskul-d4135.firebaseapp.com",
  projectId: "iskul-d4135",
  storageBucket: "iskul-d4135.appspot.com",
  messagingSenderId: "447214196335",
  appId: "1:447214196335:web:1f4555836fc98936551f9a"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (!app) {
  app = initializeApp(firebaseConfig);

  // ✅ Persistance native (évite l’avertissement et garde la session)
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Hot reload / double init : on récupère simplement
    auth = getAuth(app);
  }

  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
