import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';

// Konfigurasi Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyD-o1P9LzNV8Ydf2UG8zybCOypR-96HItg",
  authDomain: "generator-kbc.firebaseapp.com",
  projectId: "generator-kbc",
  storageBucket: "generator-kbc.firebasestorage.app",
  messagingSenderId: "381800380002",
  appId: "1:381800380002:web:620dd0da8ae35e4722c33b",
  measurementId: "G-DPH7GDF1CQ"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Eksport auth & db
export const auth = getAuth(app);
export const db = getFirestore(app);

// 2. Export functions & pemanggil endpoint
export const functions = getFunctions(app);
export const callGeneratePerangkat = httpsCallable(functions, 'generatePerangkat');

// Fungsi Login Email & Password
export const loginWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Fungsi Register/Daftar Akun Baru
export const registerWithEmail = async (email, password) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Fungsi Logout
export const logoutAccount = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};