import { ExtractedInvoice } from '../../shared/types';

export interface AmountVerificationResult {
  invoiceNumber: string;
  calculatedTotal: number;
  expectedTotal: number | null;
  discrepancy: number;
  isValid: boolean;
  lineItemsCount: number;
  details: LineItemVerification[];
  suggestions: string[];
}

export interface LineItemVerification {
  index: number;
  description: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  hasIssues: boolean;
  issues: string[];
}

export interface BatchVerificationResult {
  totalInvoices: number;
  validInvoices: number;
  invalidInvoices: number;
  totalDiscrepancy: number;
  results: AmountVerificationResult[];
}

/**
 * Verifies invoice amounts and catches OCR errors in financial data
 */
export class AmountVerifier {
  private toleranceAmount: number;
  private gstRate: number;

  constructor(toleranceAmount: number = 0.10, gstRate: number = 0.10) {
    this.toleranceAmount = toleranceAmount;
    this.gstRate = gstRate; // 10% GST for Australia
  }

  /**
   * Verify a single invoice's amounts
   */
  verifyInvoice(invoice: ExtractedInvoice): AmountVerificationResult {
    const lineDetails: LineItemVerification[] = [];
    let calculatedTotal = 0;

    // Verify each line item
    for (let i = 0; i < invoice.lineItems.length; i++) {
      const item = invoice.lineItems[i];
      const verification = this.verifyLineItem(item, i);
      lineDetails.push(verification);

      if (!verification.hasIssues) {
        calculatedTotal += verification.lineTotal;
      } else {
        // Use best guess for total
        calculatedTotal += verification.lineTotal;
      }
    }

    // Round to 2 decimal places using fixed-point arithmetic
    calculatedTotal = Math.round(calculatedTotal * 100) / 100;

    // Try to extract expected total from invoice (if available in warnings/metadata)
    const expectedTotal = this.extractExpectedTotal(invoice);

    // Calculate discrepancy
    const discrepancy = expectedTotal !== null ? Math.abs(calculatedTotal - expectedTotal) : 0;

    // Determine if valid
    const isValid = expectedTotal === null || discrepancy <= this.toleranceAmount;

    // Generate suggestions
    const suggestions = this.generateSuggestions(
      invoice,
      lineDetails,
      calculatedTotal,
      expectedTotal,
      discrepancy
    );

    return {
      invoiceNumber: invoice.invoiceNumber,
      calculatedTotal,
      expectedTotal,
      discrepancy,
      isValid,
      lineItemsCount: invoice.lineItems.length,
      details: lineDetails,
      suggestions,
    };
  }

  /**
   * Verify a single line item
   */
  private verifyLineItem(
    item: { description: string; quantity: number; unitAmount: number },
    index: number
  ): LineItemVerification {
    const issues: string[] = [];
    let hasIssues = false;

    // Check for invalid quantity
    if (isNaN(item.quantity) || item.quantity <= 0) {
      issues.push(`Invalid quantity: ${item.quantity}`);
      hasIssues = true;
    }

    // Check for invalid unit amount
    if (isNaN(item.unitAmount)) {
      issues.push(`Invalid unit amount: ${item.unitAmount}`);
      hasIssues = true;
    }

    // Check for suspiciously high values (potential OCR errors)
    if (item.unitAmount > 1000000) {
      issues.push(`Suspiciously high unit amount: $${item.unitAmount.toFixed(2)} - possible OCR error`);
      hasIssues = true;
    }

    // Check for negative values
    if (item.unitAmount < 0) {
      issues.push(`Negative unit amount: $${item.unitAmount.toFixed(2)}`);
      hasIssues = true;
    }

    if (item.quantity < 0) {
      issues.push(`Negative quantity: ${item.quantity}`);
      hasIssues = true;
    }

    // Calculate line total using fixed-point arithmetic
    const quantityCents = Math.round(item.quantity * 100);
    const unitAmountCents = Math.round(item.unitAmount * 100);
    const lineTotalCents = (quantityCents * unitAmountCents) / 100;
    const lineTotal = Math.round(lineTotalCents) / 100;

    // Check for potential OCR misreads (e.g., 1 read as 7, 0 read as 8)
    const potentialOCRIssues = this.detectOCRMisreads(item.unitAmount, item.quantity);
    if (potentialOCRIssues.length > 0) {
      issues.push(...potentialOCRIssues);
      hasIssues = true;
    }

    return {
      index: index + 1, // 1-based for user display
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      lineTotal,
      hasIssues,
      issues,
    };
  }

  /**
   * Detect potential OCR misreads in numeric values
   */
  private detectOCRMisreads(unitAmount: number, quantity: number): string[] {
    const issues: string[] = [];

    // Common OCR misreads
    const commonMisreads: Array<[number, number, string]> = [
      [1, 7, '1 and 7'],
      [0, 8, '0 and 8'],
      [5, 6, '5 and 6'],
      [3, 8, '3 and 8'],
    ];

    // Check if unit amount looks like a common misread
    const amountStr = unitAmount.toFixed(2);

    // Check for suspicious patterns like $71.00 that might be $11.00
    if (amountStr.includes('7') && !amountStr.includes('1')) {
      // Could be 1 misread as 7
      const possibleCorrect = amountStr.replace(/7/g, '1');
      issues.push(
        `Unit amount $${amountStr} might be OCR error. Did you mean $${possibleCorrect}?`
      );
    }

    // Check for amounts with many zeros that might have missed digits
    if (/00\.00$/.test(amountStr) && unitAmount > 100) {
      issues.push(`Amount ends in .00 - verify decimal placement is correct`);
    }

    return issues;
  }

