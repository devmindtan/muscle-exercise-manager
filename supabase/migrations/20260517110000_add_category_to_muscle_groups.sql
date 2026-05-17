ALTER TABLE muscle_groups
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_muscle_groups_category
  ON muscle_groups(category);
