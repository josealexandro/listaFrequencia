"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
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
import type { Turma } from "@/lib/tipos";

const DIAS = [
  "",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

const vazio = { id: "", nome: "", curso: "", diaSemana: "", situacao: "ativa" };

export default function TurmasPage() {
  const { perfil } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!perfil) return;
    const snap = await getDocs(
      query(collection(db, "turmas"), where("mediadorId", "==", perfil.uid)),
    );
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Turma);
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    setTurmas(lista);
  }, [perfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    setErro("");
    if (!form.nome.trim()) {
      setErro("Informe o nome da turma.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        curso: form.curso.trim(),
        diaSemana: form.diaSemana,
        situacao: form.situacao as "ativa" | "inativa",
        mediadorId: perfil.uid,
      };
      if (form.id) {
        await updateDoc(doc(db, "turmas", form.id), dados);
      } else {
        await addDoc(collection(db, "turmas"), {
          ...dados,
          criadoEm: serverTimestamp(),
        });
      }
      setForm({ ...vazio });
      await carregar();
    } catch {
      setErro("Não foi possível salvar a turma.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(t: Turma) {
    if (!confirm(`Excluir a turma "${t.nome}"? Os alunos vinculados permanecerão cadastrados.`))
      return;
    try {
      await deleteDoc(doc(db, "turmas", t.id));
      await carregar();
    } catch {
      setErro("Não foi possível excluir a turma.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Turmas</h1>
        <p className="text-sm text-slate-500">
          Cadastre e gerencie suas turmas.
        </p>
      </div>

      <form onSubmit={salvar} className="card">
        <h2 className="mb-4 font-semibold text-slate-800">
          {form.id ? "Editar turma" : "Nova turma"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nome da turma *</label>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Análise e Desenvolvimento de Sistemas"
            />
          </div>
          <div>
            <label className="label">Nome do curso (opcional)</label>
            <input
              className="input"
              value={form.curso}
              onChange={(e) => setForm({ ...form, curso: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Dia da semana (opcional)</label>
            <select
              className="input"
              value={form.diaSemana}
              onChange={(e) => setForm({ ...form, diaSemana: e.target.value })}
            >
              {DIAS.map((d) => (
                <option key={d} value={d}>
                  {d || "Não informado"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Situação</label>
            <select
              className="input"
              value={form.situacao}
              onChange={(e) => setForm({ ...form, situacao: e.target.value })}
            >
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>
        </div>

        {erro && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button type="submit" className="btn-primario" disabled={salvando}>
            {salvando ? "Salvando..." : form.id ? "Salvar alterações" : "Cadastrar turma"}
          </button>
          {form.id && (
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setForm({ ...vazio })}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">
          Minhas turmas ({turmas.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Turma</th>
                <th>Curso</th>
                <th>Dia</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {turmas.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.nome}</td>
                  <td>{t.curso || "-"}</td>
                  <td>{t.diaSemana || "-"}</td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (t.situacao === "ativa"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {t.situacao === "ativa" ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      className="text-sm font-semibold text-marca-600"
                      onClick={() =>
                        setForm({
                          id: t.id,
                          nome: t.nome,
                          curso: t.curso ?? "",
                          diaSemana: t.diaSemana ?? "",
                          situacao: t.situacao,
                        })
                      }
                    >
                      Editar
                    </button>
                    <button
                      className="ml-3 text-sm font-semibold text-red-600"
                      onClick={() => remover(t)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {turmas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400">
                    Nenhuma turma cadastrada.
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
