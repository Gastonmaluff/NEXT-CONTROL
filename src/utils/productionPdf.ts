import { GlobalWorkerOptions, getDocument, type PDFPageProxy } from "pdfjs-dist";
import type { ProductionOrderPosition } from "../types";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export type ParsedProductionPdf = {
  numero?: string;
  obraNombre: string;
  fechaCreacionDocumento?: string;
  posiciones: ProductionOrderPosition[];
  previewImage: File;
  positionImages: File[];
};

export async function parseProductionPdf(file: File): Promise<ParsedProductionPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  if (!pdf.numPages) throw new Error("El PDF no contiene paginas.");

  const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, index) => pdf.getPage(index + 1)));
  const pageTexts = await Promise.all(pages.map((page) => page.getTextContent()));
  const text = pageTexts
    .flatMap((content) => content.items.map((item) => "str" in item ? item.str : ""))
    .join("\n");

  const header = parseHeader(text);
  const positions = parsePositions(text);
  if (!positions.length) {
    throw new Error("No se encontraron posiciones de fabricación en el PDF. Revisá que tenga el formato de items.");
  }

  const previewImage = await renderPageToFile(pages[0], `${file.name.replace(/\.pdf$/i, "")}-vista.png`);
  const imageRanges = pageTexts.flatMap((content, pageIndex) => findPositionRanges(
    content.items as unknown[],
    pages[pageIndex].getViewport({ scale: 1 }),
    pageIndex
  ));
  const imageFiles = await Promise.all(
    positions.map((position, index) => {
      const range = imageRanges[index] ?? defaultPositionRange(pages[0].getViewport({ scale: 1 }), 0);
      return cropPageRegion(pages[range.pageIndex], range, `${position.id}-referencia.png`);
    })
  );

  return {
    ...header,
    posiciones: positions,
    previewImage,
    positionImages: imageFiles
  };
}

function parseHeader(text: string): Pick<ParsedProductionPdf, "numero" | "obraNombre" | "fechaCreacionDocumento"> {
  const numberMatch = text.match(/Nº\s*([^\s]+)\s+([^\n]+)/i);
  const dateMatch = text.match(/Fecha\s+Creaci[oó]n:\s*([^\n]+)/i);
  return {
    numero: numberMatch?.[1]?.trim(),
    obraNombre: numberMatch?.[2]?.trim() || "Orden importada desde PDF",
    fechaCreacionDocumento: dateMatch?.[1]?.trim()
  };
}

function parsePositions(text: string): ProductionOrderPosition[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const reportRows = [...normalized.matchAll(
    /Pos\.?\s+Tipo\s+C[oó]digo\s+Dimensiones\s+Cant\.?\s+(\d+)\s+(.+?)\s+([A-ZÀ-Ü0-9][A-ZÀ-Ü0-9._/-]*)\s+(\d+(?:[.,]\d+)?)\s*[Xx×]\s*(\d+(?:[.,]\d+)?)\s+(\d+)(?=\s+Descripci[oó]n\s*:)/gi
  )];
  const matches = reportRows.length ? reportRows : [...normalized.matchAll(
    /(?:Pos\.?\s*)?(\d+)\s+([^\s]+)\s+([^\s]+)\s+(\d+(?:[.,]\d+)?)\s*[Xx×]\s*(\d+(?:[.,]\d+)?)\s+(\d+)(?=\s+Descripci[oó]n\s*:)/gi
  )];
  const positions: ProductionOrderPosition[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const blockStart = match.index ?? 0;
    const blockEnd = matches[index + 1]?.index ?? normalized.length;
    const block = normalized.slice(blockStart, blockEnd);
    const quantity = Number(match[6]);
    const position: ProductionOrderPosition = {
      id: `pdf-pos-${match[1]}-${Date.now()}-${index}`,
      numero: match[1],
      tipo: match[2],
      codigo: match[3],
      descripcion: findDetail(block, "Descripci[oó]n") || "Abertura",
      ancho: parsePdfNumber(match[4]),
      alto: parsePdfNumber(match[5]),
      cantidadTotal: quantity,
      cantidadPendiente: quantity,
      cantidadEnProduccion: 0,
      cantidadTerminada: 0,
      estado: "pendiente",
      color: findDetail(block, "Color"),
      linea: findLine(block),
      detalles: findDetail(block, "Detalles")
    };
    positions.push(position);
  }

  return positions;
}

function findDetail(block: string, label: string): string | undefined {
  const match = block.match(new RegExp(`${label}:\\s*(.*?)(?=\\s+(?:Color|Detalles|Descripci[oó]n):|$)`, "i"));
  return match?.[1]?.trim() || undefined;
}

function findLine(block: string): string | undefined {
  const match = block.match(/L[IÍ]NEA\s+(.+?)(?=\s+(?:Kit|OPCI[OÓ]N)\b|[,;]|$)/i);
  return match?.[1]?.trim() || undefined;
}

async function renderPageToFile(page: PDFPageProxy, name: string): Promise<File> {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
  return canvasToFile(canvas, name);
}

type PositionImageRange = {
  pageIndex: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

async function cropPageRegion(page: PDFPageProxy, range: PositionImageRange, name: string): Promise<File> {
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((range.right - range.left) * scale);
  canvas.height = Math.ceil((range.bottom - range.top) * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: [1, 0, 0, 1, -range.left * scale, -range.top * scale]
  }).promise;
  return canvasToFile(canvas, name);
}

function findPositionRanges(items: unknown[], viewport: { width: number; height: number }, pageIndex: number): PositionImageRange[] {
  const headers = items
    .map((candidate) => candidate as { str?: string; transform?: number[]; height?: number })
    .filter((candidate) => /^Pos\.?$/i.test(candidate.str?.trim() ?? "") && candidate.transform?.length)
    .map((candidate) => ({
      left: candidate.transform?.[4] ?? 28,
      top: viewport.height - (candidate.transform?.[5] ?? viewport.height) - (candidate.height ?? 10) - 3
    }))
    .sort((a, b) => a.top - b.top);

  if (!headers.length) return [];

  const gaps = headers.slice(1).map((header, index) => header.top - headers[index].top);
  const typicalHeight = gaps.length ? median(gaps) : viewport.height - headers[0].top - 45;
  const left = Math.max(0, Math.min(...headers.map((header) => header.left)) - 2);
  const right = Math.max(left + 1, viewport.width - left);

  return headers.map((header, index) => ({
    pageIndex,
    left,
    right,
    top: Math.max(0, header.top),
    bottom: Math.min(
      viewport.height - 42,
      headers[index + 1] ? headers[index + 1].top - 5 : header.top + typicalHeight
    )
  }));
}

function defaultPositionRange(viewport: { width: number; height: number }, pageIndex: number): PositionImageRange {
  return { pageIndex, left: 24, right: viewport.width - 24, top: 120, bottom: viewport.height - 45 };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function parsePdfNumber(value: string) {
  return Number(value.replace(",", "."));
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(new File([blob], name, { type: "image/png" })) : reject(new Error("No se pudo generar la imagen del PDF.")), "image/png");
  });
}
