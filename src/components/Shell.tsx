"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

interface Item {
  href: string;
  label: string;
}

export default function Shell({ children }: { children: ReactNode }) {
  const { perfil, sair } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const itens: Item[] = [
    { href: "/painel", label: "Painel" },
    { href: "/turmas", label: "Turmas" },
    { href: "/alunos", label: "Alunos" },
    { href: "/chamadas", label: "Chamadas" },
    { href: "/historico", label: "Histórico" },
  ];

  const podeEvasao =
    perfil?.role === "admin" || perfil?.evasaoPermitida === true;
  if (podeEvasao) itens.push({ href: "/evasao", label: "Monitoramento de Evasão" });
  if (perfil?.role === "admin") itens.push({ href: "/mediadores", label: "Mediadores" });

  async function sairAgora() {
    await sair();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/painel" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marca-600 text-sm font-bold text-white">
              CP
            </span>
            <span className="text-base font-bold text-slate-800">
              Controle de Presença
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-700">
                {perfil?.nome}
              </p>
              <p className="text-xs text-slate-500">
                {perfil?.role === "admin" ? "Administrador" : "Mediador"}
              </p>
            </div>
            <button onClick={sairAgora} className="btn-secundario">
              Sair
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-2">
          <ul className="flex gap-1 pb-1">
            {itens.map((i) => {
              const ativo =
                pathname === i.href || pathname.startsWith(i.href + "/");
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    className={
                      "inline-block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition " +
                      (ativo
                        ? "bg-marca-50 text-marca-700"
                        : "text-slate-600 hover:bg-slate-100")
                    }
                  >
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
