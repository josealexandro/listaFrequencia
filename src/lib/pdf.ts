import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface LinhaPdf {
  nome: string;
  matricula?: string;
  presente: boolean;
  hora: string;
}

export interface DadosPdf {
  turmaNome: string;
  cursoNome?: string;
  dataChamada: string; // DD/MM/AAAA
  abertura: string; // HH:MM
  encerramento: string; // HH:MM
  mediadorNome: string;
  linhas: LinhaPdf[];
  totalPresentes: number;
  totalAusentes: number;
}

const A4: [number, number] = [595.28, 841.89];
const M = 50;

function cortar(fonte: PDFFont, texto: string, largura: number, tam: number): string {
  if (fonte.widthOfTextAtSize(texto, tam) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && fonte.widthOfTextAtSize(t + "...", tam) > largura) {
    t = t.slice(0, -1);
  }
  return t + "...";
}

/** Gera o PDF da chamada (aparência limpa, adequada para impressão). */
export async function gerarPdfChamada(d: DadosPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

  const cinza = rgb(0.42, 0.47, 0.55);
  const escuro = rgb(0.11, 0.15, 0.21);
  const linhaCor = rgb(0.82, 0.85, 0.89);
  const verde = rgb(0.09, 0.5, 0.24);
  const vermelho = rgb(0.72, 0.16, 0.16);

  let pagina: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;

  // cabeçalho da tabela (usado também ao trocar de página)
  const colunas = [
    { titulo: "#", x: M, largura: 28 },
    { titulo: "Aluno", x: M + 28, largura: 205 },
    { titulo: "Matrícula", x: M + 233, largura: 85 },
    { titulo: "Situação", x: M + 318, largura: 85 },
    { titulo: "Horário", x: M + 403, largura: 92 },
  ];

  const desenharCabecalhoTabela = () => {
    pagina.drawRectangle({
      x: M,
      y: y - 6,
      width: A4[0] - 2 * M,
      height: 22,
      color: rgb(0.937, 0.953, 0.973),
    });
    for (const c of colunas) {
      pagina.drawText(c.titulo, {
        x: c.x + 6,
        y: y + 1,
        size: 10,
        font: negrito,
        color: escuro,
      });
    }
    y -= 22;
  };

  const novaPagina = () => {
    pagina = doc.addPage(A4);
    y = A4[1] - M;
    desenharCabecalhoTabela();
  };

  // ---------- título ----------
  pagina.drawText("RELATÓRIO DE CHAMADA", {
    x: M,
    y: y - 14,
    size: 16,
    font: negrito,
    color: escuro,
  });
  y -= 44;

  // ---------- informações ----------
  const info: [string, string][] = [
    ["Turma:", d.turmaNome],
    ["Curso:", d.cursoNome || "-"],
    ["Data:", d.dataChamada],
    ["Abertura / Encerramento:", `${d.abertura} / ${d.encerramento}`],
    ["Mediador responsável:", d.mediadorNome],
  ];
  for (const [rotulo, valor] of info) {
    pagina.drawText(rotulo, { x: M, y, size: 11, font: negrito, color: cinza });
    pagina.drawText(cortar(normal, valor, 380, 11), {
      x: M + 160,
      y,
      size: 11,
      font: normal,
      color: escuro,
    });
    y -= 17;
  }

  y -= 12;
  desenharCabecalhoTabela();

  // ---------- linhas ----------
  let indice = 0;
  for (const l of d.linhas) {
    if (y < M + 60) novaPagina();
    indice += 1;

    pagina.drawText(String(indice), {
      x: colunas[0].x + 6,
      y,
      size: 10,
      font: normal,
      color: cinza,
    });
    pagina.drawText(cortar(normal, l.nome, colunas[1].largura - 8, 10), {
      x: colunas[1].x + 6,
      y,
      size: 10,
      font: normal,
      color: escuro,
    });
    pagina.drawText(l.matricula || "-", {
      x: colunas[2].x + 6,
      y,
      size: 10,
      font: normal,
      color: cinza,
    });
    pagina.drawText(l.presente ? "PRESENTE" : "AUSENTE", {
      x: colunas[3].x + 6,
      y,
      size: 10,
      font: negrito,
      color: l.presente ? verde : vermelho,
    });
    pagina.drawText(l.presente ? l.hora : "-", {
      x: colunas[4].x + 6,
      y,
      size: 10,
      font: normal,
      color: escuro,
    });

    pagina.drawLine({
      start: { x: M, y: y - 6 },
      end: { x: A4[0] - M, y: y - 6 },
      thickness: 0.5,
      color: linhaCor,
    });
    y -= 20;
  }

  if (d.linhas.length === 0) {
    pagina.drawText("Nenhum aluno ativo nesta chamada.", {
      x: M + 6,
      y,
      size: 10,
      font: normal,
      color: cinza,
    });
    y -= 20;
  }

  // ---------- totais ----------
  if (y < M + 70) novaPagina();
  y -= 10;
  pagina.drawLine({
    start: { x: M, y: y + 10 },
    end: { x: A4[0] - M, y: y + 10 },
    thickness: 1,
    color: cinza,
  });
  pagina.drawText(
    `Total de alunos: ${d.linhas.length}    Presentes: ${d.totalPresentes}    Ausentes: ${d.totalAusentes}`,
    { x: M, y, size: 11, font: negrito, color: escuro },
  );
  y -= 24;
  pagina.drawText(
    `Documento gerado automaticamente pelo sistema em ${d.dataChamada}, fuso horário America/Recife.`,
    { x: M, y, size: 9, font: normal, color: cinza },
  );

  return doc.save();
}

/** Dispara o download do PDF no navegador. */
export function baixarPdf(bytes: Uint8Array, nomeArquivo: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
