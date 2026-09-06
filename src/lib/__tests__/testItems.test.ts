import { resolveItemByBarcode, TEST_ITEMS } from '../testItems';

describe('resolveItemByBarcode', () => {
  it('finds every item in the small test catalog by its own barcode', () => {
    for (const item of TEST_ITEMS) {
      expect(resolveItemByBarcode(item.barcode)).toEqual(item);
    }
  });

  it('returns undefined for a barcode outside the test catalog', () => {
    expect(resolveItemByBarcode('000000000000')).toBeUndefined();
  });
});
