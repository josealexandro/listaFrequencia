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

interface ContextoAuth {
  carregando: boolean;
  user: User | null;
  perfil: Perfil | null;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<ContextoAuth>({
  carregando: true,
  user: null,
  perfil: null,
  recarregarPerfil: async () => {},
  sair: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const carregarPerfil = useCallback(async (u: User | null) => {
    if (!u) {
      setPerfil(null);
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", u.uid));
      setPerfil(snap.exists() ? ({ uid: u.uid, ...snap.data() } as Perfil) : null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("ERRO ao carregar perfil:", err);
      setPerfil(null);
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
    <Ctx.Provider value={{ carregando, user, perfil, recarregarPerfil, sair }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
