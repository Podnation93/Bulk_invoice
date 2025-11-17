import Tesseract from 'tesseract.js';
import * as path from 'path';
import * as fs from 'fs';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export interface OCROptions {
  language?: string;
  confidenceThreshold?: number;
}

export class OCREngine {
  private worker: Tesseract.Worker | null = null;
  private language: string;
  private confidenceThreshold: number;

  constructor(options: OCROptions = {}) {
    this.language = options.language || 'eng';
    this.confidenceThreshold = options.confidenceThreshold || 60;
  }

  /**
   * Initialize the Tesseract worker
   */
  async initialize(): Promise<void> {
    if (!this.worker) {
      this.worker = await Tesseract.createWorker(this.language);
    }
  }

  /**
   * Perform OCR on a single image file
   */
  async recognizeImage(imagePath: string): Promise<OCRResult> {
    await this.initialize();

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    const result = await this.worker.recognize(imagePath);
    const words = result.data.words.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox,
    }));

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words,
    };
  }

  /**
   * Perform OCR on multiple images (pages)
   */
  async recognizeMultipleImages(imagePaths: string[]): Promise<OCRResult> {
    const results: OCRResult[] = [];

    for (const imagePath of imagePaths) {
      const result = await this.recognizeImage(imagePath);
      results.push(result);
    }

    // Combine results
    return this.combineResults(results);
  }

  /**
   * Combine multiple OCR results into one
   */
  private combineResults(results: OCRResult[]): OCRResult {
    const combinedText = results.map((r) => r.text).join('\n\n--- Page Break ---\n\n');
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const allWords = results.flatMap((r) => r.words);

    return {
      text: combinedText,
      confidence: avgConfidence,
      words: allWords,
    };
  }

  /**
   * Extract text from a PDF by converting pages to images first
   * This requires pdf2pic or similar library to convert PDF pages to images
   */
  async extractTextFromScannedPDF(pdfPath: string): Promise<OCRResult> {
    // For now, we'll use a placeholder that indicates PDF-to-image conversion is needed
    // In production, this would use pdf2pic to convert PDF pages to images
    const tempDir = path.join(path.dirname(pdfPath), '.ocr-temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      // Convert PDF to images using pdf2pic
      const { fromPath } = await import('pdf2pic');
      const options = {
        density: 300,
        saveFilename: path.basename(pdfPath, '.pdf'),
        savePath: tempDir,
        format: 'png',
        width: 2480,
        height: 3508,
      };

      const converter = fromPath(pdfPath, options);
      const pageToConvert = 1;
      const imageResult = await converter(pageToConvert, { responseType: 'image' });

      if (!imageResult.path) {
        throw new Error('Failed to convert PDF to image');
      }

      // Perform OCR on the generated image
      const ocrResult = await this.recognizeImage(imageResult.path);

      // Clean up temporary files
      this.cleanupTempFiles(tempDir);

      return ocrResult;
    } catch (error) {
      this.cleanupTempFiles(tempDir);
      throw error;
    }
  }

  /**
   * Clean up temporary OCR files
   */
  private cleanupTempFiles(tempDir: string): void {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
  }

  /**
   * Check if OCR result meets confidence threshold
   */
  meetsConfidenceThreshold(result: OCRResult): boolean {
    return result.confidence >= this.confidenceThreshold;
  }

  /**
   * Get low-confidence words that may need manual review
   */
  getLowConfidenceWords(result: OCRResult): string[] {
    return result.words
      .filter((word) => word.confidence < this.confidenceThreshold)
      .map((word) => word.text);
  }

  /**
   * Terminate the OCR worker to free resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export default OCREngine;
