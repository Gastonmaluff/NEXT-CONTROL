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
  const imageRanges = findPositionRanges(pageTexts[0].items as unknown[], positions, pages[0].getViewport({ scale: 1 }));
  const imageFiles = await Promise.all(
    positions.map((position, index) => cropPageRegion(pages[0], imageRanges[index], `${position.id}-referencia.png`))
  );

  return {
    ...header,
    posiciones: positions.map((position, index) => ({
      ...position,
      imagenUrl: URL.createObjectURL(imageFiles[index])
    })),
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
  const matches = [...normalized.matchAll(/(?:Pos\.\s*)?(\d+)\s+([^\s]+)\s+([^\s]+)\s+(\d+)\s*[Xx]\s*(\d+)\s+(\d+)/g)];
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
      ancho: Number(match[4]),
      alto: Number(match[5]),
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
  const match = block.match(/L[IÍ]NEA\s+([^,]+)/i);
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

async function cropPageRegion(page: PDFPageProxy, range: { top: number; bottom: number } | undefined, name: string): Promise<File> {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width * 0.44);
  canvas.height = Math.max(260, Math.ceil((range?.bottom ?? viewport.height) - (range?.top ?? 0)));
  const context = canvas.getContext("2d")!;
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: [1, 0, 0, 1, 0, -(range?.top ?? 0)]
  }).promise;
  const cropped = document.createElement("canvas");
  cropped.width = canvas.width;
  cropped.height = canvas.height;
  cropped.getContext("2d")!.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvasToFile(cropped, name);
}

function findPositionRanges(items: unknown[], positions: ProductionOrderPosition[], viewport: { height: number }) {
  const anchors = positions.map((position) => {
    const item = items.map((candidate) => candidate as { str?: string; transform?: number[] }).find((candidate) => candidate.str?.includes(position.codigo ?? "__never__"));
    return item?.transform?.[5] ? viewport.height - item.transform[5] : undefined;
  });
  return positions.map((_, index) => {
    const top = Math.max(0, (anchors[index] ?? 0) - 10) * 1.5;
    const next = anchors[index + 1];
    const bottom = Math.min(viewport.height * 1.5, (next === undefined ? viewport.height : next) * 1.5);
    return { top, bottom };
  });
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(new File([blob], name, { type: "image/png" })) : reject(new Error("No se pudo generar la imagen del PDF.")), "image/png");
  });
}
