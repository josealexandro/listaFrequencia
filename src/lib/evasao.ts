import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { dataYMD } from "./format";
import type { Aluno, Chamada, Turma } from "./tipos";

export type SituacaoEvasao = "Normal" | "Atenção" | "Risco elevado";

/**
 * 1 falta  -> Normal
 * 2 faltas -> Atenção
 * 3+ faltas -> Risco elevado (nunca "evadido")
 */
export function situacaoEvasao(faltasConsecutivas: number): SituacaoEvasao {
  if (faltasConsecutivas >= 3) return "Risco elevado";
  if (faltasConsecutivas === 2) return "Atenção";
  return "Normal";
}

interface Estado {
  aluno: Aluno;
  faltas: number;
  presencas: number;
  consecutivas: number;
  ultima: Timestamp | null;
  sequenciaAberta: boolean;
}

/**
 * Recalcula o monitoramento de evasão de uma turma a partir das chamadas
 * EFETIVAMENTE ENCERRADAS e grava o resultado na coleção "evasao".
 *
 * Regras aplicadas:
 *  - chamadas abertas ou canceladas não contam;
 *  - faltas anteriores à data de entrada do aluno não contam;
 *  - presença zera a sequência de faltas consecutivas;
 *  - alunos inativos não recebem novas faltas (são ignorados).
 */
export async function atualizarEvasaoDaTurma(
  mediadorId: string,
  turma: Pick<Turma, "id" | "nome">,
): Promise<void> {
  const [chamadasSnap, alunosSnap] = await Promise.all([
    getDocs(query(collection(db, "chamadas"), where("mediadorId", "==", mediadorId))),
    getDocs(query(collection(db, "alunos"), where("mediadorId", "==", mediadorId))),
  ]);

  const chamadas = chamadasSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Chamada)
    .filter((c) => c.turmaId === turma.id && c.status === "encerrada")
    // da mais recente para a mais antiga
    .sort(
      (a, b) =>
        (b.abertaEm?.toMillis?.() ?? 0) - (a.abertaEm?.toMillis?.() ?? 0),
    );

  const alunos = alunosSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Aluno)
    .filter((a) => a.turmaId === turma.id && a.situacao === "ativo");

  if (alunos.length === 0) return;

  const estado = new Map<string, Estado>();
  for (const aluno of alunos) {
    estado.set(aluno.id, {
      aluno,
      faltas: 0,
      presencas: 0,
      consecutivas: 0,
      ultima: null,
      sequenciaAberta: true,
    });
  }

  for (const chamada of chamadas) {
    const presSnap = await getDocs(
      collection(db, "chamadas", chamada.id, "presencas"),
    );
    const presentes = new Map<string, Timestamp | null>();
    presSnap.forEach((p) =>
      presentes.set(p.id, (p.data().confirmadoEm ?? null) as Timestamp | null),
    );

    const ymd = dataYMD(chamada.abertaEm);
    for (const e of estado.values()) {
      // não contabiliza faltas anteriores à entrada do aluno na turma
      if (e.aluno.dataEntrada && ymd && ymd < e.aluno.dataEntrada) continue;

      if (presentes.has(e.aluno.id)) {
        e.presencas += 1;
        if (!e.ultima) e.ultima = presentes.get(e.aluno.id) ?? null;
        e.sequenciaAberta = false; // presença zera a sequência
      } else {
        e.faltas += 1;
        if (e.sequenciaAberta) e.consecutivas += 1;
      }
    }
  }

  const lote = writeBatch(db);
  for (const e of estado.values()) {
    lote.set(doc(db, "evasao", e.aluno.id), {
      mediadorId,
      alunoId: e.aluno.id,
      alunoNome: e.aluno.nome,
      turmaId: turma.id,
      turmaNome: turma.nome,
      faltasConsecutivas: e.consecutivas,
      totalFaltas: e.faltas,
      totalPresencas: e.presencas,
      ultimaPresenca: e.ultima,
      atualizadoEm: serverTimestamp(),
    });
  }
  await lote.commit();
}
