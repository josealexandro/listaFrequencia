"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { dataYMD, formatarData, formatarHora } from "@/lib/format";
import { baixarRelatorio, carregarPresencas } from "@/lib/relatorio";
import type { Chamada, Turma } from "@/lib/tipos";

export default function HistoricoPage() {
  const { perfil } = useAuth();
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [filtroTurma, setFiltroTurma] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState("");

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setCarregando(true);
    const [c, t] = await Promise.all([
      getDocs(query(collection(db, "chamadas"), where("mediadorId", "==", perfil.uid))),
      getDocs(query(collection(db, "turmas"), where("mediadorId", "==", perfil.uid))),
    ]);
    const lista = c.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Chamada)
      .filter((x) => x.status === "encerrada" || x.status === "cancelada")
      .sort(
        (a, b) =>
          (b.abertaEm?.toMillis?.() ?? 0) - (a.abertaEm?.toMillis?.() ?? 0),
      );
    setChamadas(lista);
    setTurmas(t.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma));
    setCarregando(false);
  }, [perfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const visiveis = useMemo(
    () =>
      chamadas.filter(
        (c) =>
          (!filtroTurma || c.turmaId === filtroTurma) &&
          (!filtroData || dataYMD(c.abertaEm) === filtroData),
      ),
    [chamadas, filtroTurma, filtroData],
  );

  async function baixar(c: Chamada) {
    setErro("");
    setBaixando(c.id);
    try {
      const presencas = await carregarPresencas(c.id);
      await baixarRelatorio(c, presencas);
    } catch {
      setErro("Não foi possível gerar o PDF desta chamada.");
    } finally {
      setBaixando("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Histórico de chamadas</h1>
        <p className="text-sm text-slate-500">
          Da mais recente para a mais antiga. Os registros anteriores são mantidos.
        </p>
      </div>

      <div className="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
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
          <div>
            <label className="label">Data da chamada</label>
            <input
              type="date"
              className="input"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
            />
          </div>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">
          Chamadas ({visiveis.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Turma</th>
                <th>Data</th>
                <th>Abertura / Encerramento</th>
                <th>Presenças</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">
                    {c.turmaNome}
                    {c.cursoNome ? (
                      <span className="block text-xs text-slate-400">
                        {c.cursoNome}
                      </span>
                    ) : null}
                  </td>
                  <td>{formatarData(c.abertaEm)}</td>
                  <td>
                    {formatarHora(c.abertaEm)} / {formatarHora(c.encerradaEm)}
                  </td>
                  <td>
                    {c.totalPresentes ?? 0} / {c.totalAlunos}
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (c.status === "encerrada"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700")
                      }
                    >
                      {c.status === "encerrada" ? "Encerrada" : "Cancelada"}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      href={`/chamadas/${c.id}`}
                      className="text-sm font-semibold text-marca-600"
                    >
                      Resumo
                    </Link>
                    <button
                      className="ml-3 text-sm font-semibold text-slate-600"
                      onClick={() => baixar(c)}
                      disabled={baixando === c.id}
                    >
                      {baixando === c.id ? "Gerando..." : "Baixar PDF"}
                    </button>
                  </td>
                </tr>
              ))}
              {!carregando && visiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400">
                    Nenhuma chamada encontrada.
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
