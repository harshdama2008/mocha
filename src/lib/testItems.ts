// The "small set of test items" from CLAUDE.md's phase 3. Mirrors
// supabase/seed.sql so the on-device catalog and the database catalog
// never drift. Real barcodes (valid UPC-A/EAN-13 check digits) so the
// camera's barcode decoder has something real to lock onto, not props.
export interface TestItem {
  barcode: string;
  name: string;
  priceCents: number;
}

export const TEST_ITEMS: TestItem[] = [
  { barcode: '049000028911', name: 'Energy Drink', priceCents: 500 },
  { barcode: '012345678905', name: 'Iced Mocha', priceCents: 450 },
  { barcode: '041220576463', name: 'Granola Bar', priceCents: 250 },
  { barcode: '811620021952', name: 'Sparkling Water', priceCents: 200 },
];

export function resolveItemByBarcode(barcode: string): TestItem | undefined {
  return TEST_ITEMS.find((item) => item.barcode === barcode);
}
