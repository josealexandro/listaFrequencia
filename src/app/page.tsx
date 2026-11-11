"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { carregando, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    router.replace(user ? "/painel" : "/login");
  }, [carregando, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-slate-400">
      Carregando...
    </div>
  );
}
