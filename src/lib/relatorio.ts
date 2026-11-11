import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { formatarData, formatarHora, nomeArquivoPdf } from "./format";
import { baixarPdf, gerarPdfChamada, type DadosPdf, type LinhaPdf } from "./pdf";
import type { Chamada, Presenca } from "./tipos";

/** Lê as presenças registradas em uma chamada. */
export async function carregarPresencas(chamadaId: string): Promise<Presenca[]> {
  const snap = await getDocs(collection(db, "chamadas", chamadaId, "presencas"));
  const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Presenca);
  lista.sort(
    (a, b) =>
      (a.confirmadoEm?.toMillis?.() ?? 0) - (b.confirmadoEm?.toMillis?.() ?? 0),
  );
  return lista;
}

/** Monta as linhas (presente/ausente + horário) da chamada. */
export function montarLinhas(chamada: Chamada, presencas: Presenca[]): LinhaPdf[] {
  const mapa = new Map(presencas.map((p) => [p.alunoId, p]));
  return chamada.alunos.map((a) => {
    const p = mapa.get(a.id);
    return {
      nome: a.nome,
      matricula: a.matricula,
      presente: Boolean(p),
      hora: p ? formatarHora(p.confirmadoEm) : "-",
    };
  });
}

/**
 * Gera o PDF da chamada e dispara o download com o nome padrão
 * NOME_DA_TURMA_ANO-MES-DIA_HORARIO.pdf
 */
export async function baixarRelatorio(
  chamada: Chamada,
  presencas: Presenca[],
): Promise<void> {
  const linhas = montarLinhas(chamada, presencas);
  const totalPresentes = linhas.filter((l) => l.presente).length;

  const dados: DadosPdf = {
    turmaNome: chamada.turmaNome,
    cursoNome: chamada.cursoNome,
    dataChamada: formatarData(chamada.abertaEm),
    abertura: formatarHora(chamada.abertaEm),
    encerramento: chamada.encerradaEm ? formatarHora(chamada.encerradaEm) : "-",
    mediadorNome: chamada.mediadorNome,
    linhas,
    totalPresentes,
    totalAusentes: linhas.length - totalPresentes,
  };

  const bytes = await gerarPdfChamada(dados);
  baixarPdf(bytes, nomeArquivoPdf(chamada.turmaNome, chamada.abertaEm));
}
