export enum DocumentType {
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  SALES_ORDER = 'SALES_ORDER',
  INVOICE = 'INVOICE',
  QUOTATION = 'QUOTATION',
  RECEIPT = 'RECEIPT',
}

/**
 * The short code that starts a document number, e.g. `PO-2026-000001`.
 *
 * Written out per type rather than derived from the name: taking the first
 * letter gave `P` and `S`, which is not what anybody writes on a purchase
 * order, and it collides as soon as two types share an initial
 * (PURCHASE_ORDER and QUOTATION would both be one letter away from clashing).
 */
export const DOCUMENT_TYPE_PREFIX: Record<DocumentType, string> = {
  [DocumentType.PURCHASE_ORDER]: 'PO',
  [DocumentType.SALES_ORDER]: 'SO',
  [DocumentType.INVOICE]: 'INV',
  [DocumentType.QUOTATION]: 'QT',
  [DocumentType.RECEIPT]: 'RC',
};