"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { situacaoEvasao, atualizarEvasaoDaTurma } from "@/lib/evasao";
import { formatarData } from "@/lib/format";
import type { Evasao, Turma } from "@/lib/tipos";

function corSituacao(s: string): string {
  if (s === "Risco elevado") return "bg-red-50 text-red-700";
  if (s === "Atenção") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export default function EvasaoPage() {
  const { perfil } = useAuth();
  const [registros, setRegistros] = useState<Evasao[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [filtroTurma, setFiltroTurma] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const autorizado =
    perfil?.role === "admin" || perfil?.evasaoPermitida === true;

  const carregar = useCallback(async () => {
    if (!perfil || !autorizado) return;
    setCarregando(true);
    const [e, t] = await Promise.all([
      getDocs(query(collection(db, "evasao"), where("mediadorId", "==", perfil.uid))),
      getDocs(query(collection(db, "turmas"), where("mediadorId", "==", perfil.uid))),
    ]);
    setRegistros(e.docs.map((d) => ({ id: d.id, ...d.data() }) as Evasao));
    setTurmas(t.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma));
    setCarregando(false);
  }, [perfil, autorizado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const lista = filtroTurma
      ? registros.filter((r) => r.turmaId === filtroTurma)
      : registros;
    return [...lista].sort(
      (a, b) =>
        b.faltasConsecutivas - a.faltasConsecutivas ||
        a.alunoNome.localeCompare(b.alunoNome, "pt-BR"),
    );
  }, [registros, filtroTurma]);

  async function recalcular() {
    if (!perfil) return;
    setErro("");
    setAviso("");
    setRecalculando(true);
    try {
      for (const t of turmas) {
        await atualizarEvasaoDaTurma(perfil.uid, { id: t.id, nome: t.nome });
      }
      await carregar();
      setAviso("Monitoramento recalculado com base nas chamadas encerradas.");
    } catch {
      setErro("Não foi possível recalcular o monitoramento.");
    } finally {
      setRecalculando(false);
    }
  }

  if (!autorizado) {
    return (
      <div className="card">
        <h1 className="text-lg font-bold text-slate-800">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-600">
          Você não possui permissão para acessar o monitoramento de evasão.
          Solicite a liberação ao administrador principal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Monitoramento de Evasão
          </h1>
          <p className="text-sm text-slate-500">
            Calculado apenas com chamadas encerradas. Alunos com faltas
            consecutivas são sinalizados como em risco — nunca como evadidos.
          </p>
        </div>
        <button
          className="btn-secundario"
          onClick={recalcular}
          disabled={recalculando}
        >
          {recalculando ? "Recalculando..." : "Recalcular agora"}
        </button>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px]">
            <label className="label">Turma</label>
            <select
              className="input"
              value={filtroTurma}
              onChange={(e) => setFiltroTurma(e.target.value)}
            >
              <option value="">Todas as turmas</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <ul className="flex flex-wrap gap-3 text-xs text-slate-500">
            <li>1 falta: Normal</li>
            <li>2 faltas: Atenção</li>
            <li>3 ou mais: Risco elevado</li>
          </ul>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
      {aviso && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {aviso}
        </p>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">
          Alunos monitorados ({visiveis.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Turma</th>
                <th className="text-right">Faltas consecutivas</th>
                <th>Última presença</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((r) => {
                const s = situacaoEvasao(r.faltasConsecutivas);
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{r.alunoNome}</td>
                    <td>{r.turmaNome}</td>
                    <td className="text-right font-semibold">
                      {r.faltasConsecutivas}
                    </td>
                    <td>{r.ultimaPresenca ? formatarData(r.ultimaPresenca) : "Nunca"}</td>
                    <td>
                      <span className={"badge " + corSituacao(s)}>{s}</span>
                    </td>
                  </tr>
                );
              })}
              {!carregando && visiveis.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400">
                    Nenhum dado de monitoramento ainda. Encerre uma chamada ou use
                    &quot;Recalcular agora&quot;.
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
