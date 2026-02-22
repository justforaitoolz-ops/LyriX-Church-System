import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
// React Native / Expo specific persistence
import { getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyAGcC_oF9aLuK_ofHuE7I3wEafBs5ckfbo",
    authDomain: "church-lyrics-viewer.firebaseapp.com",
    projectId: "church-lyrics-viewer",
    storageBucket: "church-lyrics-viewer.firebasestorage.app",
    messagingSenderId: "134711184790",
    appId: "1:134711184790:web:7889e6330bc459f00a21b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with default settings (React Native handles persistence differently usually, but standard init works for many cases in newer SDKs, 
// OR we let it default. For offline, we just need initializeFirestore)
const db = getFirestore(app);

export { db };
