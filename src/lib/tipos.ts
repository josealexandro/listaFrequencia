import type { Timestamp } from "firebase/firestore";

export type Papel = "admin" | "mediador";

export interface Perfil {
  uid: string;
  nome: string;
  email: string;
  role: Papel;
  ativo: boolean;
  evasaoPermitida: boolean;
  criadoEm?: Timestamp | null;
}

export interface Turma {
  id: string;
  mediadorId: string;
  nome: string;
  curso?: string;
  diaSemana?: string;
  situacao: "ativa" | "inativa";
  criadoEm?: Timestamp | null;
}

export interface Aluno {
  id: string;
  mediadorId: string;
  turmaId: string;
  nome: string;
  matricula?: string;
  dataEntrada: string; // formato AAAA-MM-DD
  situacao: "ativo" | "inativo";
  criadoEm?: Timestamp | null;
}

/** Cópia congelada do aluno no momento da abertura da chamada. */
export interface AlunoSnapshot {
  id: string;
  nome: string;
  matricula?: string;
}

export interface Chamada {
  id: string; // = token do link
  token: string;
  mediadorId: string;
  mediadorNome: string;
  turmaId: string;
  turmaNome: string;
  cursoNome?: string;
  status: "aberta" | "encerrada" | "cancelada";
  abertaEm: Timestamp | null;
  encerradaEm?: Timestamp | null;
  totalAlunos: number;
  totalPresentes?: number;
  alunos: AlunoSnapshot[];
  alunoIds: string[];
}

export interface Presenca {
  id: string; // = alunoId
  alunoId: string;
  alunoNome: string;
  confirmadoEm: Timestamp | null;
}

export interface Evasao {
  id: string; // = alunoId
  mediadorId: string;
  alunoId: string;
  alunoNome: string;
  turmaId: string;
  turmaNome: string;
  faltasConsecutivas: number;
  totalFaltas: number;
  totalPresencas: number;
  ultimaPresenca?: Timestamp | null;
  atualizadoEm?: Timestamp | null;
}
