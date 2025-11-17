import { ExtractedInvoice, XeroCSVRow, ValidationResult, ValidationError, ValidationWarning } from '../../shared/types';
import { XERO_CSV_HEADERS, DEFAULTS, REQUIRED_FIELDS } from '../../shared/constants';

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
   * Also prevents CSV injection attacks
   */
  private sanitizeField(value: string): string {
    if (!value) return '';

    // Remove leading/trailing whitespace
    let sanitized = value.trim();

    // Prevent CSV injection - prefix dangerous characters with single quote
    // These characters can trigger formula execution in Excel/Sheets
    if (/^[=+\-@\t\r]/.test(sanitized)) {
      sanitized = "'" + sanitized;
    }

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
   * Calculate invoice totals from rows using fixed-point arithmetic to avoid floating-point errors
   */
  calculateTotals(rows: XeroCSVRow[]): Map<string, number> {
    const totals = new Map<string, number>();

    for (const row of rows) {
      const invoiceNumber = row.InvoiceNumber;
      const quantity = parseFloat(row.Quantity) || 0;
      const unitAmount = parseFloat(row.UnitAmount) || 0;

      // Use fixed-point arithmetic: multiply by 100, calculate, then divide
      // This prevents floating-point precision errors in financial calculations
      const quantityCents = Math.round(quantity * 100);
      const unitAmountCents = Math.round(unitAmount * 100);
      const lineTotalCents = (quantityCents * unitAmountCents) / 100;
      const lineTotal = lineTotalCents / 100;

      const currentTotal = totals.get(invoiceNumber) || 0;
      // Round to 2 decimal places to prevent accumulated errors
      const newTotal = Math.round((currentTotal + lineTotal) * 100) / 100;
      totals.set(invoiceNumber, newTotal);
    }

    return totals;
  }

  /**
   * Validate CSV rows for export
   * Returns validation result with errors and warnings
   */
  validateCSVRows(rows: XeroCSVRow[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Count unique invoices for statistics
    const uniqueInvoices = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 1; // 1-based for user display

      // Track unique invoices
      if (row.InvoiceNumber) {
        uniqueInvoices.add(row.InvoiceNumber);
      }

      // Check required fields
      for (const field of REQUIRED_FIELDS) {
        const value = row[field as keyof XeroCSVRow];
        if (!value || value.trim() === '') {
          errors.push({
            field,
            message: `Required field ${field} is empty`,
            row: rowIndex,
          });
        }
      }

      // Validate date formats (DD/MM/YYYY)
      if (row.InvoiceDate && !this.isValidAustralianDate(row.InvoiceDate)) {
        errors.push({
          field: 'InvoiceDate',
          message: `Invalid date format: ${row.InvoiceDate}. Expected DD/MM/YYYY`,
          row: rowIndex,
        });
      }

      if (row.DueDate && !this.isValidAustralianDate(row.DueDate)) {
        errors.push({
          field: 'DueDate',
          message: `Invalid date format: ${row.DueDate}. Expected DD/MM/YYYY`,
          row: rowIndex,
        });
      }

      // Validate numeric fields
      if (row.Quantity && isNaN(parseFloat(row.Quantity))) {
        errors.push({
          field: 'Quantity',
          message: `Invalid quantity: ${row.Quantity}`,
          row: rowIndex,
        });
      }

      if (row.UnitAmount && isNaN(parseFloat(row.UnitAmount))) {
        errors.push({
          field: 'UnitAmount',
          message: `Invalid unit amount: ${row.UnitAmount}`,
          row: rowIndex,
        });
      }

      // Check for potential issues
      if (!row.AccountCode || row.AccountCode === DEFAULTS.ACCOUNT_CODE) {
        warnings.push({
          field: 'AccountCode',
          message: `Using default account code ${DEFAULTS.ACCOUNT_CODE}`,
          row: rowIndex,
        });
      }

      if (!row.Description || row.Description.trim().length < 3) {
        warnings.push({
          field: 'Description',
          message: 'Description is very short or empty',
          row: rowIndex,
        });
      }
    }

    // Check for duplicate invoice numbers (might be intentional for multi-line items)
    const invoiceCounts = new Map<string, number>();
    for (const row of rows) {
      const count = invoiceCounts.get(row.InvoiceNumber) || 0;
      invoiceCounts.set(row.InvoiceNumber, count + 1);
    }

    // Add summary warning if large number of rows per invoice
    for (const [invoiceNum, count] of invoiceCounts.entries()) {
      if (count > 50) {
        warnings.push({
          field: 'InvoiceNumber',
          message: `Invoice ${invoiceNum} has ${count} line items - verify this is correct`,
          invoiceNumber: invoiceNum,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate date is in Australian format DD/MM/YYYY
   */
  private isValidAustralianDate(dateStr: string): boolean {
    const pattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(pattern);

    if (!match) return false;

    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);

    // Basic range checks
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;

    // Check days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return false;

    return true;
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
