import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import { XeroCSVRow, ValidationResult } from '../../shared/types';
import { XERO_CSV_HEADERS } from '../../shared/constants';

export interface ExportOptions {
  outputPath: string;
  includeHeaders?: boolean;
  encoding?: BufferEncoding;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  rowCount: number;
  fileSize?: number;
  error?: string;
}

export interface ExportLog {
  timestamp: Date;
  filePath: string;
  rowCount: number;
  invoiceCount: number;
  warnings: string[];
  errors: string[];
}

export class ExportModule {
  private logs: ExportLog[] = [];

  /**
   * Export rows to CSV file
   */
  exportToCSV(rows: XeroCSVRow[], options: ExportOptions): ExportResult {
    const { outputPath, includeHeaders = true, encoding = 'utf-8' } = options;

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate CSV content
      const csvContent = this.generateCSVContent(rows, includeHeaders);

      // Write to file with UTF-8 BOM for Excel compatibility
      const bom = '\ufeff';
      const contentWithBom = bom + csvContent;
      fs.writeFileSync(outputPath, contentWithBom, { encoding });

      const stats = fs.statSync(outputPath);

      return {
        success: true,
        filePath: outputPath,
        rowCount: rows.length,
        fileSize: stats.size,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        rowCount: rows.length,
        error: `Failed to export CSV: ${errorMessage}`,
      };
    }
  }

  /**
   * Generate CSV content string using csv-stringify
   */
  private generateCSVContent(rows: XeroCSVRow[], includeHeaders: boolean): string {
    const headers = [...XERO_CSV_HEADERS];

    // Convert rows to array format for csv-stringify
    const dataRows = rows.map((row) =>
      headers.map((header) => row[header as keyof XeroCSVRow])
    );

    if (includeHeaders) {
      dataRows.unshift(headers);
    }

    return stringify(dataRows, {
      delimiter: ',',
      quoted: true,
      quoted_empty: false,
    });
  }

  /**
   * Create a preview export (returns string instead of writing to file)
   */
  previewExport(rows: XeroCSVRow[]): string {
    return this.generateCSVContent(rows, true);
  }

  /**
   * Export with validation results included in a separate log file
   */
  exportWithLog(
    rows: XeroCSVRow[],
    options: ExportOptions,
    validationResult: ValidationResult
  ): ExportResult {
    // Export CSV
    const exportResult = this.exportToCSV(rows, options);

    if (exportResult.success && exportResult.filePath) {
      // Create log file alongside CSV
      const logPath = exportResult.filePath.replace('.csv', '.log');
      this.writeExportLog(
        logPath,
        exportResult.filePath,
        rows.length,
        validationResult
      );
    }

    return exportResult;
  }

  /**
   * Write export log to file
   */
  private writeExportLog(
    logPath: string,
    csvPath: string,
    rowCount: number,
    validationResult: ValidationResult
  ): void {
    const uniqueInvoices = new Set(
      // We need to count unique invoices somehow
      // This is a simplified version
    );

    const logContent = [
      `Export Log - ${new Date().toISOString()}`,
      '═'.repeat(60),
      `CSV File: ${csvPath}`,
      `Total Rows: ${rowCount}`,
      '',
      'Validation Summary:',
      `  Valid: ${validationResult.isValid}`,
      `  Errors: ${validationResult.errors.length}`,
      `  Warnings: ${validationResult.warnings.length}`,
      '',
    ];

    if (validationResult.errors.length > 0) {
      logContent.push('Errors:');
      for (const error of validationResult.errors) {
        logContent.push(`  - [${error.field}] ${error.message}`);
      }
      logContent.push('');
    }

    if (validationResult.warnings.length > 0) {
      logContent.push('Warnings:');
      for (const warning of validationResult.warnings) {
        logContent.push(`  - [${warning.field}] ${warning.message}`);
      }
      logContent.push('');
    }

    fs.writeFileSync(logPath, logContent.join('\n'), 'utf-8');

    // Store in memory log
    this.logs.push({
      timestamp: new Date(),
      filePath: csvPath,
      rowCount,
      invoiceCount: 0, // Would need to calculate from rows
      warnings: validationResult.warnings.map((w) => w.message),
      errors: validationResult.errors.map((e) => e.message),
    });
  }

  /**
   * Get export logs
   */
  getLogs(): ExportLog[] {
    return [...this.logs];
  }

  /**
   * Clear export logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Generate suggested filename based on current date
   */
  static generateFilename(prefix: string = 'xero_invoices'): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return `${prefix}_${dateStr}_${timeStr}.csv`;
  }

  /**
   * Validate output path is writable
   */
  static validateOutputPath(outputPath: string): boolean {
    try {
      const dir = path.dirname(outputPath);

      if (!fs.existsSync(dir)) {
        // Try to create directory
        fs.mkdirSync(dir, { recursive: true });
      }

      // Check if we can write
      const testFile = path.join(dir, '.write_test');
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

export default ExportModule;
