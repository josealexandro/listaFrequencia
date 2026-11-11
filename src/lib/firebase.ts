import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// As chaves vêm de variáveis de ambiente (.env.local). Nenhuma
// credencial fica escrita no código.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
function appPrincipal(): FirebaseApp {
  if (!_app) _app = getApps().length ? getApp() : initializeApp(config);
  return _app;
}

// Inicialização preguiçosa: auth e db só são criados na primeira vez que
// são usados. Isso evita que o build quebre quando as variáveis de
// ambiente ainda não estão definidas (ex.: ambiente de CI sem config).
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function proxyLazy<T extends object>(criar: () => T): T {
  let instancia: T | null = null;
  return new Proxy({} as T, {
    get(_, prop) {
      if (!instancia) instancia = criar();
      const valor = Reflect.get(instancia, prop, instancia);
      return typeof valor === "function" ? (valor as (...args: unknown[]) => unknown).bind(instancia) : valor;
    },
  });
}

export const auth = proxyLazy(() => {
  if (!_auth) _auth = getAuth(appPrincipal());
  return _auth;
});

export const db = proxyLazy(() => {
  if (!_db) _db = getFirestore(appPrincipal());
  return _db;
});

// App secundário usado apenas pelo administrador para cadastrar novos
// mediadores sem encerrar a própria sessão.
export function appSecundario(): FirebaseApp {
  const existente = getApps().find((a) => a.name === "secundario");
  return existente ?? initializeApp(config, "secundario");
}
