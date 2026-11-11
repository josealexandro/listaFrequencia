"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Shell from "@/components/Shell";

export default function AreaRestritaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { carregando, user, perfil, sair } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && !user) router.replace("/login");
  }, [carregando, user, router]);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Carregando...
      </div>
    );
  }

  if (!user) return null;

  // Conta sem perfil ou desativada pelo administrador.
  if (!perfil || perfil.ativo !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-bold text-slate-800">Acesso indisponível</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sua conta não possui perfil de acesso ativo neste sistema. Procure o
            administrador principal.
          </p>
          <button
            className="btn-secundario mt-4"
            onClick={async () => {
              await sair();
              router.replace("/login");
            }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
