import { ExtractedInvoice, InvoiceLineItem } from '../../shared/types';

export interface ParsedField {
  value: string;
  confidence: number;
  source: string;
}

export class InvoiceParser {
  private warnings: string[] = [];

  /**
   * Parse extracted text to identify invoice fields
   */
  parseInvoiceText(text: string, sourceFile: string): ExtractedInvoice {
    this.warnings = [];

    const invoiceNumber = this.extractInvoiceNumber(text);
    const invoiceDate = this.extractInvoiceDate(text);
    const dueDate = this.extractDueDate(text);
    const contactName = this.extractContactName(text);
    const reference = this.extractReference(text);
    const lineItems = this.extractLineItems(text);

    // Calculate overall confidence based on extracted fields
    const confidence = this.calculateConfidence({
      invoiceNumber,
      invoiceDate,
      dueDate,
      contactName,
      lineItems,
    });

    return {
      invoiceNumber: invoiceNumber.value,
      invoiceDate: this.normalizeDate(invoiceDate.value),
      dueDate: this.normalizeDate(dueDate.value),
      contactName: contactName.value,
      reference: reference.value || undefined,
      lineItems,
      sourceFile,
      extractionConfidence: confidence,
      warnings: this.warnings,
    };
  }

  /**
   * Extract invoice number using various patterns
   */
  private extractInvoiceNumber(text: string): ParsedField {
    const patterns = [
      /Invoice\s*(?:Number|No\.?|#)\s*[:.]?\s*([A-Z0-9-]+)/i,
      /Invoice\s*[:.]?\s*([A-Z0-9-]+)/i,
      /INV[-\s]?([0-9]+)/i,
      /(?:^|\n)\s*#\s*([A-Z0-9-]+)/m,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return {
          value: match[1].trim(),
          confidence: 90,
          source: 'regex',
        };
      }
    }

