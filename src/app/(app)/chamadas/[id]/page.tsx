"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { formatarDataHora, formatarHora } from "@/lib/format";
import { atualizarEvasaoDaTurma } from "@/lib/evasao";
import { baixarRelatorio, carregarPresencas, montarLinhas } from "@/lib/relatorio";
import type { Chamada, Presenca } from "@/lib/tipos";

export default function AcompanharChamadaPage() {
  const params = useParams<{ id: string }>();
  const token = params.id;
  const { perfil } = useAuth();

  const [chamada, setChamada] = useState<Chamada | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const linkChamada = `${window.location.origin}/presenca/${token}`;
    setLink(linkChamada);
    QRCode.toDataURL(linkChamada, { width: 240, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [token]);

  useEffect(() => {
    const ref = doc(db, "chamadas", token);
    const s1 = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setChamada({ id: snap.id, ...snap.data() } as Chamada);
        else setChamada(null);
        setCarregando(false);
      },
      () => {
        setErro("Não foi possível carregar a chamada.");
        setCarregando(false);
      },
    );

    const s2 = onSnapshot(
      collection(db, "chamadas", token, "presencas"),
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Presenca);
        lista.sort(
          (a, b) =>
            (a.confirmadoEm?.toMillis?.() ?? 0) -
            (b.confirmadoEm?.toMillis?.() ?? 0),
        );
        setPresencas(lista);
      },
      () => {},
    );

    return () => {
      s1();
      s2();
    };
  }, [token]);

  const ausentes = useMemo(() => {
    if (!chamada) return [];
    const presentes = new Set(presencas.map((p) => p.alunoId));
    return chamada.alunos.filter((a) => !presentes.has(a.id));
  }, [chamada, presencas]);

  const copiarLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar o link automaticamente.");
    }
  }, [link]);

  async function encerrar() {
    if (!chamada || !perfil) return;
    if (
      !confirm(
        "Encerrar a chamada? Novos registros serão bloqueados e o PDF será gerado automaticamente.",
      )
    )
      return;

    setErro("");
    setMensagem("");
    setEncerrando(true);
    try {
      await updateDoc(doc(db, "chamadas", token), {
        status: "encerrada",
        encerradaEm: serverTimestamp(),
        totalPresentes: presencas.length,
      });

      // Relê para obter o horário de encerramento gravado pelo servidor.
      const snap = await getDoc(doc(db, "chamadas", token));
      const dados = { id: snap.id, ...snap.data() } as Chamada;

      // Atualiza o monitoramento de evasão da turma.
      await atualizarEvasaoDaTurma(perfil.uid, {
        id: dados.turmaId,
        nome: dados.turmaNome,
      });

      // Gera e baixa o PDF automaticamente.
      const lista = await carregarPresencas(token);
      await baixarRelatorio(dados, lista);

      setMensagem("Chamada encerrada e PDF gerado com sucesso.");
    } catch {
      setErro("Não foi possível encerrar a chamada. Tente novamente.");
    } finally {
      setEncerrando(false);
    }
  }

  async function cancelar() {
    if (!chamada) return;
    if (
      !confirm(
        "Cancelar esta chamada? Ela será encerrada sem gerar faltas para os alunos. Esta ação não pode ser desfeita.",
      )
    )
      return;

    setErro("");
    setMensagem("");
    setEncerrando(true);
    try {
      await updateDoc(doc(db, "chamadas", token), {
        status: "cancelada",
        encerradaEm: serverTimestamp(),
        totalPresentes: presencas.length,
      });
      setMensagem(
        "Chamada cancelada. Ela não é contabilizada no monitoramento de evasão.",
      );
    } catch {
      setErro("Não foi possível cancelar a chamada.");
    } finally {
      setEncerrando(false);
    }
  }

  async function baixarPdfNovamente() {
    if (!chamada) return;
    setErro("");
    try {
      const lista = await carregarPresencas(token);
      await baixarRelatorio(chamada, lista);
    } catch {
      setErro("Não foi possível gerar o PDF agora.");
    }
  }

  if (carregando) {
    return <p className="text-slate-400">Carregando chamada...</p>;
  }

  if (!chamada) {
    return (
      <div className="card">
        <p className="text-slate-600">
          Chamada não encontrada ou sem permissão de acesso.
        </p>
        <Link href="/chamadas" className="btn-secundario mt-4">
          Voltar
        </Link>
      </div>
    );
  }

  const total = chamada.alunos.length;
  const presentes = presencas.length;
  const aberta = chamada.status === "aberta";
  const linhas = montarLinhas(chamada, presencas);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{chamada.turmaNome}</h1>
          <p className="text-sm text-slate-500">
            {chamada.cursoNome ? `${chamada.cursoNome} · ` : ""}
            Abertura: {formatarDataHora(chamada.abertaEm)}
            {chamada.encerradaEm
              ? ` · Encerramento: ${formatarDataHora(chamada.encerradaEm)}`
              : ""}
          </p>
        </div>
        <span
          className={
            "badge w-fit " +
            (aberta
              ? "bg-emerald-50 text-emerald-700"
              : chamada.status === "cancelada"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-600")
          }
        >
          {aberta
            ? "Chamada aberta"
            : chamada.status === "cancelada"
              ? "Chamada cancelada"
              : "Chamada encerrada"}
        </span>
      </div>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
      {mensagem && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {mensagem}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Alunos ativos na chamada</p>
          <p className="text-3xl font-bold text-slate-800">{total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Presentes</p>
          <p className="text-3xl font-bold text-emerald-600">{presentes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Ainda não registraram</p>
          <p className="text-3xl font-bold text-amber-600">{total - presentes}</p>
        </div>
      </div>

      {aberta && (
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">
            Link e QR Code para os alunos
          </h2>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR Code da chamada"
                className="mx-auto h-40 w-40 rounded-lg border border-slate-200 bg-white p-1 sm:mx-0"
              />
            )}
            <div className="flex-1 space-y-3">
              <div>
                <label className="label">Link da chamada</label>
                <input className="input" readOnly value={link} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button className="btn-secundario w-full sm:w-auto" onClick={copiarLink}>
                  {copiado ? "Copiado!" : "Copiar link"}
                </button>
                <a
                  className="btn-secundario w-full sm:w-auto"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir tela do aluno
                </a>
              </div>
              <p className="text-xs text-slate-500">
                O link funciona somente enquanto a chamada estiver aberta.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">
            Presentes ({presentes})
          </h2>
          <div className="max-h-80 overflow-y-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Confirmado às</th>
                </tr>
              </thead>
              <tbody>
                {presencas.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.alunoNome}</td>
                    <td>{formatarHora(p.confirmadoEm)}</td>
                  </tr>
                ))}
                {presentes === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center text-slate-400">
                      Nenhum registro ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">
            Aguardando registro ({ausentes.length})
          </h2>
          <div className="max-h-80 overflow-y-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Aluno</th>
                </tr>
              </thead>
              <tbody>
                {ausentes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                  </tr>
                ))}
                {ausentes.length === 0 && (
                  <tr>
                    <td className="text-center text-slate-400">
                      Todos registraram presença.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        {aberta ? (
          <>
            <button
              className="btn-perigo w-full py-3 text-base"
              onClick={encerrar}
              disabled={encerrando}
            >
              {encerrando ? "Encerrando..." : "ENCERRAR CHAMADA"}
            </button>
            <button
              className="btn-secundario w-full"
              onClick={cancelar}
              disabled={encerrando}
            >
              Cancelar chamada (não conta falta)
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {chamada.status === "cancelada"
                ? "Chamada cancelada. Ela não é contabilizada no monitoramento de evasão."
                : "Chamada encerrada. O PDF pode ser baixado novamente a qualquer momento."}
            </p>
            <button className="btn-primario w-full sm:w-auto" onClick={baixarPdfNovamente}>
              Baixar PDF
            </button>
          </div>
        )}
        <p className="text-xs text-slate-500">
          Total de alunos na chamada: {linhas.length} · Presentes: {presentes} ·
          Ausentes: {linhas.length - presentes}
        </p>
      </div>
    </div>
  );
}
