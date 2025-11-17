/**
 * Field help documentation for Xero CSV template fields
 * Provides tooltips, examples, and validation hints for users
 */

export interface FieldHelp {
  name: string;
  description: string;
  required: boolean;
  format: string;
  example: string;
  commonMistakes: string[];
  xeroDocLink?: string;
}

export const FIELD_HELP: Record<string, FieldHelp> = {
  ContactName: {
    name: 'Contact Name',
    description:
      'The name of the customer or supplier. Must match an existing contact in Xero or a new one will be created.',
    required: true,
    format: 'Text (max 255 characters)',
    example: 'ABC Company Pty Ltd',
    commonMistakes: [
      'Misspelling the company name',
      'Using abbreviations that do not match Xero contacts',
      'Including extra spaces or special characters',
    ],
    xeroDocLink: 'https://central.xero.com/s/article/Import-sales-invoices',
  },
  InvoiceNumber: {
    name: 'Invoice Number',
    description:
      'Unique identifier for the invoice. Must be unique within your Xero organization.',
    required: true,
    format: 'Text (alphanumeric, max 255 characters)',
    example: 'INV-2024-001',
    commonMistakes: [
      'Duplicate invoice numbers',
      'Using special characters that Xero does not accept',
      'Inconsistent numbering format',
    ],
    xeroDocLink: 'https://central.xero.com/s/article/Import-sales-invoices',
  },
  InvoiceDate: {
    name: 'Invoice Date',
    description:
      'The date the invoice was issued. Must be in Australian date format.',
    required: true,
    format: 'DD/MM/YYYY (Australian format)',
    example: '15/03/2024',
    commonMistakes: [
      'Using MM/DD/YYYY (American format)',
      'Missing leading zeros (1/3/2024 instead of 01/03/2024)',
      'Using wrong separators (15-03-2024)',
    ],
  },
  DueDate: {
    name: 'Due Date',
    description:
      'The date payment is due. Must be on or after the invoice date.',
    required: true,
    format: 'DD/MM/YYYY (Australian format)',
    example: '15/04/2024',
    commonMistakes: [
      'Setting due date before invoice date',
      'Using wrong date format',
      'Not accounting for payment terms correctly',
    ],
  },
  Description: {
    name: 'Description',
    description:
      'Description of the goods or services provided. Appears on the invoice line item.',
    required: false,
    format: 'Text (max 4000 characters)',
    example: 'Professional consulting services - March 2024',
    commonMistakes: [
      'Too vague descriptions',
      'Including special characters that may not render correctly',
      'Overly long descriptions',
    ],
  },
  Quantity: {
    name: 'Quantity',
    description:
      'The number of units for this line item. Can be a decimal for partial quantities.',
    required: true,
    format: 'Number (positive, up to 4 decimal places)',
    example: '1.00',
    commonMistakes: [
      'Using negative numbers',
      'Leaving blank instead of 0 or 1',
      'Using commas as decimal separators (1,5 instead of 1.5)',
    ],
  },
  UnitAmount: {
    name: 'Unit Amount',
    description:
      'The price per unit before tax. Must be a positive number with up to 2 decimal places.',
    required: true,
    format: 'Currency (AUD, 2 decimal places)',
    example: '150.00',
    commonMistakes: [
      'Including currency symbols ($150.00)',
      'Using commas as thousand separators (1,500.00)',
      'Entering total amount instead of unit price',
    ],
  },
  AccountCode: {
    name: 'Account Code',
    description:
      'The chart of accounts code for this line item. Must match an existing account in Xero.',
    required: false,
    format: 'Number (Xero account code)',
    example: '200',
    commonMistakes: [
      'Using account codes that do not exist in Xero',
      'Confusing revenue accounts with expense accounts',
      'Not setting up the account code in Xero first',
    ],
  },
  TaxType: {
    name: 'Tax Type',
    description:
      'The tax rate to apply to this line item. Must match a tax rate configured in Xero.',
    required: false,
    format: 'Text (Xero tax type name)',
    example: 'GST on Income',
    commonMistakes: [
      'Misspelling tax type name',
      'Using tax type that does not exist in Xero',
      'Not matching exact Xero tax type name (case-sensitive)',
    ],
  },
  Reference: {
    name: 'Reference',
    description:
      'Optional reference field for additional information. Often used for purchase order numbers.',
    required: false,
    format: 'Text (max 255 characters)',
    example: 'PO-2024-0123',
    commonMistakes: [
      'Confusing with invoice number',
      'Using for internal notes (use description instead)',
    ],
  },
};

/**
 * Get help for a specific field
 */
export function getFieldHelp(fieldName: string): FieldHelp | undefined {
  return FIELD_HELP[fieldName];
}

/**
 * Get all field names
 */
export function getAllFieldNames(): string[] {
  return Object.keys(FIELD_HELP);
}

/**
 * Format field help as tooltip text
 */
export function formatAsTooltip(fieldName: string): string {
  const help = FIELD_HELP[fieldName];
  if (!help) return '';

  let tooltip = `${help.name}\n`;
  tooltip += `${help.description}\n\n`;
  tooltip += `Format: ${help.format}\n`;
  tooltip += `Example: ${help.example}\n`;
  if (help.required) {
    tooltip += '\n⚠️ This field is required';
  }

  return tooltip;
}

/**
 * Get validation hints for a field
 */
export function getValidationHints(fieldName: string): string[] {
  const help = FIELD_HELP[fieldName];
  if (!help) return [];

  return help.commonMistakes;
}
