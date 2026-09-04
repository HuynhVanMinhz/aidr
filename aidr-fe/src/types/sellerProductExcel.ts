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

/**
 * One Inventory row. Stock always arrives as a new lot with a cost — the sheet
 * never sets a stock level outright — so the preview states what is being
 * received before the seller confirms it.
 */
export type SellerInventoryImportRow = {
  rowNumber: number;
  slug?: string | null;
  productName?: string | null;
  variantSku?: string | null;
  action: 'Receive' | 'Error';
  quantity?: number | null;
  unitCost?: number | null;
  errors: string[];
};

export type SellerProductImportPreview = {
  totalRows: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  stockRowCount: number;
  stockErrorCount: number;
  /** Total units the file would receive, so a stray zero stands out. */
  stockUnitCount: number;
  /** Sheet-level notes, e.g. the same slug written on two rows. */
  warnings: string[];
  rows: SellerProductImportRow[];
  stockRows: SellerInventoryImportRow[];
};

export type SellerProductImportResult = {
  created: number;
  updated: number;
  failed: number;
  stockLotsReceived: number;
  stockUnitsReceived: number;
  stockFailed: number;
  failedRows: SellerProductImportRow[];
  failedStockRows: SellerInventoryImportRow[];
};
