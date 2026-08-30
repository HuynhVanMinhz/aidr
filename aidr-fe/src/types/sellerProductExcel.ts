/** What one spreadsheet row would do, as decided by the server before anything is written. */
export type SellerProductImportAction = 'Create' | 'Update' | 'Error';

export type SellerProductImportRow = {
  /** Row number in the sheet, so the seller can find it in Excel to fix it. */
  rowNumber: number;
  name?: string | null;
  slug?: string | null;
  action: SellerProductImportAction;
  productId?: string | null;
  categoryName?: string | null;
  basePrice?: number | null;
  errors: string[];
};

export type SellerProductImportPreview = {
  totalRows: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  /** Sheet-level notes, e.g. the same slug written on two rows. */
  warnings: string[];
  rows: SellerProductImportRow[];
};

export type SellerProductImportResult = {
  created: number;
  updated: number;
  failed: number;
  failedRows: SellerProductImportRow[];
};
