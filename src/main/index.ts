import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { PDFProcessor } from '../modules/pdf-processor';
import { OCREngine } from '../modules/ocr';
import { InvoiceParser } from '../modules/parser';
import { InvoiceValidator, DuplicateDetector } from '../modules/validation';
import { TemplateFormatter } from '../modules/formatter';
import { ExportModule } from '../modules/export';
import { ExtractedInvoice, XeroCSVRow } from '../shared/types';

let mainWindow: BrowserWindow | null = null;

const pdfProcessor = new PDFProcessor();
const ocrEngine = new OCREngine();
const invoiceParser = new InvoiceParser();
const invoiceValidator = new InvoiceValidator();
const duplicateDetector = new DuplicateDetector();
const templateFormatter = new TemplateFormatter();
const exportModule = new ExportModule();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the React app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers

ipcMain.handle('select-pdf-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });

  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

ipcMain.handle('process-pdfs', async (_event, filePaths: string[]) => {
  const extractedInvoices: ExtractedInvoice[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  try {
    await ocrEngine.initialize();

    const metadata = await pdfProcessor.loadPDFs(filePaths);

    for (const pdf of metadata) {
      try {
        let text: string;

        if (pdf.pdfType === 'digital') {
          text = await pdfProcessor.extractTextFromDigitalPDF(pdf.filePath);
        } else {
          const ocrResult = await ocrEngine.extractTextFromScannedPDF(pdf.filePath);
          text = ocrResult.text;
        }

        const invoice = invoiceParser.parseInvoiceText(text, pdf.fileName);
        extractedInvoices.push(invoice);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          file: pdf.fileName,
          error: errorMessage,
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push({
      file: 'Initialization',
      error: errorMessage,
    });
  } finally {
    // Always terminate OCR worker to prevent memory leaks
    await ocrEngine.terminate();
  }

  return {
    invoices: extractedInvoices,
    errors,
  };
});

ipcMain.handle('validate-invoices', async (_event, invoices: ExtractedInvoice[]) => {
  return invoiceValidator.validateInvoices(invoices);
});

ipcMain.handle('detect-duplicates', async (_event, invoices: ExtractedInvoice[]) => {
  return duplicateDetector.detectDuplicates(invoices);
});

ipcMain.handle('remove-duplicates', async (_event, invoices: ExtractedInvoice[]) => {
  return duplicateDetector.removeDuplicates(invoices);
});

ipcMain.handle('format-to-csv-rows', async (_event, invoices: ExtractedInvoice[]) => {
  return templateFormatter.formatInvoicesToCSVRows(invoices);
});

ipcMain.handle('preview-csv', async (_event, rows: XeroCSVRow[]) => {
  return templateFormatter.createPreview(rows);
});

ipcMain.handle('export-csv', async (_event, rows: XeroCSVRow[]) => {
  const result = await dialog.showSaveDialog({
    defaultPath: ExportModule.generateFilename(),
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  });

  if (!result.canceled && result.filePath) {
    const validationResult = invoiceValidator.validateInvoices([]);
    return exportModule.exportWithLog(
      rows,
      { outputPath: result.filePath },
      validationResult
    );
  }

  return { success: false, rowCount: 0, error: 'Export cancelled' };
});

ipcMain.handle('get-csv-headers', () => {
  return templateFormatter.getHeaders();
});

// Cleanup on exit
app.on('before-quit', async () => {
  await ocrEngine.terminate();
});