  /**
   * Try to extract expected total from invoice metadata
   */
  private extractExpectedTotal(invoice: ExtractedInvoice): number | null {
    // Look for total in warnings (may have been extracted but not mapped)
    for (const warning of invoice.warnings) {
      const totalMatch = warning.match(/total[:\s]+\$?([\d,]+\.?\d*)/i);
      if (totalMatch) {
        const total = parseFloat(totalMatch[1].replace(/,/g, ''));
        if (!isNaN(total)) {
          return total;
        }
      }
    }

    return null;
  }

  /**
   * Generate suggestions for fixing discrepancies
   */
  private generateSuggestions(
    invoice: ExtractedInvoice,
    lineDetails: LineItemVerification[],
    calculatedTotal: number,
    expectedTotal: number | null,
    discrepancy: number
  ): string[] {
    const suggestions: string[] = [];

    // Suggestions based on discrepancy
    if (expectedTotal !== null && discrepancy > this.toleranceAmount) {
      suggestions.push(
        `Total discrepancy of $${discrepancy.toFixed(2)} detected. Review line items for OCR errors.`
      );

      // Check if discrepancy matches GST amount
      const gstAmount = calculatedTotal * this.gstRate;
      if (Math.abs(discrepancy - gstAmount) < 0.10) {
        suggestions.push(
          `Discrepancy matches GST amount ($${gstAmount.toFixed(2)}). Check if GST is already included in unit amounts.`
        );
      }

      // Check if discrepancy is a single digit error
      if (discrepancy % 10 === 0 && discrepancy < 100) {
        suggestions.push(`Discrepancy is a multiple of $10 - possible single digit OCR error.`);
      }
    }

    // Suggestions based on line item issues
    const issueCount = lineDetails.filter((l) => l.hasIssues).length;
    if (issueCount > 0) {
      suggestions.push(
        `${issueCount} line item(s) have potential issues. Review highlighted items.`
      );
    }

    // Check for missing items
    if (invoice.lineItems.length === 0) {
      suggestions.push(`No line items found. Manual entry may be required.`);
    }

    // Check for low confidence
    if (invoice.extractionConfidence < 70) {
      suggestions.push(
        `Low extraction confidence (${invoice.extractionConfidence}%). Manual verification strongly recommended.`
      );
    }

    return suggestions;
  }

  /**
   * Verify multiple invoices
   */
  verifyBatch(invoices: ExtractedInvoice[]): BatchVerificationResult {
    const results: AmountVerificationResult[] = [];
    let totalDiscrepancy = 0;
    let validCount = 0;

    for (const invoice of invoices) {
      const result = this.verifyInvoice(invoice);
      results.push(result);

      if (result.isValid) {
        validCount++;
      }
      totalDiscrepancy += result.discrepancy;
    }

    return {
      totalInvoices: invoices.length,
      validInvoices: validCount,
      invalidInvoices: invoices.length - validCount,
      totalDiscrepancy: Math.round(totalDiscrepancy * 100) / 100,
      results,
    };
  }

  /**
   * Format verification result as readable text
   */
  formatResult(result: AmountVerificationResult): string {
    let output = `\n📊 Amount Verification: Invoice ${result.invoiceNumber}\n`;
    output += '─'.repeat(50) + '\n';

    output += `Calculated Total: $${result.calculatedTotal.toFixed(2)}\n`;
    if (result.expectedTotal !== null) {
      output += `Expected Total: $${result.expectedTotal.toFixed(2)}\n`;
      output += `Discrepancy: $${result.discrepancy.toFixed(2)}\n`;
    }
    output += `Status: ${result.isValid ? '✅ Valid' : '⚠️ Needs Review'}\n`;
    output += `Line Items: ${result.lineItemsCount}\n\n`;

    if (result.details.some((d) => d.hasIssues)) {
      output += 'Issues Found:\n';
      for (const detail of result.details) {
        if (detail.hasIssues) {
          output += `  Line ${detail.index}: ${detail.description.substring(0, 30)}...\n`;
          for (const issue of detail.issues) {
            output += `    ⚠️ ${issue}\n`;
          }
        }
      }
      output += '\n';
    }

    if (result.suggestions.length > 0) {
      output += 'Suggestions:\n';
      for (const suggestion of result.suggestions) {
        output += `  💡 ${suggestion}\n`;
      }
    }

    return output;
  }

  /**
   * Update tolerance amount
   */
  setTolerance(amount: number): void {
    this.toleranceAmount = amount;
  }

  /**
   * Update GST rate
   */
  setGSTRate(rate: number): void {
    this.gstRate = rate;
  }
}

export default AmountVerifier;
