import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import { PDFMetadata, PDFType, ProcessingStatus } from '../../shared/types';

export class PDFProcessor {
  private processingStatus: ProcessingStatus;

  constructor() {
    this.processingStatus = {
      totalFiles: 0,
      processedFiles: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      errors: [],
    };
  }

  /**
   * Load multiple PDF files from given paths
   */
  async loadPDFs(filePaths: string[]): Promise<PDFMetadata[]> {
    const metadata: PDFMetadata[] = [];
    this.processingStatus.totalFiles = filePaths.length;

    for (const filePath of filePaths) {
      try {
        const pdfMetadata = await this.analyzePDF(filePath);
        metadata.push(pdfMetadata);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.processingStatus.errors.push({
          file: filePath,
          error: `Failed to load PDF: ${errorMessage}`,
        });
      }
    }

    return metadata;
  }

  /**
   * Analyze a single PDF to determine its type and metadata
   */
  async analyzePDF(filePath: string): Promise<PDFMetadata> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);

    let pageCount = 1;
    let pdfType: PDFType = 'unknown';

    try {
      const pdfData = await pdfParse(buffer);
      pageCount = pdfData.numpages;

      // Determine if PDF is digital or scanned based on text content
      pdfType = this.determinePDFType(pdfData.text, pageCount);
    } catch (error) {
      // If parsing fails, assume it needs OCR
      pdfType = 'scanned';
    }

    return {
      filePath,
      fileName: path.basename(filePath),
      pageCount,
      pdfType,
      fileSize: stats.size,
    };
  }

  /**
   * Determine if PDF is digital (has embedded text) or scanned (needs OCR)
   */
  private determinePDFType(text: string, pageCount: number): PDFType {
    // Calculate average characters per page
    const avgCharsPerPage = text.length / pageCount;

    // If very little text content, likely scanned
    if (avgCharsPerPage < 100) {
      return 'scanned';
    }

    // If has reasonable text content, likely digital
    if (avgCharsPerPage > 500) {
      return 'digital';
    }

    // Uncertain, may need OCR to enhance
    return 'unknown';
  }

  /**
   * Extract raw text from a digital PDF
   */
  async extractTextFromDigitalPDF(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  }

  /**
   * Get current processing status
   */
  getStatus(): ProcessingStatus {
    return { ...this.processingStatus };
  }

  /**
   * Update processing status
   */
  updateStatus(updates: Partial<ProcessingStatus>): void {
    this.processingStatus = { ...this.processingStatus, ...updates };
  }

  /**
   * Reset processing status
   */
  resetStatus(): void {
    this.processingStatus = {
      totalFiles: 0,
      processedFiles: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      errors: [],
    };
  }

  /**
   * Validate that file is a PDF
   */
  static isPDF(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.pdf';
  }

  /**
   * Filter only PDF files from a list of paths
   */
  static filterPDFFiles(filePaths: string[]): string[] {
    return filePaths.filter((fp) => PDFProcessor.isPDF(fp));
  }
}

export default PDFProcessor;
