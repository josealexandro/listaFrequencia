import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// As chaves vêm de variáveis de ambiente (.env.local / Vercel).
// Nenhuma credencial fica escrita no código.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function appPrincipal(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export const auth = getAuth(appPrincipal());
export const db = getFirestore(appPrincipal());

// App secundário usado apenas pelo administrador para cadastrar novos
// mediadores sem encerrar a própria sessão.
export function appSecundario(): FirebaseApp {
  const existente = getApps().find((a) => a.name === "secundario");
  return existente ?? initializeApp(config, "secundario");
}
