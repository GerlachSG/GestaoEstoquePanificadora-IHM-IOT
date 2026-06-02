// services/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyBNmPyufIeXznoUWvUxjp7JC9c82E5_5nk",
  authDomain: "tresirmaos-cloud.firebaseapp.com",
  projectId: "tresirmaos-cloud",
  storageBucket: "tresirmaos-cloud.firebasestorage.app",
  messagingSenderId: "544613186034",
  appId: "1:544613186034:web:5866cb7636280291bed36b",
  measurementId: "G-W0J67D3BZ1"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore (Banco de Dados em Tempo Real/Nuvem)
const db = getFirestore(app);

// Inicializa o Authentication
let auth: any;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  const { getReactNativePersistence } = require('firebase/auth');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export { app, db, auth };
