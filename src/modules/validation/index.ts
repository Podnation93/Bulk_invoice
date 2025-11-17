import {
  ExtractedInvoice,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  XeroCSVRow,
} from '../../shared/types';
import { REQUIRED_FIELDS, XERO_CSV_HEADERS } from '../../shared/constants';

export class InvoiceValidator {
  /**
   * Validate a single extracted invoice
   */
  validateInvoice(invoice: ExtractedInvoice): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate required fields
    if (!invoice.invoiceNumber) {
      errors.push({
        field: 'InvoiceNumber',
        message: 'Invoice number is required',
        invoiceNumber: invoice.invoiceNumber || 'unknown',
      });
    }

    if (!invoice.contactName) {
      errors.push({
        field: 'ContactName',
        message: 'Contact name is required',
        invoiceNumber: invoice.invoiceNumber,
      });
    }

    if (!invoice.invoiceDate) {
      errors.push({
        field: 'InvoiceDate',
        message: 'Invoice date is required',
        invoiceNumber: invoice.invoiceNumber,
      });
    } else if (!this.isValidAustralianDate(invoice.invoiceDate)) {
      errors.push({
        field: 'InvoiceDate',
        message: `Invalid date format: ${invoice.invoiceDate}. Expected DD/MM/YYYY`,
        invoiceNumber: invoice.invoiceNumber,
      });
    }

    if (!invoice.dueDate) {
      errors.push({
        field: 'DueDate',
        message: 'Due date is required',
        invoiceNumber: invoice.invoiceNumber,
      });
    } else if (!this.isValidAustralianDate(invoice.dueDate)) {
      errors.push({
        field: 'DueDate',
        message: `Invalid date format: ${invoice.dueDate}. Expected DD/MM/YYYY`,
        invoiceNumber: invoice.invoiceNumber,
      });
    }

    // Validate line items
    if (invoice.lineItems.length === 0) {
      errors.push({
        field: 'LineItems',
        message: 'At least one line item is required',
        invoiceNumber: invoice.invoiceNumber,
      });
    }

    for (let i = 0; i < invoice.lineItems.length; i++) {
      const item = invoice.lineItems[i];

      if (!item.description) {
        warnings.push({
          field: 'Description',
          message: `Line item ${i + 1} has no description`,
          invoiceNumber: invoice.invoiceNumber,
        });
      }

      if (isNaN(item.quantity) || item.quantity <= 0) {
        errors.push({
          field: 'Quantity',
          message: `Line item ${i + 1} has invalid quantity: ${item.quantity}`,
          invoiceNumber: invoice.invoiceNumber,
        });
      }

      if (isNaN(item.unitAmount)) {
        errors.push({
          field: 'UnitAmount',
          message: `Line item ${i + 1} has invalid unit amount`,
          invoiceNumber: invoice.invoiceNumber,
        });
      }

      if (!item.accountCode) {
        warnings.push({
          field: 'AccountCode',
          message: `Line item ${i + 1} has no account code (will use default)`,
          invoiceNumber: invoice.invoiceNumber,
        });
      }
    }

    // Validate confidence
    if (invoice.extractionConfidence < 60) {
      warnings.push({
        field: 'Confidence',
        message: `Low extraction confidence: ${invoice.extractionConfidence}%. Manual review recommended.`,
        invoiceNumber: invoice.invoiceNumber,
      });
    }

    // Add extraction warnings
    for (const warning of invoice.warnings) {
      warnings.push({
        field: 'Extraction',
        message: warning,
        invoiceNumber: invoice.invoiceNumber,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate multiple invoices
   */
  validateInvoices(invoices: ExtractedInvoice[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for duplicate invoice numbers
    const invoiceNumbers = new Map<string, number>();
    for (const invoice of invoices) {
      const count = invoiceNumbers.get(invoice.invoiceNumber) || 0;
      invoiceNumbers.set(invoice.invoiceNumber, count + 1);
    }

    for (const [number, count] of invoiceNumbers.entries()) {
      if (count > 1) {
        warnings.push({
          field: 'InvoiceNumber',
          message: `Duplicate invoice number: ${number} appears ${count} times`,
          invoiceNumber: number,
        });
      }
    }

    // Validate each invoice
    for (const invoice of invoices) {
      const result = this.validateInvoice(invoice);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate CSV row against Xero template schema
   */
  validateCSVRow(row: XeroCSVRow, rowIndex: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!row[field] || row[field].trim() === '') {
        errors.push({
          field,
          message: `Required field ${field} is empty`,
          row: rowIndex,
        });
      }
    }

    // Validate date formats
    if (row.InvoiceDate && !this.isValidAustralianDate(row.InvoiceDate)) {
      errors.push({
        field: 'InvoiceDate',
        message: `Invalid date format: ${row.InvoiceDate}`,
        row: rowIndex,
      });
    }

    if (row.DueDate && !this.isValidAustralianDate(row.DueDate)) {
      errors.push({
        field: 'DueDate',
        message: `Invalid date format: ${row.DueDate}`,
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

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate CSV headers match Xero template exactly
   */
  validateCSVHeaders(headers: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (headers.length !== XERO_CSV_HEADERS.length) {
      errors.push({
        field: 'Headers',
        message: `Expected ${XERO_CSV_HEADERS.length} columns, found ${headers.length}`,
      });
    }

    for (let i = 0; i < XERO_CSV_HEADERS.length; i++) {
      const expected = XERO_CSV_HEADERS[i];
      const actual = headers[i];

      if (actual !== expected) {
        errors.push({
          field: 'Headers',
          message: `Column ${i + 1} should be "${expected}", found "${actual || 'missing'}"`,
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
   * Format validation results as human-readable string
   */
  formatValidationResults(result: ValidationResult): string {
    let output = '';

    if (result.errors.length > 0) {
      output += 'ERRORS:\n';
      for (const error of result.errors) {
        output += `  - [${error.field}] ${error.message}`;
        if (error.invoiceNumber) {
          output += ` (Invoice: ${error.invoiceNumber})`;
        }
        if (error.row !== undefined) {
          output += ` (Row: ${error.row})`;
        }
        output += '\n';
      }
    }

    if (result.warnings.length > 0) {
      output += '\nWARNINGS:\n';
      for (const warning of result.warnings) {
        output += `  - [${warning.field}] ${warning.message}`;
        if (warning.invoiceNumber) {
          output += ` (Invoice: ${warning.invoiceNumber})`;
        }
        if (warning.row !== undefined) {
          output += ` (Row: ${warning.row})`;
        }
        output += '\n';
      }
    }

    if (result.isValid && result.warnings.length === 0) {
      output = 'All validations passed successfully.';
    }

    return output;
  }
}

export default InvoiceValidator;