    this.warnings.push('Could not extract invoice number');
    return { value: '', confidence: 0, source: 'not_found' };
  }

  /**
   * Extract invoice date
   */
  private extractInvoiceDate(text: string): ParsedField {
    const patterns = [
      /Invoice\s*Date\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /Date\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /Issued\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return {
          value: match[1].trim(),
          confidence: 85,
          source: 'regex',
        };
      }
    }

    this.warnings.push('Could not extract invoice date');
    return { value: '', confidence: 0, source: 'not_found' };
  }

  /**
   * Extract due date
   */
  private extractDueDate(text: string): ParsedField {
    const patterns = [
      /Due\s*Date\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /Payment\s*Due\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /Due\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return {
          value: match[1].trim(),
          confidence: 85,
          source: 'regex',
        };
      }
    }

    this.warnings.push('Could not extract due date');
    return { value: '', confidence: 0, source: 'not_found' };
  }

  /**
   * Extract contact/customer name
   */
  private extractContactName(text: string): ParsedField {
    const patterns = [
      /(?:Bill\s*To|Invoice\s*To|Customer|Client)\s*[:.]?\s*\n?\s*([^\n]+)/i,
      /(?:To|Attention)\s*[:.]?\s*\n?\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Filter out common non-name text
        if (!this.isLikelyNotAName(name)) {
          return {
            value: name,
            confidence: 75,
            source: 'regex',
          };
        }
      }
    }

    this.warnings.push('Could not extract contact name');
    return { value: '', confidence: 0, source: 'not_found' };
  }

  /**
   * Extract reference number if present
   */
  private extractReference(text: string): ParsedField {
    const patterns = [
      /(?:Reference|Ref|PO)\s*(?:Number|No\.?|#)?\s*[:.]?\s*([A-Z0-9-]+)/i,
      /Your\s*Ref\s*[:.]?\s*([A-Z0-9-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return {
          value: match[1].trim(),
          confidence: 80,
          source: 'regex',
        };
      }
    }

    return { value: '', confidence: 0, source: 'not_found' };
  }

  /**
   * Extract line items from invoice
   */
  private extractLineItems(text: string): InvoiceLineItem[] {
    const lineItems: InvoiceLineItem[] = [];

    // Try to find line item patterns
    // Pattern: Description, Quantity, Unit Price
    const linePattern = /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+(?:\.\d{2})?)\s*$/gm;
    let match;

    while ((match = linePattern.exec(text)) !== null) {
      const description = match[1].trim();
      const quantity = parseFloat(match[2]);
      const unitAmount = parseFloat(match[3].replace(/,/g, ''));

      if (description && !isNaN(quantity) && !isNaN(unitAmount)) {
        lineItems.push({
          description,
          quantity,
          unitAmount,
        });
      }
    }

    // If no line items found, try alternative patterns
    if (lineItems.length === 0) {
      const altItems = this.extractLineItemsAlternative(text);
      lineItems.push(...altItems);
    }

    // If still no items, create a single line item from total
    if (lineItems.length === 0) {
      const totalAmount = this.extractTotalAmount(text);
      if (totalAmount > 0) {
        lineItems.push({
          description: 'Invoice Total',
          quantity: 1,
          unitAmount: totalAmount,
        });
        this.warnings.push('Could not extract individual line items, using total amount');
      } else {
        this.warnings.push('Could not extract line items or total amount');
      }
    }

    return lineItems;
  }

  /**
   * Alternative line item extraction method
   */
  private extractLineItemsAlternative(text: string): InvoiceLineItem[] {
    const items: InvoiceLineItem[] = [];

    // Look for table-like structures
    const lines = text.split('\n');
    let inItemSection = false;

    for (const line of lines) {
      // Detect start of items section
      if (/(?:Description|Item|Product|Service)/i.test(line)) {
        inItemSection = true;
        continue;
      }

      // Detect end of items section
      if (/(?:Subtotal|Total|Tax|GST)/i.test(line)) {
        inItemSection = false;
      }

      if (inItemSection) {
        // Try to parse line as item
        const itemMatch = line.match(/(.+?)\s+([\d.]+)\s+\$?([\d,.]+)/);
        if (itemMatch) {
          items.push({
            description: itemMatch[1].trim(),
            quantity: parseFloat(itemMatch[2]),
            unitAmount: parseFloat(itemMatch[3].replace(/,/g, '')),
          });
        }
      }
    }

    return items;
  }

  /**
   * Extract total amount as fallback
   */
  private extractTotalAmount(text: string): number {
    const patterns = [
      /Total\s*(?:Amount|Due)?\s*[:.]?\s*\$?([\d,]+(?:\.\d{2})?)/i,
      /Amount\s*Due\s*[:.]?\s*\$?([\d,]+(?:\.\d{2})?)/i,
      /Balance\s*Due\s*[:.]?\s*\$?([\d,]+(?:\.\d{2})?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }

    return 0;
  }

  /**
   * Normalize date to Australian format DD/MM/YYYY
   */
  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';

    // Remove any non-numeric separators and standardize
    const cleaned = dateStr.replace(/[.\-]/g, '/');
    const parts = cleaned.split('/');

    if (parts.length !== 3) {
      this.warnings.push(`Invalid date format: ${dateStr}`);
      return dateStr;
    }

    let day = parts[0];
    let month = parts[1];
    let year = parts[2];

    // Pad day and month with zeros
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
      const yearNum = parseInt(year);
      year = yearNum > 50 ? `19${year}` : `20${year}`;
    }

    return `${day}/${month}/${year}`;
  }

  /**
   * Check if extracted text is likely not a customer name
   */
  private isLikelyNotAName(text: string): boolean {
    const nonNamePatterns = [
      /^\d+$/,
      /^Invoice/i,
      /^Date/i,
      /^Total/i,
      /^Amount/i,
      /^ABN/i,
      /^GST/i,
    ];

    return nonNamePatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Calculate overall extraction confidence
   */
  private calculateConfidence(fields: {
    invoiceNumber: ParsedField;
    invoiceDate: ParsedField;
    dueDate: ParsedField;
    contactName: ParsedField;
    lineItems: InvoiceLineItem[];
  }): number {
    const weights = {
      invoiceNumber: 0.25,
      invoiceDate: 0.2,
      dueDate: 0.15,
      contactName: 0.25,
      lineItems: 0.15,
    };

    let confidence =
      fields.invoiceNumber.confidence * weights.invoiceNumber +
      fields.invoiceDate.confidence * weights.invoiceDate +
      fields.dueDate.confidence * weights.dueDate +
      fields.contactName.confidence * weights.contactName +
      (fields.lineItems.length > 0 ? 90 : 0) * weights.lineItems;

    return Math.round(confidence);
  }

  /**
   * Get warnings from last parse operation
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }
}

export default InvoiceParser;
