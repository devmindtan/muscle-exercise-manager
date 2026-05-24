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
          image_uri?: string | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          target_sets_per_week?: number;
          target_sets_per_month?: number;
          image_uri?: string | null;
          category?: string | null;
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
          created_at?: string;
        };
        Update: {
          name?: string;
          notes?: string | null;
          image_uri?: string | null;
          is_active?: boolean;
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
        };
        Update: {
          sets?: number;
          reps?: number | null;
          weight?: number | null;
          note?: string | null;
          logged_at?: string;
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
        Row: BodyMeasurement;
        Insert: {
          id?: string;
          metric_key: string;
          value: number;
          unit: string;
          record_type?: string;
          metrics_json?: Json | null;
          note?: string | null;
          source?: string | null;
          measured_at?: string;
          created_at?: string;
        };
        Update: {
          metric_key?: string;
          value?: number;
          unit?: string;
          record_type?: string;
          metrics_json?: Json | null;
          note?: string | null;
          source?: string | null;
          measured_at?: string;
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
        };
        Update: {
          metric_key?: string;
          current_value?: number | null;
          target_value?: number;
          unit?: string;
          target_date?: string | null;
          note?: string | null;
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
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
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
