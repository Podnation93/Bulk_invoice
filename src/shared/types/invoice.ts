/**
 * Core invoice data types for the Bulk Invoice Extractor
 */

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode?: string;
  taxType?: string;
}

export interface ExtractedInvoice {
  invoiceNumber: string;
  invoiceDate: string; // DD/MM/YYYY format
  dueDate: string; // DD/MM/YYYY format
  contactName: string;
  reference?: string;
  lineItems: InvoiceLineItem[];
  sourceFile: string;
  extractionConfidence: number;
  warnings: string[];
}

export interface XeroCSVRow {
  ContactName: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Description: string;
  Quantity: string;
  UnitAmount: string;
  AccountCode: string;
  TaxType: string;
  Reference: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  row?: number;
  invoiceNumber?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  row?: number;
  invoiceNumber?: string;
}

export interface ExtractionResult {
  success: boolean;
  invoice?: ExtractedInvoice;
  error?: string;
  sourceFile: string;
}

export interface ProcessingStatus {
  totalFiles: number;
  processedFiles: number;
  successfulExtractions: number;
  failedExtractions: number;
  currentFile?: string;
  errors: Array<{ file: string; error: string }>;
}

export type PDFType = 'digital' | 'scanned' | 'unknown';

export interface PDFMetadata {
  filePath: string;
  fileName: string;
  pageCount: number;
  pdfType: PDFType;
  fileSize: number;
}
