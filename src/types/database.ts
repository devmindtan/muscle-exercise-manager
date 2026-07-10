export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      muscle_groups: {
        Row: MuscleGroup;
        Insert: {
          id?: string;
          name: string;
          color?: string;
          target_sets_per_week?: number;
          target_sets_per_month?: number;
          target_impact_sets_per_week?: number | null;
          target_impact_sets_per_month?: number | null;
          image_uri?: string | null;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          name?: string;
          color?: string;
          target_sets_per_week?: number;
          target_sets_per_month?: number;
          target_impact_sets_per_week?: number | null;
          target_impact_sets_per_month?: number | null;
          image_uri?: string | null;
          category?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Relationships: [];
      };
      exercises: {
        Row: Exercise;
        Insert: {
          id?: string;
          muscle_group_id: string;
          name: string;
          notes?: string | null;
          image_uri?: string | null;
          is_active?: boolean;
          parent_exercise_id?: string | null;
          exercise_type?: 'compound' | 'isolation' | null;
          rest_seconds?: number | null;
          prep_seconds?: number | null;
          is_injury_prone?: boolean | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          name?: string;
          notes?: string | null;
          image_uri?: string | null;
          is_active?: boolean;
          parent_exercise_id?: string | null;
          exercise_type?: 'compound' | 'isolation' | null;
          rest_seconds?: number | null;
          prep_seconds?: number | null;
          is_injury_prone?: boolean | null;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_muscle_group_id_fkey';
            columns: ['muscle_group_id'];
            isOneToOne: false;
            referencedRelation: 'muscle_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_secondary_muscles: {
        Row: ExerciseSecondaryMuscle;
        Insert: {
          id?: string;
          exercise_id: string;
          muscle_group_id: string;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          exercise_id?: string;
          muscle_group_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_secondary_muscles_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_secondary_muscles_muscle_group_id_fkey';
            columns: ['muscle_group_id'];
            isOneToOne: false;
            referencedRelation: 'muscle_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_logs: {
        Row: WorkoutLog;
        Insert: {
          id?: string;
          exercise_id: string;
          muscle_group_id: string;
          sets?: number;
          reps?: number | null;
          weight?: number | null;
          note?: string | null;
          logged_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          sets?: number;
          reps?: number | null;
          weight?: number | null;
          note?: string | null;
          logged_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Relationships: [
          {
            foreignKeyName: 'workout_logs_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_logs_muscle_group_id_fkey';
            columns: ['muscle_group_id'];
            isOneToOne: false;
            referencedRelation: 'muscle_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      body_measurements: {
        Row: BodyMeasurementJsonbRow;
        Insert: {
          id?: string;
          measured_at?: string;
          note?: string | null;
          metrics_json?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          measured_at?: string;
          note?: string | null;
          metrics_json?: Json;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Relationships: [];
      };
      muscle_goals: {
        Row: MuscleGoal;
        Insert: {
          id?: string;
          muscle_group_id: string;
          metric_key?: string;
          current_value?: number | null;
          target_value: number;
          unit: string;
          target_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          metric_key?: string;
          current_value?: number | null;
          target_value?: number;
          unit?: string;
          target_date?: string | null;
          note?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Relationships: [
          {
            foreignKeyName: 'muscle_goals_muscle_group_id_fkey';
            columns: ['muscle_group_id'];
            isOneToOne: false;
            referencedRelation: 'muscle_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      weekly_plan_entries: {
        Row: WeeklyPlanEntry;
        Insert: {
          id?: string;
          day_key: string;
          muscle_group_id: string;
          exercise_id?: string | null;
          sets: number;
          reps?: number | null;
          sort_order?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          day_key?: string;
          muscle_group_id?: string;
          exercise_id?: string | null;
          sets?: number;
          reps?: number | null;
          sort_order?: number | null;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'weekly_plan_entries_muscle_group_id_fkey';
            columns: ['muscle_group_id'];
            isOneToOne: false;
            referencedRelation: 'muscle_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      cardio_logs: {
        Row: CardioLog;
        Insert: {
          id?: string;
          name: string;
          duration_minutes: number;
          note?: string | null;
          logged_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          name?: string;
          duration_minutes?: number;
          note?: string | null;
          logged_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Relationships: [];
      };
      workout_plans: {
        Row: WorkoutPlan;
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_private?: boolean;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: Friendship;
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Update: {
          status?: 'pending' | 'accepted' | 'declined';
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      plan_shares: {
        Row: PlanShare;
        Insert: {
          id?: string;
          plan_id: string;
          owner_id: string;
          share_code: string;
          visibility?: 'link' | 'friends';
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
        };
        Update: {
          visibility?: 'link' | 'friends';
          is_public?: boolean;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_shares_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'workout_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      nutrition_nutrient_configs: {
        Row: NutrientConfig;
        Insert: {
          id?: string;
          key: string;
          label: string;
          unit?: string;
          is_enabled?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          label?: string;
          unit?: string;
          is_enabled?: boolean;
          display_order?: number;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      nutrition_foods: {
        Row: NutritionFood;
        Insert: {
          id?: string;
          name: string;
          brand?: string | null;
          serving_size?: number;
          serving_unit?: string;
          nutrients_json?: Record<string, number>;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          name?: string;
          brand?: string | null;
          serving_size?: number;
          serving_unit?: string;
          nutrients_json?: Record<string, number>;
          note?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      nutrition_logs: {
        Row: NutritionLog;
        Insert: {
          id?: string;
          food_id?: string | null;
          food_name: string;
          quantity?: number;
          nutrients_json?: Record<string, number>;
          meal_type?: 'morning' | 'noon' | 'evening' | 'snack';
          note?: string | null;
          logged_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          food_name?: string;
          quantity?: number;
          nutrients_json?: Record<string, number>;
          meal_type?: 'morning' | 'noon' | 'evening' | 'snack';
          note?: string | null;
          logged_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'nutrition_logs_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'nutrition_foods';
            referencedColumns: ['id'];
          },
        ];
      };
      nutrition_goals: {
        Row: NutritionGoal;
        Insert: {
          id?: string;
          nutrient_key: string;
          target_value: number;
          unit?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          sync_status?: 'pending' | 'synced' | 'failed';
          user_id?: string | null;
        };
        Update: {
          target_value?: number;
          unit?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      nutrition_tdee_settings: {
        Row: TdeeSettings;
        Insert: {
          id?: string;
          bmr_method?: 'katch_mccardl' | 'mifflin' | 'custom';
          custom_bmr?: number | null;
          bmr_pct?: number;
          neat_pct?: number;
          tef_pct?: number;
          eat_pct?: number;
          protein_multiplier?: number;
          goal_type?: 'cut' | 'maintain' | 'bulk';
          created_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          bmr_method?: 'katch_mccardl' | 'mifflin' | 'custom';
          custom_bmr?: number | null;
          bmr_pct?: number;
          neat_pct?: number;
          tef_pct?: number;
          eat_pct?: number;
          protein_multiplier?: number;
          goal_type?: 'cut' | 'maintain' | 'bulk';
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type MuscleGroup = {
  id: string;
  name: string;
  color: string;
  target_sets_per_week: number;
  target_sets_per_month: number;
  target_impact_sets_per_week: number | null;
  target_impact_sets_per_month: number | null;
  image_uri: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type Exercise = {
  id: string;
  muscle_group_id: string;
  name: string;
  notes: string | null;
  image_uri: string | null;
  is_active: boolean;
  parent_exercise_id: string | null;
  exercise_type: 'compound' | 'isolation' | null;
  rest_seconds: number | null;
  prep_seconds: number | null;
  is_injury_prone: boolean | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

// Nhóm cơ phụ mà 1 bài Compound tác động tới, ngoài nhóm cơ chính
// (exercises.muscle_group_id). Bảng junction đơn giản, ghi đè toàn bộ mỗi
// khi lưu (xem setExerciseSecondaryMuscles trong repository.ts).
export type ExerciseSecondaryMuscle = {
  id: string;
  exercise_id: string;
  muscle_group_id: string;
  created_at: string;
  user_id: string | null;
};

export type WorkoutLog = {
  id: string;
  exercise_id: string;
  muscle_group_id: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  note: string | null;
  logged_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type MuscleGroupWithStats = MuscleGroup & {
  exercises: Exercise[];
  weekly_sets: number;
  monthly_sets: number;
};

// Raw Supabase row for body_measurements: after the JSONB migration
// (supabase/migrations/20260524133000_simplify_body_measurements_jsonb_schema.sql)
// metric_key/value/unit/record_type/source no longer exist as columns —
// everything lives in metrics_json, one row per measured_at.
export type BodyMeasurementJsonbRow = {
  id: string;
  measured_at: string;
  note: string | null;
  metrics_json: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

// App-facing shape: one row per metric, flattened from metrics_json on the
// web path (see flattenWebBodyMeasurementRows) and stored this way natively
// in local SQLite (see LocalBodyMeasurement in src/db/localDB.ts).
export type BodyMeasurement = {
  id: string;
  metric_key: string;
  value: number;
  unit: string;
  record_type: string;
  metrics_json: Json | null;
  note: string | null;
  source: string | null;
  measured_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type MuscleGoal = {
  id: string;
  muscle_group_id: string;
  metric_key: string;
  current_value: number | null;
  target_value: number;
  unit: string;
  target_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type WeeklyPlanEntry = {
  id: string;
  day_key: string;
  muscle_group_id: string;
  exercise_id: string | null;
  sets: number;
  reps: number | null;
  sort_order: number | null;
  note: string | null;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type CardioLog = {
  id: string;
  name: string;
  duration_minutes: number;
  note: string | null;
  logged_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type NutrientConfig = {
  id: string;
  key: string;
  label: string;
  unit: string;
  is_enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type NutritionFood = {
  id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: string;
  nutrients_json: Record<string, number>;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type NutritionLog = {
  id: string;
  food_id: string | null;
  food_name: string;
  quantity: number;
  nutrients_json: Record<string, number>;
  meal_type: 'morning' | 'noon' | 'evening' | 'snack';
  note: string | null;
  logged_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type NutritionGoal = {
  id: string;
  nutrient_key: string;
  target_value: number;
  unit: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type WorkoutPlan = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  user_id: string | null;
};

// Note: friendships has no user_id column — ownership is expressed via
// requester_id/addressee_id instead (see migration 20260704000002).
export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
};

// Note: plan_shares has no user_id column — ownership is expressed via
// owner_id instead (see migration 20260704000002 / 20260706100000).
export type PlanShare = {
  id: string;
  plan_id: string;
  owner_id: string;
  share_code: string;
  visibility: 'link' | 'friends';
  is_public: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
};

export type TdeeSettings = {
  id: string;
  bmr_method: 'katch_mccardl' | 'mifflin' | 'custom';
  custom_bmr: number | null;
  bmr_pct: number;
  neat_pct: number;
  tef_pct: number;
  eat_pct: number;
  protein_multiplier: number;
  goal_type: 'cut' | 'maintain' | 'bulk';
  created_at: string;
  updated_at: string;
  user_id: string | null;
};
