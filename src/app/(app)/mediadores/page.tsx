"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import type { Perfil } from "@/lib/tipos";

interface Atividade {
  turmas: number;
  alunos: number;
  chamadas: number;
}

export default function MediadoresPage() {
  const { perfil, user } = useAuth();
  const [mediadores, setMediadores] = useState<Perfil[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [atividade, setAtividade] = useState<Record<string, Atividade>>({});
  const [carregando, setCarregando] = useState(true);
  const [removendoUid, setRemovendoUid] = useState<string | null>(null);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  const administrador = perfil?.role === "admin";

  const carregar = useCallback(async () => {
    if (!administrador) return;
    setCarregando(true);
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "==", "mediador")),
    );
    const lista = snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Perfil);
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    setMediadores(lista);
    setCarregando(false);
  }, [administrador]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mediadoresAtivos = mediadores.filter((m) => !m.deletado);
  const mediadoresArquivados = mediadores.filter((m) => m.deletado);
  const mediadoresVisiveis = mostrarArquivados ? mediadoresArquivados : mediadoresAtivos;

  async function alternarAtivo(m: Perfil) {
    setErro("");
    setAviso("");
    try {
      await updateDoc(doc(db, "users", m.uid), { ativo: !m.ativo });
      setAviso(
        `Conta de ${m.nome} ${m.ativo ? "desativada" : "ativada"} com sucesso.`,
      );
      await carregar();
    } catch {
      setErro("Nao foi possivel alterar a situacao do mediador.");
    }
  }

  async function alternarEvasao(m: Perfil) {
    setErro("");
    setAviso("");
    try {
      await updateDoc(doc(db, "users", m.uid), {
        evasaoPermitida: !m.evasaoPermitida,
      });
      setAviso(
        `Permissao de evasao de ${m.nome} ${
          m.evasaoPermitida ? "retirada" : "liberada"
        } com sucesso.`,
      );
      await carregar();
    } catch {
      setErro("Nao foi possivel alterar a permissao de evasao.");
    }
  }

  async function verAtividade(m: Perfil) {
    if (atividade[m.uid]) {
      setAtividade((a) => {
        const copia = { ...a };
        delete copia[m.uid];
        return copia;
      });
      return;
    }
    try {
      const [t, a, c] = await Promise.all([
        getCountFromServer(
          query(collection(db, "turmas"), where("mediadorId", "==", m.uid)),
        ),
        getCountFromServer(
          query(collection(db, "alunos"), where("mediadorId", "==", m.uid)),
        ),
        getCountFromServer(
          query(collection(db, "chamadas"), where("mediadorId", "==", m.uid)),
        ),
      ]);
      setAtividade((prev) => ({
        ...prev,
        [m.uid]: {
          turmas: t.data().count,
          alunos: a.data().count,
          chamadas: c.data().count,
        },
      }));
    } catch {
      setErro("Nao foi possivel carregar as atividades deste mediador.");
    }
  }

  async function atualizarArquivamento(
    m: Perfil,
    action: "archive" | "restore",
  ) {
    if (!user) return;

    const confirmado = window.confirm(
      action === "archive"
        ? `Arquivar ${m.nome}? A conta saira da lista principal e perdera o acesso.`
        : `Restaurar ${m.nome}? A conta voltara para a lista principal e podera acessar o sistema.`,
    );
    if (!confirmado) return;

    setErro("");
    setAviso("");
    setRemovendoUid(m.uid);

    try {
      const token = await user.getIdToken();
      const resp = await fetch(`/api/admin/mediadores/${m.uid}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const body = (await resp.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!resp.ok) {
        throw new Error(body.error || "Nao foi possivel atualizar o mediador.");
      }

      setAviso(
        body.message ||
          `Mediador ${m.nome} ${
            action === "archive" ? "arquivado" : "restaurado"
          } com sucesso.`,
      );
      setAtividade((prev) => {
        const copia = { ...prev };
        delete copia[m.uid];
        return copia;
      });
      await carregar();
    } catch (err: unknown) {
      setErro(
        err instanceof Error
          ? err.message
          : "Nao foi possivel atualizar o mediador.",
      );
    } finally {
      setRemovendoUid(null);
    }
  }

  if (!administrador) {
    return (
      <div className="card">
        <h1 className="text-lg font-bold text-slate-800">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-600">
          Apenas o administrador principal pode gerenciar mediadores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Gerenciamento de mediadores
        </h1>
        <p className="text-sm text-slate-500">
          Mediadores criam a propria conta por Google ou e-mail. Aqui voce controla
          ativacao, permissao de evasao e arquivamento de acesso.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold text-slate-800">Novo fluxo</h2>
        <p className="text-sm text-slate-600">
          O mediador entra em <strong>/login</strong> e cria a conta com Google
          ou e-mail e senha. No primeiro acesso, o perfil dele e
          criado automaticamente como mediador.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Ao arquivar, o mediador perde o acesso e some da lista principal,
          mas o historico permanece preservado.
        </p>
        {erro && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        {aviso && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {aviso}
          </p>
        )}
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">
            {mostrarArquivados
              ? `Mediadores arquivados (${mediadoresArquivados.length})`
              : `Mediadores ativos (${mediadoresAtivos.length})`}
          </h2>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => setMostrarArquivados((v) => !v)}
          >
            {mostrarArquivados ? "Mostrar ativos" : "Mostrar arquivados"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Situação</th>
                <th>Acesso à evasão</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mediadoresVisiveis.map((m) => (
                <tr key={m.uid}>
                  <td className="font-medium">{m.nome}</td>
                  <td>{m.email}</td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (m.deletado
                          ? "bg-amber-50 text-amber-800"
                          : m.ativo
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {m.deletado ? "Arquivado" : m.ativo ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (m.evasaoPermitida
                          ? "bg-marca-50 text-marca-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {m.evasaoPermitida ? "Liberado" : "Não liberado"}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {!m.deletado && (
                      <button
                        className="text-sm font-semibold text-marca-600"
                        onClick={() => alternarAtivo(m)}
                        disabled={removendoUid === m.uid}
                      >
                        {m.ativo ? "Desativar" : "Ativar"}
                      </button>
                    )}
                    {!m.deletado && (
                      <button
                        className="ml-3 text-sm font-semibold text-marca-600"
                        onClick={() => alternarEvasao(m)}
                        disabled={removendoUid === m.uid}
                      >
                        {m.evasaoPermitida ? "Retirar evasao" : "Liberar evasao"}
                      </button>
                    )}
                    <button
                      className="ml-3 text-sm font-semibold text-slate-600"
                      onClick={() => verAtividade(m)}
                      disabled={removendoUid === m.uid}
                    >
                      Atividades
                    </button>
                    <button
                      className={
                        "ml-3 text-sm font-semibold " +
                        (m.deletado ? "text-emerald-600" : "text-red-600")
                      }
                      onClick={() =>
                        atualizarArquivamento(m, m.deletado ? "restore" : "archive")
                      }
                      disabled={removendoUid === m.uid}
                    >
                      {removendoUid === m.uid
                        ? "Salvando..."
                        : m.deletado
                          ? "Restaurar"
                          : "Arquivar"}
                    </button>
                  </td>
                </tr>
              ))}
              {!carregando && mediadoresVisiveis.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400">
                    {mostrarArquivados
                      ? "Nenhum mediador arquivado."
                      : "Nenhum mediador ativo."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {Object.entries(atividade).map(([uid, a]) => {
          const m = mediadores.find((x) => x.uid === uid);
          if (!m) return null;
          return (
            <p key={uid} className="mt-3 text-sm text-slate-600">
              <strong>{m.nome}</strong>: {a.turmas} turma(s), {a.alunos} aluno(s),{" "}
              {a.chamadas} chamada(s).
            </p>
          );
        })}
      </div>
    </div>
  );
}
