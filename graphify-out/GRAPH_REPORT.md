# Graph Report - .  (2026-07-07)

## Corpus Check
- 92 files · ~93,886 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 796 nodes · 1737 edges · 32 communities (29 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community & Social Feature|Community & Social Feature]]
- [[_COMMUNITY_Weekly Plan Feature|Weekly Plan Feature]]
- [[_COMMUNITY_Dashboard & Overview Tabs|Dashboard & Overview Tabs]]
- [[_COMMUNITY_LocalDB CRUD Functions (A)|LocalDB CRUD Functions (A)]]
- [[_COMMUNITY_LocalDB CRUD Functions & Types (B)|LocalDB CRUD Functions & Types (B)]]
- [[_COMMUNITY_Nutrition Tracking & TDEE Calculator|Nutrition Tracking & TDEE Calculator]]
- [[_COMMUNITY_Auth, Sync & App Shell|Auth, Sync & App Shell]]
- [[_COMMUNITY_ExerciseMuscle Detail & Image Upload|Exercise/Muscle Detail & Image Upload]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Cardio Logging & Chart|Cardio Logging & Chart]]
- [[_COMMUNITY_Strength Logging & Repository Core|Strength Logging & Repository Core]]
- [[_COMMUNITY_Body Segmental Visualization|Body Segmental Visualization]]
- [[_COMMUNITY_Body Metrics Screen|Body Metrics Screen]]
- [[_COMMUNITY_Food Logging & Food Library|Food Logging & Food Library]]
- [[_COMMUNITY_InBody Segmental Form Input|InBody Segmental Form Input]]
- [[_COMMUNITY_Nutrient Config & Goals|Nutrient Config & Goals]]
- [[_COMMUNITY_Repository - CreateInsert Functions|Repository - Create/Insert Functions]]
- [[_COMMUNITY_Database Type Definitions|Database Type Definitions]]
- [[_COMMUNITY_Body Metrics Tabs (HistoryOverview)|Body Metrics Tabs (History/Overview)]]
- [[_COMMUNITY_package.json Scripts|package.json Scripts]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_LocalDB Schema Migration|LocalDB Schema Migration]]
- [[_COMMUNITY_LocalDB Mark-Deleted Reconciliation|LocalDB Mark-Deleted Reconciliation]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Body Metrics - Goals Tab|Body Metrics - Goals Tab]]
- [[_COMMUNITY_Body Metrics - Segmental Tab|Body Metrics - Segmental Tab]]
- [[_COMMUNITY_package.json Metadata|package.json Metadata]]
- [[_COMMUNITY_404 Not Found Screen|404 Not Found Screen]]
- [[_COMMUNITY_Vercel Deploy Config|Vercel Deploy Config]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Metro Bundler Config|Metro Bundler Config]]

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 101 edges
2. `getWebUserIdOrThrow()` - 53 edges
3. `Colors` - 41 edges
4. `useAuth()` - 17 edges
5. `MuscleDetailScreen()` - 16 edges
6. `WeeklyPlanScreen()` - 16 edges
7. `NutritionDayView()` - 15 edges
8. `generateUUID()` - 15 edges
9. `BodyMetricsScreen()` - 15 edges
10. `getMuscleGroups()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `TabLayout()` --calls--> `useAuth()`  [EXTRACTED]
  app/(tabs)/_layout.tsx → src/context/AuthContext.tsx
- `SegmentalTabProps` --references--> `BodyMeasurement`  [EXTRACTED]
  src/components/body-metrics-tabs/SegmentalTab.tsx → src/types/database.ts
- `SegmentalBodyProps` --references--> `BodyMeasurement`  [EXTRACTED]
  src/components/BodyMetricsSegmental.tsx → src/types/database.ts
- `UserAccountModal()` --calls--> `getMyActivityCalendar()`  [EXTRACTED]
  src/components/UserAccountModal.tsx → src/services/socialService.ts
- `InBodyRecord` --references--> `BodyMeasurement`  [EXTRACTED]
  src/components/body-metrics-tabs/HistoryTab.tsx → src/types/database.ts

## Import Cycles
- None detected.

## Communities (32 total, 3 thin omitted)

### Community 0 - "Community & Social Feature"
Cohesion: 0.06
Nodes (64): RectTabBar(), RectTabBarItem, RectTabBarProps, styles, Props, SegmentedSubTabs(), styles, SubTabItem (+56 more)

### Community 1 - "Weekly Plan Feature"
Cohesion: 0.09
Nodes (60): ExercisePickerSheet(), ExercisePickerSheetProps, groupExercisesByParent(), styles, CATEGORIES, EntryUpsertPayload, MuscleGroupWithCount, PlanEditorRequest (+52 more)

### Community 2 - "Dashboard & Overview Tabs"
Cohesion: 0.05
Nodes (48): SlidingTabItem, SlidingTabs(), SlidingTabsProps, styles, { width: SCREEN_WIDTH }, calcTrend(), dc, DetailCard() (+40 more)

### Community 3 - "LocalDB CRUD Functions (A)"
Cohesion: 0.03
Nodes (61): clearAllLocalData(), deleteNutrientConfig(), deleteNutrientConfigDuplicates(), deleteNutritionGoalByKey(), getActiveWorkoutPlan(), getBodyMeasurements(), getDatabase(), getDirtyBodyMeasurements() (+53 more)

### Community 4 - "LocalDB CRUD Functions & Types (B)"
Cohesion: 0.04
Nodes (54): deleteWeeklyPlanEntry(), FriendshipStatus, getActiveExercises(), getBodyMeasurementById(), getDirtyMuscleGoals(), getDirtyWorkoutLogs(), getExercisesWithStats(), getMyProfile() (+46 more)

### Community 5 - "Nutrition Tracking & TDEE Calculator"
Cohesion: 0.06
Nodes (42): barStyles, DAY_LABELS, fmtNum(), formatDateLabel(), FULL_DAY_NAMES, gaugeStyles, getWeekDates(), MEAL_LABELS (+34 more)

### Community 6 - "Auth, Sync & App Shell"
Cohesion: 0.08
Nodes (34): styles, TabLayout(), styles, SyncStatusChip(), styles, UserAccountModal(), AuthContext, AuthContextType (+26 more)

### Community 7 - "Exercise/Muscle Detail & Image Upload"
Cohesion: 0.09
Nodes (39): ExerciseWithStats, persistImageLocally(), createExercise(), deleteExercise(), deleteImageFromStorage(), deleteMuscleGroup(), getExercisesWithStats(), getMuscleGroup() (+31 more)

### Community 8 - "Package Dependencies"
Cohesion: 0.05
Nodes (44): dependencies, expo, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-dev-client, expo-file-system (+36 more)

### Community 9 - "Cardio Logging & Chart"
Cohesion: 0.08
Nodes (32): calcTrend(), CardioGrowthChartProps, CardioHistoryPoint, CardioHistoryTabSection(), CardioSvgChart(), dc, DetailCard(), DetailCardProps (+24 more)

### Community 10 - "Strength Logging & Repository Core"
Cohesion: 0.11
Nodes (24): formatTime(), StrengthTab(), styles, BodyMeasurementInput, BodyMeasurementUpdateInput, DEFAULT_NUTRIENT_CONFIGS, DEFAULT_TDEE_SETTINGS, deleteWorkoutLog() (+16 more)

### Community 11 - "Body Segmental Visualization"
Cohesion: 0.11
Nodes (24): BODY_ANCHORS, BodyFigureSvg(), BodyZone, detailStyles, FAT_ZONE_KEYS, fmt(), fmtDelta(), getDeltaArrow() (+16 more)

### Community 12 - "Body Metrics Screen"
Cohesion: 0.12
Nodes (23): deleteInBodyRecord(), deleteMuscleGoal(), getMuscleGoals(), updateBodyMeasurement(), updateMuscleGoal(), BodyMetricsScreen(), confirmDestructive(), DECREASE_METRICS (+15 more)

### Community 13 - "Food Logging & Food Library"
Cohesion: 0.13
Nodes (19): AddFoodLogModal(), calcNutrients(), computeAutoCalories(), ExtraRow, MACRO_KEYS, MEAL_OPTIONS, MealType, Props (+11 more)

### Community 14 - "InBody Segmental Form Input"
Cohesion: 0.14
Nodes (16): FAT_KEYS, FormMode, fs, GOAL_KEYS, inferModeFromMetric(), inferZoneFromMetric(), LEAN_KEYS, Props (+8 more)

### Community 15 - "Nutrient Config & Goals"
Cohesion: 0.23
Nodes (15): AddNutrientForm, GoalEditState, NutrientConfigScreen(), Props, slugify(), styles, createNutrientConfig(), deleteNutrientConfig() (+7 more)

### Community 16 - "Repository - Create/Insert Functions"
Cohesion: 0.21
Nodes (16): createBodyMeasurement(), createMuscleGoal(), createMuscleGroup(), createNutritionFood(), createNutritionLog(), createWorkoutLog(), generateUUID(), getNutritionLogsForDate() (+8 more)

### Community 17 - "Database Type Definitions"
Cohesion: 0.14
Nodes (13): CardioLog, Friendship, MuscleGroupWithStats, NutrientConfig, NutritionFood, NutritionGoal, NutritionLog, PlanShare (+5 more)

### Community 18 - "Body Metrics Tabs (History/Overview)"
Cohesion: 0.18
Nodes (9): HistoryTab, HistoryTabProps, InBodyRecord, styles, OverviewTab, OverviewTabProps, styles, SegmentalBodyProps (+1 more)

### Community 19 - "package.json Scripts"
Cohesion: 0.25
Nodes (8): scripts, android, build:web, ios, lint, reset-project, start, web

### Community 20 - "Dev Dependencies"
Cohesion: 0.29
Nodes (7): devDependencies, @babel/core, eslint, eslint-config-expo, @types/react, @types/react-native-get-random-values, typescript

### Community 21 - "LocalDB Schema Migration"
Cohesion: 0.29
Nodes (7): applySchema(), createWorkoutPlan(), ensureColumn(), generateId(), insertCardioLog(), migrateDefaultWorkoutPlanBackfill(), migrateLegacySchema()

### Community 22 - "LocalDB Mark-Deleted Reconciliation"
Cohesion: 0.29
Nodes (7): markMissingBodyMeasurementsDeleted(), markMissingExercisesDeleted(), markMissingMuscleGoalsDeleted(), markMissingMuscleGroupsDeleted(), markMissingRowsDeleted(), markMissingWeeklyPlanEntriesDeleted(), markMissingWorkoutLogsDeleted()

### Community 23 - "TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, strict, extends, include, @/*

### Community 24 - "Body Metrics - Goals Tab"
Cohesion: 0.40
Nodes (4): GoalsTab, GoalsTabProps, styles, MuscleGoal

### Community 25 - "Body Metrics - Segmental Tab"
Cohesion: 0.33
Nodes (4): SegmentalTab, SegmentalTabProps, getZoneData(), SegmentalBody()

### Community 26 - "package.json Metadata"
Cohesion: 0.40
Nodes (4): main, name, private, version

### Community 28 - "Vercel Deploy Config"
Cohesion: 0.50
Nodes (3): buildCommand, outputDirectory, rewrites

## Knowledge Gaps
- **263 isolated node(s):** `styles`, `{ defineConfig }`, `expoConfig`, `{ getDefaultConfig }`, `config` (+258 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Colors` connect `Community & Social Feature` to `Weekly Plan Feature`, `Dashboard & Overview Tabs`, `Nutrition Tracking & TDEE Calculator`, `Auth, Sync & App Shell`, `Exercise/Muscle Detail & Image Upload`, `Cardio Logging & Chart`, `Strength Logging & Repository Core`, `Body Segmental Visualization`, `Body Metrics Screen`, `Food Logging & Food Library`, `InBody Segmental Form Input`, `Nutrient Config & Goals`, `Body Metrics Tabs (History/Overview)`, `Body Metrics - Goals Tab`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `getDatabase()` connect `LocalDB CRUD Functions (A)` to `LocalDB CRUD Functions & Types (B)`, `LocalDB Schema Migration`, `Auth, Sync & App Shell`, `LocalDB Mark-Deleted Reconciliation`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `getMuscleGroups()` connect `Strength Logging & Repository Core` to `Community & Social Feature`, `Weekly Plan Feature`, `Exercise/Muscle Detail & Image Upload`, `Body Metrics Screen`, `Repository - Create/Insert Functions`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `styles`, `{ defineConfig }`, `expoConfig` to the rest of the system?**
  _263 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community & Social Feature` be split into smaller, more focused modules?**
  _Cohesion score 0.06027306027306027 - nodes in this community are weakly interconnected._
- **Should `Weekly Plan Feature` be split into smaller, more focused modules?**
  _Cohesion score 0.08502939846223428 - nodes in this community are weakly interconnected._
- **Should `Dashboard & Overview Tabs` be split into smaller, more focused modules?**
  _Cohesion score 0.05076679005817028 - nodes in this community are weakly interconnected._