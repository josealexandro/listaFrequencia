"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { formatarDataHora } from "@/lib/format";
import type { Aluno, Chamada, Turma } from "@/lib/tipos";

export default function PainelPage() {
  const { perfil } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [abertas, setAbertas] = useState<Chamada[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setCarregando(true);
    const [t, a, c] = await Promise.all([
      getDocs(query(collection(db, "turmas"), where("mediadorId", "==", perfil.uid))),
      getDocs(query(collection(db, "alunos"), where("mediadorId", "==", perfil.uid))),
      getDocs(query(collection(db, "chamadas"), where("mediadorId", "==", perfil.uid))),
    ]);
    setTurmas(t.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma));
    setAlunos(a.docs.map((d) => ({ id: d.id, ...d.data() }) as Aluno));
    setAbertas(
      c.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Chamada)
        .filter((x) => x.status === "aberta"),
    );
    setCarregando(false);
  }, [perfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const turmasAtivas = turmas.filter((t) => t.situacao === "ativa").length;
  const alunosAtivos = alunos.filter((a) => a.situacao === "ativo").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Olá, {perfil?.nome}
        </h1>
        <p className="text-sm text-slate-500">
          Painel inicial do sistema de controle de presença.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Turmas ativas</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">
            {carregando ? "..." : turmasAtivas}
          </p>
          <Link href="/turmas" className="mt-2 inline-block text-sm text-marca-600">
            Gerenciar turmas
          </Link>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Alunos ativos</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">
            {carregando ? "..." : alunosAtivos}
          </p>
          <Link href="/alunos" className="mt-2 inline-block text-sm text-marca-600">
            Gerenciar alunos
          </Link>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Chamadas abertas</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">
            {carregando ? "..." : abertas.length}
          </p>
          <Link href="/chamadas" className="mt-2 inline-block text-sm text-marca-600">
            Ir para chamadas
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            Ação rápida: abrir chamada
          </h2>
          <Link href="/chamadas" className="btn-primario">
            Abrir chamada
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Selecione a turma e gere o link e o QR Code para os alunos.
        </p>
      </div>

      {abertas.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">
            Chamadas em andamento
          </h2>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Abertura</th>
                  <th>Alunos na chamada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {abertas.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.turmaNome}</td>
                    <td>{formatarDataHora(c.abertaEm)}</td>
                    <td>{c.totalAlunos}</td>
                    <td className="text-right">
                      <Link
                        href={`/chamadas/${c.id}`}
                        className="text-sm font-semibold text-marca-600"
                      >
                        Acompanhar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
