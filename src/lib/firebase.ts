import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBtN9x5eQtri5LEcDbYz_4PBxRmYI6ZEeQ",
  authDomain: "kromos-card.firebaseapp.com",
  projectId: "kromos-card",
  storageBucket: "kromos-card.firebasestorage.app",
  messagingSenderId: "583344327904",
  appId: "1:583344327904:web:ca36be1d9502558662d485",
  measurementId: "G-G0LKLC3T04",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const initAnalytics = async () => {
  if (typeof window !== "undefined" && (await isSupported())) {
    return getAnalytics(app);
  }
  return null;
};