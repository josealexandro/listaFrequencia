"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { appSecundario, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import type { Perfil } from "@/lib/tipos";

interface Atividade {
  turmas: number;
  alunos: number;
  chamadas: number;
}

export default function MediadoresPage() {
  const { perfil } = useAuth();
  const [mediadores, setMediadores] = useState<Perfil[]>([]);
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [atividade, setAtividade] = useState<Record<string, Atividade>>({});
  const [carregando, setCarregando] = useState(true);

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

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    const nome = form.nome.trim();
    const email = form.email.trim().toLowerCase();

    if (!nome) return setErro("Informe o nome do mediador.");
    if (!email) return setErro("Informe o e-mail do mediador.");
    if (form.senha.length < 6)
      return setErro("A senha deve ter pelo menos 6 caracteres.");
    if (mediadores.some((m) => m.email.toLowerCase() === email))
      return setErro("Já existe um mediador com este e-mail.");

    setSalvando(true);
    try {
      // App secundário: cria a conta sem encerrar a sessão do administrador.
      const authSec = getAuth(appSecundario());
      const cred = await createUserWithEmailAndPassword(authSec, email, form.senha);
      const uid = cred.user.uid;
      await signOut(authSec);

      await setDoc(doc(db, "users", uid), {
        nome,
        email,
        role: "mediador",
        ativo: true,
        evasaoPermitida: false,
        criadoEm: serverTimestamp(),
      });

      setForm({ nome: "", email: "", senha: "" });
      setAviso(`Mediador ${nome} cadastrado com sucesso.`);
      await carregar();
    } catch (err: unknown) {
      const codigo = (err as { code?: string })?.code ?? "";
      if (codigo === "auth/email-already-in-use") {
        setErro("Este e-mail já está em uso no sistema de autenticação.");
      } else if (codigo === "auth/invalid-email") {
        setErro("E-mail inválido.");
      } else if (codigo === "auth/weak-password") {
        setErro("Senha muito fraca. Use pelo menos 6 caracteres.");
      } else {
        setErro("Não foi possível cadastrar o mediador. Verifique os dados.");
      }
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(m: Perfil) {
    try {
      await updateDoc(doc(db, "users", m.uid), { ativo: !m.ativo });
      await carregar();
    } catch {
      setErro("Não foi possível alterar a situação do mediador.");
    }
  }

  async function alternarEvasao(m: Perfil) {
    try {
      await updateDoc(doc(db, "users", m.uid), {
        evasaoPermitida: !m.evasaoPermitida,
      });
      await carregar();
    } catch {
      setErro("Não foi possível alterar a permissão de evasão.");
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
      setErro("Não foi possível carregar as atividades deste mediador.");
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
          Cadastre contas, ative/desative acessos e libere individualmente o
          monitoramento de evasão.
        </p>
      </div>

      <form onSubmit={cadastrar} className="card">
        <h2 className="mb-4 font-semibold text-slate-800">Novo mediador</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Senha inicial</label>
            <input
              type="text"
              className="input"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder="mínimo 6 caracteres"
            />
          </div>
        </div>

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

        <button type="submit" className="btn-primario mt-4" disabled={salvando}>
          {salvando ? "Cadastrando..." : "Cadastrar mediador"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Informe a senha inicial ao mediador. Ele poderá usá-la para entrar no
          sistema.
        </p>
      </form>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">
          Mediadores ({mediadores.length})
        </h2>
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
              {mediadores.map((m) => (
                <tr key={m.uid}>
                  <td className="font-medium">{m.nome}</td>
                  <td>{m.email}</td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (m.ativo
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {m.ativo ? "Ativo" : "Desativado"}
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
                    <button
                      className="text-sm font-semibold text-marca-600"
                      onClick={() => alternarAtivo(m)}
                    >
                      {m.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      className="ml-3 text-sm font-semibold text-marca-600"
                      onClick={() => alternarEvasao(m)}
                    >
                      {m.evasaoPermitida ? "Retirar evasão" : "Liberar evasão"}
                    </button>
                    <button
                      className="ml-3 text-sm font-semibold text-slate-600"
                      onClick={() => verAtividade(m)}
                    >
                      Atividades
                    </button>
                  </td>
                </tr>
              ))}
              {!carregando && mediadores.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400">
                    Nenhum mediador cadastrado.
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
