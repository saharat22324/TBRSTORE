-- Add cost_price column to invoice_items table
-- This stores the unit cost (ราคาทุน) at the time of sale so profit can be calculated correctly
-- Run this in Supabase SQL Editor

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoice_items.cost_price IS 'ราคาทุนต่อหน่วยขณะออกบิล (cost per unit at time of sale)';
