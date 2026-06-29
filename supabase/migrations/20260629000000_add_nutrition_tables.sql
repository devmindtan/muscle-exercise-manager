-- ============================================================
-- NUTRITION FEATURE — 4 new tables
-- Hoàn toàn độc lập, không ảnh hưởng các bảng hiện có.
-- ============================================================

-- ------------------------------------------------------------
-- 1. nutrition_nutrient_configs
--    Người dùng bật/tắt và sắp xếp thứ tự các chất cần theo dõi.
--    Mỗi user có riêng bộ config của mình.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_nutrient_configs (
  id           text        PRIMARY KEY,
  key          text        NOT NULL,              -- "protein" | "fat" | "carb" | "fiber" | "sugar" | "sodium" | ...
  label        text        NOT NULL,              -- tên hiển thị, e.g. "Đạm (Protein)"
  unit         text        NOT NULL DEFAULT 'g',  -- "g" | "mg" | "kcal" | "mcg"
  is_enabled   boolean     NOT NULL DEFAULT true,
  display_order integer    NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  sync_status  text                 DEFAULT 'pending',
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_nutrient_configs_user_id
  ON public.nutrition_nutrient_configs(user_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_nutrient_configs_updated_at
  ON public.nutrition_nutrient_configs(updated_at);

ALTER TABLE public.nutrition_nutrient_configs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_nutrition_nutrient_configs_updated_at ON public.nutrition_nutrient_configs;
CREATE TRIGGER trg_nutrition_nutrient_configs_updated_at
  BEFORE UPDATE ON public.nutrition_nutrient_configs
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own nutrient configs" ON public.nutrition_nutrient_configs;
CREATE POLICY "Users can manage their own nutrient configs"
  ON public.nutrition_nutrient_configs
  FOR ALL TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 2. nutrition_foods
--    Thư viện thực phẩm do người dùng tự tạo.
--    nutrients_json lưu giá trị dinh dưỡng trên 1 serving:
--    { "protein": 20.5, "fat": 5.2, "carb": 45.0, "fiber": 3 }
--    Không giới hạn bởi schema cứng — thêm chất mới không cần migrate.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_foods (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  brand         text,
  serving_size  numeric     NOT NULL DEFAULT 100,  -- e.g. 100
  serving_unit  text        NOT NULL DEFAULT 'g',  -- "g" | "ml" | "cái" | "muỗng"
  nutrients_json jsonb      NOT NULL DEFAULT '{}',
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  sync_status   text                 DEFAULT 'pending',
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_user_id
  ON public.nutrition_foods(user_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_updated_at
  ON public.nutrition_foods(updated_at);

ALTER TABLE public.nutrition_foods ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_nutrition_foods_updated_at ON public.nutrition_foods;
CREATE TRIGGER trg_nutrition_foods_updated_at
  BEFORE UPDATE ON public.nutrition_foods
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own foods" ON public.nutrition_foods;
CREATE POLICY "Users can manage their own foods"
  ON public.nutrition_foods
  FOR ALL TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 3. nutrition_logs
--    Log ăn uống hàng ngày.
--    nutrients_json = giá trị đã nhân với quantity (không tính lại ở client).
--    food_id nullable — cho phép log thực phẩm không có trong thư viện.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id             text        PRIMARY KEY,
  food_id        text        REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  food_name      text        NOT NULL,              -- denormalized để hiển thị nhanh
  quantity       numeric     NOT NULL DEFAULT 1,    -- số serving
  nutrients_json jsonb       NOT NULL DEFAULT '{}', -- giá trị đã tính = quantity × serving nutrients
  meal_type      text        NOT NULL DEFAULT 'snack', -- "morning" | "noon" | "evening" | "snack"
  note           text,
  logged_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  sync_status    text                 DEFAULT 'pending',
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_id
  ON public.nutrition_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_logged_at
  ON public.nutrition_logs(logged_at);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_updated_at
  ON public.nutrition_logs(updated_at);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_nutrition_logs_updated_at ON public.nutrition_logs;
CREATE TRIGGER trg_nutrition_logs_updated_at
  BEFORE UPDATE ON public.nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own nutrition logs" ON public.nutrition_logs;
CREATE POLICY "Users can manage their own nutrition logs"
  ON public.nutrition_logs
  FOR ALL TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 4. nutrition_goals
--    Mục tiêu hàng ngày cho từng chất dinh dưỡng.
--    Mỗi cặp (user_id, nutrient_key) là duy nhất.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_goals (
  id            text        PRIMARY KEY,
  nutrient_key  text        NOT NULL,  -- khớp với key trong nutrition_nutrient_configs
  target_value  numeric     NOT NULL,
  unit          text        NOT NULL DEFAULT 'g',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  sync_status   text                 DEFAULT 'pending',
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (user_id, nutrient_key)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_goals_user_id
  ON public.nutrition_goals(user_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_goals_updated_at
  ON public.nutrition_goals(updated_at);

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_nutrition_goals_updated_at ON public.nutrition_goals;
CREATE TRIGGER trg_nutrition_goals_updated_at
  BEFORE UPDATE ON public.nutrition_goals
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own nutrition goals" ON public.nutrition_goals;
CREATE POLICY "Users can manage their own nutrition goals"
  ON public.nutrition_goals
  FOR ALL TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 5. nutrition_tdee_settings
--    Cấu hình TDEE & protein của người dùng (1 row/user).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_tdee_settings (
  id                  text        PRIMARY KEY,
  bmr_method          text        NOT NULL DEFAULT 'katch_mccardl', -- 'katch_mccardl' | 'custom'
  custom_bmr          numeric,
  bmr_pct             numeric     NOT NULL DEFAULT 65,
  neat_pct            numeric     NOT NULL DEFAULT 15,
  tef_pct             numeric     NOT NULL DEFAULT 10,
  eat_pct             numeric     NOT NULL DEFAULT 10,
  protein_multiplier  numeric     NOT NULL DEFAULT 1.8,
  goal_type           text        NOT NULL DEFAULT 'maintain',  -- 'cut' | 'maintain' | 'bulk'
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  user_id             uuid        REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nutrition_tdee_settings_user_id
  ON public.nutrition_tdee_settings(user_id);

ALTER TABLE public.nutrition_tdee_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_nutrition_tdee_settings_updated_at ON public.nutrition_tdee_settings;
CREATE TRIGGER trg_nutrition_tdee_settings_updated_at
  BEFORE UPDATE ON public.nutrition_tdee_settings
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP POLICY IF EXISTS "Users can manage their own tdee settings" ON public.nutrition_tdee_settings;
CREATE POLICY "Users can manage their own tdee settings"
  ON public.nutrition_tdee_settings
  FOR ALL TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
