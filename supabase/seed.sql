-- Small set of test items for the phase-3 scan flow. Kept in sync by hand
-- with src/lib/testItems.ts — same barcodes, names, and prices.
insert into items (barcode, name, price_cents) values
  ('049000028911', 'Energy Drink', 500),
  ('012345678905', 'Iced Mocha', 450),
  ('041220576463', 'Granola Bar', 250),
  ('811620021952', 'Sparkling Water', 200)
on conflict (barcode) do nothing;
