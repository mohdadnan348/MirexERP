
import PDFDocument from "pdfkit";
import { Response } from "express";

/**
 * PDF document configuration.
 */
export interface PdfOptions {
  title?: string;
  author?: string;
  subject?: string;
  pageSize?: "A4" | "A3" | "A6" | "LETTER";
  landscape?: boolean;
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

/**
 * PDF content callback.
 */
export type PdfContentBuilder = (
  doc: PDFKit.PDFDocument
) => void | Promise<void>;

/**
 * Create a configured PDF document.
 */
export const createPdfDocument = (
  options: PdfOptions = {}
): PDFKit.PDFDocument => {
  const {
    title = "MirexERP Document",
    author = "MirexERP",
    subject = "School Management Document",
    pageSize = "A4",
    landscape = false,
    margins = {},
  } = options;

  const doc = new PDFDocument({
    size: pageSize,
    layout: landscape ? "landscape" : "portrait",
    margins: {
      top: margins.top ?? 50,
      bottom: margins.bottom ?? 50,
      left: margins.left ?? 50,
      right: margins.right ?? 50,
    },
    info: {
      Title: title,
      Author: author,
      Subject: subject,
      Creator: "MirexERP",
    },
    bufferPages: true,
    autoFirstPage: true,
  });

  return doc;
};

/**
 * Generate a PDF and return its contents as a Buffer.
 *
 * Useful when saving a PDF, uploading it to cloud storage,
 * or attaching it to an email.
 */
export const generatePdfBuffer = async (
  buildContent: PdfContentBuilder,
  options: PdfOptions = {}
): Promise<Buffer> => {
  const doc = createPdfDocument(options);

  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      doc.removeAllListeners("data");
      doc.removeAllListeners("end");
      doc.removeAllListeners("error");
    };

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });

    doc.on("end", () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", fail);

    void (async () => {
      try {
        await buildContent(doc);

        if (!settled) {
          doc.end();
        }
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error("PDF generation failed.")
        );

        doc.destroy();
      }
    })();
  });
};

/**
 * Send a generated PDF directly to the browser.
 *
 * The browser can display or download the PDF.
 */
export const sendPdfResponse = (
  res: Response,
  pdfBuffer: Buffer,
  filename: string,
  download = true
): Response => {
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "");

  const finalFilename = safeFilename || "document.pdf";

  res.setHeader("Content-Type", "application/pdf");

  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${finalFilename}"`
  );

  res.setHeader("Content-Length", pdfBuffer.length);

  res.setHeader("Cache-Control", "private, no-store");

  return res.status(200).send(pdfBuffer);
};

/**
 * Generate a PDF and send it directly in the response.
 */
export const generateAndSendPdf = async (
  res: Response,
  buildContent: PdfContentBuilder,
  filename: string,
  options: PdfOptions = {},
  download = true
): Promise<Response> => {
  const pdfBuffer = await generatePdfBuffer(
    buildContent,
    options
  );

  return sendPdfResponse(
    res,
    pdfBuffer,
    filename,
    download
  );
};

