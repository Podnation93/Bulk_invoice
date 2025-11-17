/**
 * Xero CSV Template Constants
 * These headers must match exactly - no additions, removals, or renaming
 */

export const XERO_CSV_HEADERS = [
  'ContactName',
  'InvoiceNumber',
  'InvoiceDate',
  'DueDate',
  'Description',
  'Quantity',
  'UnitAmount',
  'AccountCode',
  'TaxType',
  'Reference',
] as const;

export type XeroCSVHeader = (typeof XERO_CSV_HEADERS)[number];

export const REQUIRED_FIELDS: XeroCSVHeader[] = [
  'ContactName',
  'InvoiceNumber',
  'InvoiceDate',
  'DueDate',
];

export const OPTIONAL_FIELDS: XeroCSVHeader[] = [
  'Description',
  'Quantity',
  'UnitAmount',
  'AccountCode',
  'TaxType',
  'Reference',
];

// Australian date format
export const DATE_FORMAT = 'DD/MM/YYYY';

// Common Australian tax types in Xero
export const TAX_TYPES = {
  GST_FREE: 'GST Free Income',
  GST_ON_INCOME: 'GST on Income',
  BAS_EXCLUDED: 'BAS Excluded',
  GST_FREE_EXPORTS: 'GST Free Exports',
} as const;

// Default values
export const DEFAULTS = {
  QUANTITY: '1',
  ACCOUNT_CODE: '200', // Sales account code
  TAX_TYPE: TAX_TYPES.GST_ON_INCOME,
};
