-- 1. Tạo bảng body_measurements như cũ
CREATE TABLE IF NOT EXISTS public.body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  note text,
  source text DEFAULT 'manual',
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  sync_status text DEFAULT 'pending',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Tạo bảng muscle_goals như cũ
CREATE TABLE IF NOT EXISTS public.muscle_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muscle_group_id uuid NOT NULL REFERENCES public.muscle_groups(id) ON DELETE CASCADE,
  metric_key text NOT NULL DEFAULT 'muscle_mass',
  current_value numeric,
  target_value numeric NOT NULL,
  unit text NOT NULL,
  target_date timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  sync_status text DEFAULT 'pending',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. Tạo các Index như cũ
CREATE INDEX IF NOT EXISTS idx_body_measurements_metric_key ON public.body_measurements(metric_key);
CREATE INDEX IF NOT EXISTS idx_body_measurements_measured_at ON public.body_measurements(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_muscle_goals_muscle_group_id ON public.muscle_goals(muscle_group_id);

--- ========================================== ---
--- BỔ SUNG CẤU HÌNH BẢO MẬT (RLS) TẠI ĐÂY ---

-- Bật tính năng RLS cho 2 bảng
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muscle_goals ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách cho bảng body_measurements: Chỉ cho phép user thao tác trên dữ liệu của chính họ
CREATE POLICY "Users can manage their own body measurements" 
ON public.body_measurements
FOR ALL -- Áp dụng cho cả SELECT, INSERT, UPDATE, DELETE
TO authenticated -- Chỉ những user đã đăng nhập thành công
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Tạo chính sách cho bảng muscle_goals: Chỉ cho phép user thao tác trên dữ liệu của chính họ
CREATE POLICY "Users can manage their own muscle goals" 
ON public.muscle_goals
FOR ALL 
TO authenticated 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);