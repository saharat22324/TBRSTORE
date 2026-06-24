-- อัพเดทราคาต้นทุนและราคาขาย stock items ใน Supabase
-- รัน script นี้ใน Supabase Dashboard → SQL Editor

UPDATE stock_items SET cost_price = 213, sell_price = 350 WHERE sku = 'S01'; -- 5W40 Diesel
UPDATE stock_items SET cost_price = 213, sell_price = 350 WHERE sku = 'S02'; -- 5W40 Benzine
UPDATE stock_items SET cost_price = 75,  sell_price = 390 WHERE sku = 'S04'; -- Coolant
UPDATE stock_items SET cost_price = 150, sell_price = 350 WHERE sku = 'S05'; -- ATF Dexron III
UPDATE stock_items SET cost_price = 150, sell_price = 350 WHERE sku = 'S06'; -- ATF Dexron VI
UPDATE stock_items SET cost_price = 100, sell_price = 250 WHERE sku = 'S07'; -- TBR Fuel Plus
UPDATE stock_items SET cost_price = 85,  sell_price = 590 WHERE sku = 'S08'; -- Premium F1 Flushing
UPDATE stock_items SET cost_price = 250, sell_price = 890 WHERE sku = 'S09'; -- Premium S1 Flushing
UPDATE stock_items SET cost_price = 153, sell_price = 800 WHERE sku = 'S10'; -- Gear Oil GL-5 90
UPDATE stock_items SET cost_price = 150, sell_price = 350 WHERE sku = 'S11'; -- ULV Gear Limited GLS
