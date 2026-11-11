"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FUSO } from "@/lib/format";
import type { Chamada } from "@/lib/tipos";

function horaLocal(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function PresencaPublicaPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [chamada, setChamada] = useState<Chamada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<{ id: string; nome: string } | null>(
    null,
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmado, setConfirmado] = useState("");

  useEffect(() => {
    if (!token) return;
    const ref = doc(db, "chamadas", token);
    const parar = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists() && snap.data().status === "aberta") {
          setChamada({ id: snap.id, ...snap.data() } as Chamada);
          setIndisponivel(false);
        } else {
          setChamada(null);
          setIndisponivel(true);
        }
        setCarregando(false);
      },
      () => {
        // Sem permissão: link inválido ou chamada já encerrada.
        setIndisponivel(true);
        setCarregando(false);
      },
    );
    return () => parar();
  }, [token]);

  const alunos = useMemo(() => {
    if (!chamada) return [];
    const termo = busca.trim().toLowerCase();
    const lista = termo
      ? chamada.alunos.filter((a) => a.nome.toLowerCase().includes(termo))
      : chamada.alunos;
    return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [chamada, busca]);

  async function confirmar() {
    if (!chamada || !selecionado) return;
    setErro("");
    setEnviando(true);
    try {
      await setDoc(doc(db, "chamadas", token, "presencas", selecionado.id), {
        alunoId: selecionado.id,
        alunoNome: selecionado.nome,
        confirmadoEm: serverTimestamp(),
      });
      setConfirmado(selecionado.nome);
    } catch (err: unknown) {
      const codigo = (err as { code?: string })?.code ?? "";
      if (codigo === "permission-denied") {
        setErro(
          "Não foi possível registrar: você já confirmou presença nesta chamada ou ela foi encerrada.",
        );
      } else {
        setErro("Falha ao registrar presença. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-400">
        Carregando...
      </main>
    );
  }

  if (confirmado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>
          <h1 className="mt-4 text-lg font-bold text-emerald-700">
            Presença registrada!
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            <strong>{confirmado}</strong>, sua presença foi registrada com sucesso
            às {horaLocal()}.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Você pode fechar esta página.
          </p>
        </div>
      </main>
    );
  }

  if (indisponivel || !chamada) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-800">
            Chamada indisponível
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Este link é inválido ou a chamada já foi encerrada pelo mediador.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-28">
      <header className="bg-marca-600 px-4 py-5 text-white">
        <p className="text-xs uppercase tracking-wide opacity-80">
          Registro de presença
        </p>
        <h1 className="text-lg font-bold">{chamada.turmaNome}</h1>
        {chamada.cursoNome && (
          <p className="text-sm opacity-90">{chamada.cursoNome}</p>
        )}
      </header>

      <div className="mx-auto max-w-md p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="label">Selecione seu nome</label>
          <input
            className="input"
            placeholder="Digite para buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {alunos.map((a) => {
              const ativo = selecionado?.id === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionado({ id: a.id, nome: a.nome })}
                    className={
                      "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition " +
                      (ativo
                        ? "border-marca-500 bg-marca-50 text-marca-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                    }
                  >
                    {a.nome}
                  </button>
                </li>
              );
            })}
            {alunos.length === 0 && (
              <li className="px-1 py-3 text-sm text-slate-400">
                Nenhum aluno encontrado.
              </li>
            )}
          </ul>
        </div>

        {erro && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <div className="mx-auto max-w-md">
          <button
            className="btn-primario w-full py-3 text-base"
            disabled={!selecionado || enviando}
            onClick={confirmar}
          >
            {enviando ? "Registrando..." : "Confirmar presença"}
          </button>
          {selecionado && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Selecionado: {selecionado.nome}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
