"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { dataBR, hojeYMD } from "@/lib/format";
import type { Aluno, Turma } from "@/lib/tipos";

const vazio = {
  id: "",
  nome: "",
  matricula: "",
  turmaId: "",
  dataEntrada: "",
  situacao: "ativo",
};

export default function AlunosPage() {
  const { perfil } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [filtroTurma, setFiltroTurma] = useState("");
  const [form, setForm] = useState({ ...vazio, dataEntrada: hojeYMD() });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const carregar = useCallback(async () => {
    if (!perfil) return;
    const [t, a] = await Promise.all([
      getDocs(query(collection(db, "turmas"), where("mediadorId", "==", perfil.uid))),
      getDocs(query(collection(db, "alunos"), where("mediadorId", "==", perfil.uid))),
    ]);
    const listaTurmas = t.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma);
    listaTurmas.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
    const listaAlunos = a.docs.map((d) => ({ id: d.id, ...d.data() }) as Aluno);
    listaAlunos.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
    setTurmas(listaTurmas);
    setAlunos(listaAlunos);
  }, [perfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nomeTurma = useMemo(() => {
    const mapa = new Map(turmas.map((t) => [t.id, t.nome]));
    return (id: string) => mapa.get(id) ?? "—";
  }, [turmas]);

  const visiveis = useMemo(
    () => (filtroTurma ? alunos.filter((a) => a.turmaId === filtroTurma) : alunos),
    [alunos, filtroTurma],
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    setErro("");
    setMensagem("");
    if (!form.nome.trim()) return setErro("Informe o nome completo do aluno.");
    if (!form.turmaId) return setErro("Selecione a turma do aluno.");
    if (!form.dataEntrada) return setErro("Informe a data de entrada na turma.");

    if (
      alunos.some(
        (a) =>
          a.id !== form.id &&
          a.turmaId === form.turmaId &&
          a.nome.trim().toLowerCase() === form.nome.trim().toLowerCase(),
      )
    ) {
      return setErro("Já existe um aluno com este nome nessa turma.");
    }

    setSalvando(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        matricula: form.matricula.trim(),
        turmaId: form.turmaId,
        dataEntrada: form.dataEntrada,
        situacao: form.situacao as "ativo" | "inativo",
        mediadorId: perfil.uid,
      };
      if (form.id) {
        await updateDoc(doc(db, "alunos", form.id), dados);
        setMensagem("Aluno atualizado com sucesso.");
      } else {
        const alunoRef = await addDoc(collection(db, "alunos"), {
          ...dados,
          criadoEm: serverTimestamp(),
        });

        const podeEntrarNaChamada =
          dados.situacao === "ativo" &&
          (!dados.dataEntrada || dados.dataEntrada <= hojeYMD());

        if (podeEntrarNaChamada) {
          const chamadasAbertas = await getDocs(
            query(
              collection(db, "chamadas"),
              where("mediadorId", "==", perfil.uid),
              where("turmaId", "==", dados.turmaId),
              where("status", "==", "aberta"),
            ),
          );

          const chamadaAberta = chamadasAbertas.docs[0];
          if (chamadaAberta) {
            await updateDoc(doc(db, "chamadas", chamadaAberta.id), {
              alunos: arrayUnion({
                id: alunoRef.id,
                nome: dados.nome,
                matricula: dados.matricula,
              }),
              alunoIds: arrayUnion(alunoRef.id),
              totalAlunos: (chamadaAberta.data().totalAlunos ?? 0) + 1,
            });
            setMensagem("Aluno cadastrado e incluído na chamada aberta da turma.");
          } else {
            setMensagem("Aluno cadastrado com sucesso.");
          }
        } else {
          setMensagem("Aluno cadastrado com sucesso.");
        }
      }
      setForm({ ...vazio, dataEntrada: hojeYMD(), turmaId: form.turmaId });
      await carregar();
    } catch {
      setErro("Não foi possível salvar o aluno.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(a: Aluno) {
    if (!confirm(`Excluir o aluno "${a.nome}"?`)) return;
    try {
      await deleteDoc(doc(db, "alunos", a.id));
      await carregar();
    } catch {
      setErro("Não foi possível excluir o aluno.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Alunos</h1>
        <p className="text-sm text-slate-500">
          Alunos ativos aparecem automaticamente na chamada da turma.
        </p>
      </div>

      {turmas.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cadastre uma turma antes de registrar alunos.
        </p>
      )}

      <form onSubmit={salvar} className="card">
        <h2 className="mb-4 font-semibold text-slate-800">
          {form.id ? "Editar aluno" : "Novo aluno"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="label">Nome completo *</label>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Matrícula (opcional)</label>
            <input
              className="input"
              value={form.matricula}
              onChange={(e) => setForm({ ...form, matricula: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Turma *</label>
            <select
              className="input"
              value={form.turmaId}
              onChange={(e) => setForm({ ...form, turmaId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Data de entrada na turma *</label>
            <input
              type="date"
              className="input"
              value={form.dataEntrada}
              onChange={(e) => setForm({ ...form, dataEntrada: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Situação</label>
            <select
              className="input"
              value={form.situacao}
              onChange={(e) => setForm({ ...form, situacao: e.target.value })}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        {erro && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        {mensagem && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {mensagem}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            className="btn-primario w-full sm:w-auto"
            disabled={salvando}
          >
            {salvando ? "Salvando..." : form.id ? "Salvar alterações" : "Cadastrar aluno"}
          </button>
          {form.id && (
            <button
              type="button"
              className="btn-secundario w-full sm:w-auto"
              onClick={() => setForm({ ...vazio, dataEntrada: hojeYMD() })}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-slate-800">
            Alunos cadastrados ({visiveis.length})
          </h2>
          <select
            className="input w-full sm:max-w-xs"
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
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Matrícula</th>
                <th>Turma</th>
                <th>Entrada</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.nome}</td>
                  <td>{a.matricula || "-"}</td>
                  <td>{nomeTurma(a.turmaId)}</td>
                  <td>{dataBR(a.dataEntrada)}</td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (a.situacao === "ativo"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {a.situacao === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                      <button
                        className="text-sm font-semibold text-marca-600"
                        onClick={() =>
                          setForm({
                            id: a.id,
                            nome: a.nome,
                            matricula: a.matricula ?? "",
                            turmaId: a.turmaId,
                            dataEntrada: a.dataEntrada,
                            situacao: a.situacao,
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        className="text-sm font-semibold text-red-600"
                        onClick={() => remover(a)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400">
                    Nenhum aluno cadastrado.
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
