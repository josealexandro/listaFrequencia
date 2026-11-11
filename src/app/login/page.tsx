"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { garantirPerfilMediador } from "@/lib/perfil";

export default function LoginPage() {
  const { carregando, user, recarregarPerfil } = useAuth();
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [entrandoGoogle, setEntrandoGoogle] = useState(false);
  const [processandoAcesso, setProcessandoAcesso] = useState(false);

  useEffect(() => {
    if (!carregando && user && !processandoAcesso) router.replace("/painel");
  }, [carregando, user, processandoAcesso, router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      router.replace("/painel");
    } catch (err: unknown) {
      const codigo = (err as { code?: string })?.code ?? "";
      if (
        codigo === "auth/invalid-credential" ||
        codigo === "auth/wrong-password" ||
        codigo === "auth/user-not-found"
      ) {
        setErro("E-mail ou senha incorretos.");
      } else if (codigo === "auth/too-many-requests") {
        setErro("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else if (codigo === "auth/invalid-email") {
        setErro("E-mail inválido.");
      } else if (codigo === "auth/network-request-failed") {
        setErro("Falha de conexão. Verifique sua internet.");
      } else {
        setErro("Não foi possível entrar. Verifique os dados e tente novamente.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();

    if (!nomeLimpo) return setErro("Informe seu nome.");
    if (!emailLimpo) return setErro("Informe seu e-mail.");
    if (senha.length < 6) {
      return setErro("A senha deve ter pelo menos 6 caracteres.");
    }

    setEnviando(true);
    setProcessandoAcesso(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
      await garantirPerfilMediador(cred.user, nomeLimpo);
      await recarregarPerfil();
      router.replace("/painel");
    } catch (err: unknown) {
      setProcessandoAcesso(false);
      const codigo = (err as { code?: string })?.code ?? "";

      if (codigo === "auth/email-already-in-use") {
        setErro("Este e-mail ja esta em uso.");
      } else if (codigo === "auth/invalid-email") {
        setErro("E-mail invalido.");
      } else if (codigo === "auth/weak-password") {
        setErro("Senha muito fraca. Use pelo menos 6 caracteres.");
      } else if (codigo === "permission-denied") {
        await signOut(auth).catch(() => {});
        setErro(
          "Nao foi possivel criar seu acesso. Verifique as regras do Firestore e tente novamente.",
        );
      } else if (codigo === "auth/network-request-failed") {
        setErro("Falha de conexao. Verifique sua internet.");
      } else {
        setErro("Nao foi possivel criar a conta. Tente novamente.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function entrarComGoogle() {
    setErro("");
    setAviso("");
    setEntrandoGoogle(true);
    if (modo === "cadastrar") {
      setProcessandoAcesso(true);
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const cred = await signInWithPopup(auth, provider);
      setProcessandoAcesso(true);
      await garantirPerfilMediador(cred.user);
      await recarregarPerfil();
      router.replace("/painel");
    } catch (err: unknown) {
      setProcessandoAcesso(false);
      const codigo = (err as { code?: string })?.code ?? "";

      if (codigo === "auth/popup-closed-by-user") {
        setErro("Login com Google cancelado.");
      } else if (codigo === "permission-denied") {
        await signOut(auth).catch(() => {});
        setErro(
          "Nao foi possivel criar seu acesso. Verifique as regras do Firestore e tente novamente.",
        );
      } else if (codigo === "auth/account-exists-with-different-credential") {
        setErro("Este e-mail ja esta vinculado a outro metodo de acesso.");
      } else if (codigo === "auth/network-request-failed") {
        setErro("Falha de conexao. Verifique sua internet.");
      } else {
        await signOut(auth).catch(() => {});
        setErro("Nao foi possivel entrar com Google. Tente novamente.");
      }
    } finally {
      setEntrandoGoogle(false);
    }
  }

  if (processandoAcesso) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="card max-w-md text-center">
          <p className="text-sm text-slate-600">Carregando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800">
            Controle de Presença
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesso de mediadores e administração
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
          <button
            type="button"
            className={
              "rounded-lg px-3 py-2 text-sm font-semibold transition " +
              (modo === "entrar"
                ? "bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 dark:text-slate-300")
            }
            onClick={() => {
              setModo("entrar");
              setErro("");
              setAviso("");
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={
              "rounded-lg px-3 py-2 text-sm font-semibold transition " +
              (modo === "cadastrar"
                ? "bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 dark:text-slate-300")
            }
            onClick={() => {
              setModo("cadastrar");
              setErro("");
              setAviso("");
            }}
          >
            Criar conta
          </button>
        </div>

        <form
          onSubmit={modo === "entrar" ? entrar : cadastrar}
          className="card space-y-4"
        >
          <button
            type="button"
            className="btn-primario w-full"
            onClick={entrarComGoogle}
            disabled={entrandoGoogle || enviando}
          >
            {entrandoGoogle
              ? "Acessando com Google..."
              : modo === "entrar"
                ? "Entrar com Google"
                : "Criar conta com Google"}
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative text-center text-xs uppercase tracking-wide text-slate-400">
              <span className="bg-white px-2">ou continue com e-mail</span>
            </div>
          </div>

          {modo === "cadastrar" && (
            <div>
              <label className="label" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                type="text"
                className="input"
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              className="input"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}
          {aviso && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {aviso}
            </p>
          )}

          <button
            type="submit"
            className="btn-primario w-full"
            disabled={enviando}
          >
            {enviando
              ? modo === "entrar"
                ? "Entrando..."
                : "Criando conta..."
              : modo === "entrar"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-slate-500">
          Mediadores podem criar a propria conta com Google ou com e-mail e
          senha. O admin continua gerenciando os acessos pela tela de
          mediadores.
        </p>
      </div>
    </main>
  );
}
