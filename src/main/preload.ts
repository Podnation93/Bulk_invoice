import { contextBridge, ipcRenderer } from 'electron';
import { ExtractedInvoice, XeroCSVRow, ValidationResult } from '../shared/types';
import { ExportResult } from '../modules/export';
import { DuplicateDetectionResult } from '../modules/validation/duplicate-detector';

export interface ElectronAPI {
  selectPDFFiles: () => Promise<string[]>;
  processPDFs: (
    filePaths: string[]
  ) => Promise<{
    invoices: ExtractedInvoice[];
    errors: Array<{ file: string; error: string }>;
  }>;
  validateInvoices: (invoices: ExtractedInvoice[]) => Promise<ValidationResult>;
  detectDuplicates: (invoices: ExtractedInvoice[]) => Promise<DuplicateDetectionResult>;
  removeDuplicates: (invoices: ExtractedInvoice[]) => Promise<ExtractedInvoice[]>;
  formatToCSVRows: (invoices: ExtractedInvoice[]) => Promise<XeroCSVRow[]>;
  previewCSV: (rows: XeroCSVRow[]) => Promise<string>;
  exportCSV: (rows: XeroCSVRow[]) => Promise<ExportResult>;
  getCSVHeaders: () => Promise<string[]>;
}

const api: ElectronAPI = {
  selectPDFFiles: () => ipcRenderer.invoke('select-pdf-files'),
  processPDFs: (filePaths) => ipcRenderer.invoke('process-pdfs', filePaths),
  validateInvoices: (invoices) => ipcRenderer.invoke('validate-invoices', invoices),
  detectDuplicates: (invoices) => ipcRenderer.invoke('detect-duplicates', invoices),
  removeDuplicates: (invoices) => ipcRenderer.invoke('remove-duplicates', invoices),
  formatToCSVRows: (invoices) => ipcRenderer.invoke('format-to-csv-rows', invoices),
  previewCSV: (rows) => ipcRenderer.invoke('preview-csv', rows),
  exportCSV: (rows) => ipcRenderer.invoke('export-csv', rows),
  getCSVHeaders: () => ipcRenderer.invoke('get-csv-headers'),
};

contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
