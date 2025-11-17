import { ExtractedInvoice, XeroCSVRow } from '../../shared/types';
import { XERO_CSV_HEADERS, DEFAULTS } from '../../shared/constants';

export class TemplateFormatter {
  /**
   * Convert extracted invoices to Xero CSV rows
   * Each line item becomes a separate row in the CSV
   */
  formatInvoicesToCSVRows(invoices: ExtractedInvoice[]): XeroCSVRow[] {
    const rows: XeroCSVRow[] = [];

    for (const invoice of invoices) {
      const invoiceRows = this.formatSingleInvoice(invoice);
      rows.push(...invoiceRows);
    }

    return rows;
  }

  /**
   * Format a single invoice into CSV rows (one per line item)
   */
  formatSingleInvoice(invoice: ExtractedInvoice): XeroCSVRow[] {
    const rows: XeroCSVRow[] = [];

    for (const lineItem of invoice.lineItems) {
      const row: XeroCSVRow = {
        ContactName: this.sanitizeField(invoice.contactName),
        InvoiceNumber: this.sanitizeField(invoice.invoiceNumber),
        InvoiceDate: invoice.invoiceDate,
        DueDate: invoice.dueDate,
        Description: this.sanitizeField(lineItem.description),
        Quantity: this.formatNumber(lineItem.quantity),
        UnitAmount: this.formatCurrency(lineItem.unitAmount),
        AccountCode: lineItem.accountCode || DEFAULTS.ACCOUNT_CODE,
        TaxType: lineItem.taxType || DEFAULTS.TAX_TYPE,
        Reference: invoice.reference ? this.sanitizeField(invoice.reference) : '',
      };

      rows.push(row);
    }

    return rows;
  }

  /**
   * Get CSV headers as array
   */
  getHeaders(): string[] {
    return [...XERO_CSV_HEADERS];
  }

  /**
   * Convert rows to CSV string
   */
  rowsToCSVString(rows: XeroCSVRow[]): string {
    const headers = this.getHeaders();
    const lines: string[] = [];

    // Add header row
    lines.push(headers.join(','));

    // Add data rows
    for (const row of rows) {
      const values = headers.map((header) => {
        const value = row[header as keyof XeroCSVRow];
        return this.escapeCSVField(value);
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Escape a field for CSV (handle commas, quotes, newlines)
   */
  private escapeCSVField(value: string): string {
    if (!value) return '';

    // If contains comma, quote, or newline, wrap in quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      // Escape existing quotes by doubling them
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    }

    return value;
  }

  /**
   * Sanitize field for CSV (remove problematic characters)
   */
  private sanitizeField(value: string): string {
    if (!value) return '';

    // Remove leading/trailing whitespace
    let sanitized = value.trim();

    // Replace multiple spaces with single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Format number for CSV
   */
  private formatNumber(value: number): string {
    if (isNaN(value)) return DEFAULTS.QUANTITY;
    return value.toString();
  }

  /**
   * Format currency value for CSV (2 decimal places)
   */
  private formatCurrency(value: number): string {
    if (isNaN(value)) return '0.00';
    return value.toFixed(2);
  }

  /**
   * Create a preview of the CSV data
   */
  createPreview(rows: XeroCSVRow[], maxRows: number = 10): string {
    const headers = this.getHeaders();
    const previewRows = rows.slice(0, maxRows);

    let preview = 'CSV Preview:\n';
    preview += '─'.repeat(80) + '\n';
    preview += headers.join(' | ') + '\n';
    preview += '─'.repeat(80) + '\n';

    for (const row of previewRows) {
      const values = headers.map((header) => {
        const value = row[header as keyof XeroCSVRow];
        // Truncate long values for preview
        return value.length > 15 ? value.substring(0, 12) + '...' : value.padEnd(15);
      });
      preview += values.join(' | ') + '\n';
    }

    if (rows.length > maxRows) {
      preview += `... and ${rows.length - maxRows} more rows\n`;
    }

    preview += '─'.repeat(80) + '\n';
    preview += `Total rows: ${rows.length}\n`;

    return preview;
  }

  /**
   * Validate that rows match expected schema
   */
  validateRowSchema(row: XeroCSVRow): boolean {
    const headers = this.getHeaders();

    for (const header of headers) {
      if (!(header in row)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate invoice totals from rows
   */
  calculateTotals(rows: XeroCSVRow[]): Map<string, number> {
    const totals = new Map<string, number>();

    for (const row of rows) {
      const invoiceNumber = row.InvoiceNumber;
      const quantity = parseFloat(row.Quantity) || 0;
      const unitAmount = parseFloat(row.UnitAmount) || 0;
      const lineTotal = quantity * unitAmount;

      const currentTotal = totals.get(invoiceNumber) || 0;
      totals.set(invoiceNumber, currentTotal + lineTotal);
    }

    return totals;
  }

  /**
   * Group rows by invoice number
   */
  groupRowsByInvoice(rows: XeroCSVRow[]): Map<string, XeroCSVRow[]> {
    const grouped = new Map<string, XeroCSVRow[]>();

    for (const row of rows) {
      const invoiceNumber = row.InvoiceNumber;
      const existing = grouped.get(invoiceNumber) || [];
      existing.push(row);
      grouped.set(invoiceNumber, existing);
    }

    return grouped;
  }
}

export default TemplateFormatter;
