"use client";

import { useEffect, useState } from "react";

function aplicarTema(escuro: boolean) {
  document.documentElement.classList.toggle("dark", escuro);
  window.localStorage.setItem("theme", escuro ? "dark" : "light");
}

export default function ThemeToggle() {
  const [escuro, setEscuro] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
    setMontado(true);
  }, []);

  function alternarTema() {
    const proximo = !escuro;
    setEscuro(proximo);
    aplicarTema(proximo);
  }

  return (
    <button
      type="button"
      onClick={alternarTema}
      className="btn-secundario fixed bottom-4 right-4 z-50 shadow-sm"
      aria-label={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      title={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {montado ? (escuro ? "Tema claro" : "Tema escuro") : "Tema"}
    </button>
  );
}
