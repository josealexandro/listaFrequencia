"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";

export async function garantirPerfilMediador(
  user: User,
  nomeInformado?: string,
) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return;

  const nome =
    nomeInformado?.trim() ||
    user.displayName?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "Mediador";

  await setDoc(ref, {
    nome,
    email: user.email?.trim().toLowerCase() ?? "",
    role: "mediador",
    ativo: true,
    evasaoPermitida: false,
    criadoEm: serverTimestamp(),
  });
}
