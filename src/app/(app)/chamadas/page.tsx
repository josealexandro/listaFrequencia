"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { formatarDataHora, hojeYMD } from "@/lib/format";
import type { Aluno, AlunoSnapshot, Chamada, Turma } from "@/lib/tipos";

function gerarToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ChamadasPage() {
  const { perfil } = useAuth();
  const router = useRouter();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [abertas, setAbertas] = useState<Chamada[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!perfil) return;
    const [t, a, c] = await Promise.all([
      getDocs(query(collection(db, "turmas"), where("mediadorId", "==", perfil.uid))),
      getDocs(query(collection(db, "alunos"), where("mediadorId", "==", perfil.uid))),
      getDocs(query(collection(db, "chamadas"), where("mediadorId", "==", perfil.uid))),
    ]);
    const listaTurmas = t.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma);
    listaTurmas.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
    setTurmas(listaTurmas);
    setAlunos(a.docs.map((d) => ({ id: d.id, ...d.data() }) as Aluno));
    setAbertas(
      c.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Chamada)
        .filter((x) => x.status === "aberta"),
    );
  }, [perfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const turmasAtivas = useMemo(
    () => turmas.filter((t) => t.situacao === "ativa"),
    [turmas],
  );

  async function abrirChamada() {
    if (!perfil) return;
    setErro("");
    const turma = turmas.find((t) => t.id === turmaSelecionada);
    if (!turma) return setErro("Selecione uma turma.");
    if (turma.situacao !== "ativa") return setErro("Esta turma está inativa.");

    if (abertas.some((c) => c.turmaId === turma.id)) {
      return setErro(
        "Já existe uma chamada aberta para esta turma. Encerre-a antes de abrir outra.",
      );
    }

    const hoje = hojeYMD();
    const ativos: AlunoSnapshot[] = alunos
      .filter(
        (a) =>
          a.turmaId === turma.id &&
          a.situacao === "ativo" &&
          (!a.dataEntrada || a.dataEntrada <= hoje),
      )
      .map((a) => ({ id: a.id, nome: a.nome, matricula: a.matricula || "" }))
      .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));

    if (ativos.length === 0) {
      return setErro(
        "Esta turma não possui alunos ativos com entrada até hoje. Cadastre os alunos primeiro.",
      );
    }

    setAbrindo(true);
    try {
      const token = gerarToken();
      await setDoc(doc(db, "chamadas", token), {
        token,
        mediadorId: perfil.uid,
        mediadorNome: perfil.nome,
        turmaId: turma.id,
        turmaNome: turma.nome,
        cursoNome: turma.curso ?? "",
        status: "aberta",
        abertaEm: serverTimestamp(),
        totalAlunos: ativos.length,
        totalPresentes: 0,
        alunos: ativos,
        alunoIds: ativos.map((a) => a.id),
      });
      router.push(`/chamadas/${token}`);
    } catch {
      setErro("Não foi possível abrir a chamada. Tente novamente.");
      setAbrindo(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Chamadas</h1>
        <p className="text-sm text-slate-500">
          Abra uma chamada e compartilhe o link com os alunos.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold text-slate-800">Abrir nova chamada</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="label">Turma</label>
            <select
              className="input"
              value={turmaSelecionada}
              onChange={(e) => setTurmaSelecionada(e.target.value)}
            >
              <option value="">Selecione a turma...</option>
              {turmasAtivas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <button onClick={abrirChamada} className="btn-primario" disabled={abrindo}>
            {abrindo ? "Abrindo..." : "Abrir chamada"}
          </button>
        </div>
        {turmasAtivas.length === 0 && (
          <p className="mt-3 text-sm text-amber-700">
            Você não possui turmas ativas.{" "}
            <Link href="/turmas" className="font-semibold underline">
              Cadastrar turma
            </Link>
          </p>
        )}
        {erro && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          A data e o horário de abertura são registrados automaticamente pelo
          servidor (fuso America/Recife).
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">
          Chamadas em andamento ({abertas.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Turma</th>
                <th>Abertura</th>
                <th>Alunos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {abertas.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.turmaNome}</td>
                  <td>{formatarDataHora(c.abertaEm)}</td>
                  <td>{c.totalAlunos}</td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      href={`/chamadas/${c.id}`}
                      className="text-sm font-semibold text-marca-600"
                    >
                      Acompanhar e encerrar
                    </Link>
                  </td>
                </tr>
              ))}
              {abertas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400">
                    Nenhuma chamada aberta no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
