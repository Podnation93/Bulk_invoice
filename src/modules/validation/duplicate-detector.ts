import * as crypto from 'crypto';
import { ExtractedInvoice, XeroCSVRow } from '../../shared/types';

export interface DuplicateDetectionResult {
  hasDuplicates: boolean;
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
  uniqueInvoices: number;
}

export interface DuplicateGroup {
  invoiceNumber: string;
  contactName: string;
  invoiceDate: string;
  totalAmount: number;
  occurrences: number;
  sourceFiles: string[];
  hash: string;
}

export interface InvoiceFingerprint {
  hash: string;
  invoiceNumber: string;
  contactName: string;
  invoiceDate: string;
  totalAmount: number;
  sourceFile: string;
}

/**
 * Detects duplicate invoices to prevent double-importing into Xero
 */
export class DuplicateDetector {
  private seenInvoices: Map<string, InvoiceFingerprint[]> = new Map();
  private hashCache: Map<string, string> = new Map();

  /**
   * Detect duplicates in a list of extracted invoices
   */
  detectDuplicates(invoices: ExtractedInvoice[]): DuplicateDetectionResult {
    this.seenInvoices.clear();
    this.hashCache.clear();

    // Create fingerprints for all invoices
    for (const invoice of invoices) {
      const fingerprint = this.createFingerprint(invoice);
      const existing = this.seenInvoices.get(fingerprint.hash) || [];
      existing.push(fingerprint);
      this.seenInvoices.set(fingerprint.hash, existing);
    }

    // Identify duplicate groups
    const duplicateGroups: DuplicateGroup[] = [];
    let totalDuplicates = 0;

    for (const [hash, fingerprints] of this.seenInvoices.entries()) {
      if (fingerprints.length > 1) {
        const first = fingerprints[0];
        duplicateGroups.push({
          invoiceNumber: first.invoiceNumber,
          contactName: first.contactName,
          invoiceDate: first.invoiceDate,
          totalAmount: first.totalAmount,
          occurrences: fingerprints.length,
          sourceFiles: fingerprints.map((f) => f.sourceFile),
          hash,
        });
        totalDuplicates += fingerprints.length - 1; // Count extra occurrences
      }
    }

    return {
      hasDuplicates: duplicateGroups.length > 0,
      duplicateGroups,
      totalDuplicates,
      uniqueInvoices: this.seenInvoices.size,
    };
  }

  /**
   * Check if a single invoice is a duplicate of previously seen invoices
   */
  isDuplicate(invoice: ExtractedInvoice): boolean {
    const fingerprint = this.createFingerprint(invoice);
    const existing = this.seenInvoices.get(fingerprint.hash);

    if (existing && existing.length > 0) {
      // Check if it's from a different source file
      return existing.some((f) => f.sourceFile !== invoice.sourceFile);
    }

    return false;
  }

  /**
   * Add an invoice to the tracking set
   */
  trackInvoice(invoice: ExtractedInvoice): void {
    const fingerprint = this.createFingerprint(invoice);
    const existing = this.seenInvoices.get(fingerprint.hash) || [];
    existing.push(fingerprint);
    this.seenInvoices.set(fingerprint.hash, existing);
  }

  /**
   * Create a fingerprint for an invoice based on key identifying fields
   */
  private createFingerprint(invoice: ExtractedInvoice): InvoiceFingerprint {
    const totalAmount = invoice.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitAmount,
      0
    );

    // Create hash based on key fields that should be unique
    const hashInput = [
      invoice.invoiceNumber.toLowerCase().trim(),
      invoice.contactName.toLowerCase().trim(),
      invoice.invoiceDate,
      totalAmount.toFixed(2),
    ].join('|');

    const hash = this.generateHash(hashInput);

