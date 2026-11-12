"use client";

import { useMemo, useState } from "react";
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
  const [menuAberto, setMenuAberto] = useState(false);

  const itens: Item[] = useMemo(() => {
    const base: Item[] = [
      { href: "/painel", label: "Painel" },
      { href: "/turmas", label: "Turmas" },
      { href: "/alunos", label: "Alunos" },
      { href: "/chamadas", label: "Chamadas" },
      { href: "/historico", label: "Histórico" },
    ];

    const podeEvasao =
      perfil?.role === "admin" || perfil?.evasaoPermitida === true;
    if (podeEvasao) {
      base.push({ href: "/evasao", label: "Monitoramento de Evasão" });
    }
    if (perfil?.role === "admin") {
      base.push({ href: "/mediadores", label: "Mediadores" });
    }
    return base;
  }, [perfil?.evasaoPermitida, perfil?.role]);

  async function sairAgora() {
    await sair();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/painel"
            className="flex min-w-0 items-center gap-2"
            onClick={() => setMenuAberto(false)}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marca-600 text-sm font-bold text-white">
              CP
            </span>
            <span className="truncate text-sm font-bold text-slate-800 sm:text-base">
              Controle de Presença
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold text-slate-700">
                {perfil?.nome}
              </p>
              <p className="text-xs text-slate-500">
                {perfil?.role === "admin" ? "Administrador" : "Mediador"}
              </p>
            </div>
            <button
              type="button"
              className="btn-secundario px-3 md:hidden"
              onClick={() => setMenuAberto((v) => !v)}
              aria-expanded={menuAberto}
              aria-controls="menu-principal"
            >
              {menuAberto ? "Fechar" : "Menu"}
            </button>
            <button onClick={sairAgora} className="btn-secundario">
              Sair
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
              {perfil?.nome || "Usuário"}
            </p>
            <p className="text-xs text-slate-500">
              {perfil?.role === "admin" ? "Administrador" : "Mediador"}
            </p>
          </div>
        </div>

        <nav
          id="menu-principal"
          className={
            "mx-auto max-w-6xl px-2 md:px-4 " +
            (menuAberto ? "block" : "hidden md:block")
          }
        >
          <ul className="grid gap-2 pb-3 md:flex md:gap-1 md:overflow-x-auto md:pb-1">
            {itens.map((i) => {
              const ativo =
                pathname === i.href || pathname.startsWith(i.href + "/");
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setMenuAberto(false)}
                    className={
                      "block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition md:inline-block " +
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

      <main className="mx-auto max-w-6xl px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
