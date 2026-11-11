"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Perfil } from "./tipos";

const ESPERA_PERFIL_MS = 250;
const MAX_TENTATIVAS_PERFIL = 8;

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ContextoAuth {
  carregando: boolean;
  carregandoPerfil: boolean;
  user: User | null;
  perfil: Perfil | null;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<ContextoAuth>({
  carregando: true,
  carregandoPerfil: true,
  user: null,
  perfil: null,
  recarregarPerfil: async () => {},
  sair: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const carregarPerfil = useCallback(async (u: User | null) => {
    setCarregandoPerfil(true);

    if (!u) {
      setPerfil(null);
      setCarregandoPerfil(false);
      return;
    }

    try {
      let tentativas = 0;

      while (tentativas < MAX_TENTATIVAS_PERFIL) {
        const snap = await getDoc(doc(db, "users", u.uid));

        if (snap.exists()) {
          setPerfil({ uid: u.uid, ...snap.data() } as Perfil);
          return;
        }

        tentativas += 1;
        if (tentativas < MAX_TENTATIVAS_PERFIL) {
          await aguardar(ESPERA_PERFIL_MS);
        }
      }

      setPerfil(null);
    } catch {
      setPerfil(null);
    } finally {
      setCarregandoPerfil(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      await carregarPerfil(u);
      setCarregando(false);
    });
  }, [carregarPerfil]);

  const recarregarPerfil = useCallback(async () => {
    await carregarPerfil(auth.currentUser);
  }, [carregarPerfil]);

  const sair = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <Ctx.Provider
      value={{
        carregando,
        carregandoPerfil,
        user,
        perfil,
        recarregarPerfil,
        sair,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