    return {
      hash,
      invoiceNumber: invoice.invoiceNumber,
      contactName: invoice.contactName,
      invoiceDate: invoice.invoiceDate,
      totalAmount,
      sourceFile: invoice.sourceFile,
    };
  }

  /**
   * Generate a hash for the invoice fingerprint
   */
  private generateHash(input: string): string {
    if (this.hashCache.has(input)) {
      return this.hashCache.get(input)!;
    }

    const hash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
    this.hashCache.set(input, hash);
    return hash;
  }

  /**
   * Detect duplicates in CSV rows (for already formatted data)
   */
  detectDuplicatesInCSV(rows: XeroCSVRow[]): DuplicateDetectionResult {
    const rowGroups = new Map<string, XeroCSVRow[]>();

    // Group rows by invoice number first
    for (const row of rows) {
      const key = row.InvoiceNumber;
      const existing = rowGroups.get(key) || [];
      existing.push(row);
      rowGroups.set(key, existing);
    }

    // Now check for true duplicates (same invoice imported multiple times)
    const fingerprints = new Map<string, string[]>();

    for (const [invoiceNumber, invoiceRows] of rowGroups.entries()) {
      // Calculate total for this invoice
      const total = invoiceRows.reduce(
        (sum, row) =>
          sum + (parseFloat(row.Quantity) || 0) * (parseFloat(row.UnitAmount) || 0),
        0
      );

      const firstRow = invoiceRows[0];
      const hashInput = [
        invoiceNumber.toLowerCase().trim(),
        firstRow.ContactName.toLowerCase().trim(),
        firstRow.InvoiceDate,
        total.toFixed(2),
      ].join('|');

      const hash = this.generateHash(hashInput);

      const existing = fingerprints.get(hash) || [];
      existing.push(invoiceNumber);
      fingerprints.set(hash, existing);
    }

    // Find duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    let totalDuplicates = 0;

    for (const [hash, invoiceNumbers] of fingerprints.entries()) {
      if (invoiceNumbers.length > 1) {
        const firstInvoice = rowGroups.get(invoiceNumbers[0])![0];
        const total = rowGroups.get(invoiceNumbers[0])!.reduce(
          (sum, row) =>
            sum + (parseFloat(row.Quantity) || 0) * (parseFloat(row.UnitAmount) || 0),
          0
        );

        duplicateGroups.push({
          invoiceNumber: invoiceNumbers[0],
          contactName: firstInvoice.ContactName,
          invoiceDate: firstInvoice.InvoiceDate,
          totalAmount: total,
          occurrences: invoiceNumbers.length,
          sourceFiles: invoiceNumbers,
          hash,
        });
        totalDuplicates += invoiceNumbers.length - 1;
      }
    }

    return {
      hasDuplicates: duplicateGroups.length > 0,
      duplicateGroups,
      totalDuplicates,
      uniqueInvoices: fingerprints.size,
    };
  }

  /**
   * Remove duplicate invoices, keeping only the first occurrence
   */
  removeDuplicates(invoices: ExtractedInvoice[]): ExtractedInvoice[] {
    const seen = new Set<string>();
    const unique: ExtractedInvoice[] = [];

    for (const invoice of invoices) {
      const fingerprint = this.createFingerprint(invoice);

      if (!seen.has(fingerprint.hash)) {
        seen.add(fingerprint.hash);
        unique.push(invoice);
      }
    }

    return unique;
  }

  /**
   * Format duplicate detection result as human-readable string
   */
  formatResult(result: DuplicateDetectionResult): string {
    if (!result.hasDuplicates) {
      return `No duplicates found. ${result.uniqueInvoices} unique invoices detected.`;
    }

    let output = `⚠️ DUPLICATE INVOICES DETECTED\n`;
    output += `═══════════════════════════════════════\n`;
    output += `Total Duplicates: ${result.totalDuplicates}\n`;
    output += `Unique Invoices: ${result.uniqueInvoices}\n\n`;

    for (const group of result.duplicateGroups) {
      output += `Invoice #${group.invoiceNumber}\n`;
      output += `  Contact: ${group.contactName}\n`;
      output += `  Date: ${group.invoiceDate}\n`;
      output += `  Amount: $${group.totalAmount.toFixed(2)}\n`;
      output += `  Occurrences: ${group.occurrences}\n`;
      output += `  Sources: ${group.sourceFiles.join(', ')}\n\n`;
    }

    return output;
  }

  /**
   * Clear the tracking state
   */
  reset(): void {
    this.seenInvoices.clear();
    this.hashCache.clear();
  }
}

export default DuplicateDetector;
