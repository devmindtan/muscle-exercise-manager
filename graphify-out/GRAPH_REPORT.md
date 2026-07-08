# Graph Report - muscle-exercise-manager  (2026-07-08)

## Corpus Check
- 92 files · ~95,086 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 808 nodes · 1781 edges · 37 communities (34 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2bb04419`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_TDEECalculatorScreen.tsx|TDEECalculatorScreen.tsx]]
- [[_COMMUNITY_planExportImportService.ts|planExportImportService.ts]]
- [[_COMMUNITY_imageUpload.ts|imageUpload.ts]]
- [[_COMMUNITY_ExerciseDetailScreen.tsx|ExerciseDetailScreen.tsx]]
- [[_COMMUNITY_MusclesScreen.tsx|MusclesScreen.tsx]]

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 101 edges
2. `getWebUserIdOrThrow()` - 53 edges
3. `Colors` - 41 edges
4. `useAuth()` - 17 edges
5. `getMuscleGroups()` - 17 edges
6. `MuscleDetailScreen()` - 16 edges
7. `WeeklyPlanScreen()` - 16 edges
8. `Json` - 16 edges
9. `NutritionDayView()` - 15 edges
10. `generateUUID()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `TabLayout()` --calls--> `useAuth()`  [EXTRACTED]
  app/(tabs)/_layout.tsx → src/context/AuthContext.tsx
- `SegmentalTabProps` --references--> `BodyMeasurement`  [EXTRACTED]
  src/components/body-metrics-tabs/SegmentalTab.tsx → src/types/database.ts
- `SegmentalBodyProps` --references--> `BodyMeasurement`  [EXTRACTED]
  src/components/BodyMetricsSegmental.tsx → src/types/database.ts
- `InBodyRecord` --references--> `BodyMeasurement`  [EXTRACTED]
  src/components/body-metrics-tabs/HistoryTab.tsx → src/types/database.ts
- `OverviewTabProps` --references--> `BodyMeasurement`  [EXTRACTED]
  src/components/body-metrics-tabs/OverviewTab.tsx → src/types/database.ts

## Import Cycles
- None detected.

## Communities (37 total, 3 thin omitted)

### Community 0 - "Community & Social Feature"
Cohesion: 0.05
Nodes (77): styles, TabLayout(), RectTabBar(), RectTabBarItem, RectTabBarProps, styles, Props, SegmentedSubTabs() (+69 more)

### Community 1 - "Weekly Plan Feature"
Cohesion: 0.08
Nodes (63): ExercisePickerSheet(), ExercisePickerSheetProps, groupExercisesByParent(), styles, CATEGORIES, EntryUpsertPayload, MuscleGroupWithCount, PlanEditorRequest (+55 more)

### Community 2 - "Dashboard & Overview Tabs"
Cohesion: 0.06
Nodes (43): SlidingTabItem, SlidingTabs(), SlidingTabsProps, styles, { width: SCREEN_WIDTH }, calcTrend(), dc, DetailCard() (+35 more)

### Community 3 - "LocalDB CRUD Functions (A)"
Cohesion: 0.03
Nodes (61): clearAllLocalData(), deleteNutrientConfig(), deleteNutrientConfigDuplicates(), deleteNutritionGoalByKey(), getActiveWorkoutPlan(), getBodyMeasurements(), getDatabase(), getDirtyBodyMeasurements() (+53 more)

### Community 4 - "LocalDB CRUD Functions & Types (B)"
Cohesion: 0.04
Nodes (54): deleteWeeklyPlanEntry(), FriendshipStatus, getActiveExercises(), getBodyMeasurementById(), getDirtyMuscleGoals(), getDirtyWorkoutLogs(), getExercisesWithStats(), getMyProfile() (+46 more)

### Community 5 - "Nutrition Tracking & TDEE Calculator"
Cohesion: 0.11
Nodes (23): barStyles, DAY_LABELS, fmtNum(), formatDateLabel(), FULL_DAY_NAMES, gaugeStyles, getWeekDates(), MEAL_LABELS (+15 more)

### Community 6 - "Auth, Sync & App Shell"
Cohesion: 0.10
Nodes (24): AuthContext, AuthContextType, AuthProvider(), AuthUser, ensureGoogleSigninLoaded(), GoogleSigninLike, GoogleSigninModuleLike, googleStatusCodes (+16 more)

### Community 7 - "Exercise/Muscle Detail & Image Upload"
Cohesion: 0.16
Nodes (17): ExerciseWithStats, createExercise(), deleteMuscleGroup(), getExercisesWithStats(), getMuscleGroup(), getMuscleGroupById(), getSetCounts(), insertExercise() (+9 more)

### Community 8 - "Package Dependencies"
Cohesion: 0.04
Nodes (45): dependencies, expo, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-dev-client, expo-document-picker (+37 more)

### Community 9 - "Cardio Logging & Chart"
Cohesion: 0.10
Nodes (30): calcTrend(), CardioGrowthChartProps, CardioHistoryPoint, CardioHistoryTabSection(), CardioSvgChart(), dc, DetailCard(), DetailCardProps (+22 more)

### Community 10 - "Strength Logging & Repository Core"
Cohesion: 0.10
Nodes (26): formatTime(), StrengthTab(), styles, BodyMeasurementInput, BodyMeasurementUpdateInput, createWorkoutLog(), DEFAULT_NUTRIENT_CONFIGS, DEFAULT_TDEE_SETTINGS (+18 more)

### Community 11 - "Body Segmental Visualization"
Cohesion: 0.11
Nodes (24): BODY_ANCHORS, BodyFigureSvg(), BodyZone, detailStyles, FAT_ZONE_KEYS, fmt(), fmtDelta(), getDeltaArrow() (+16 more)

### Community 12 - "Body Metrics Screen"
Cohesion: 0.12
Nodes (27): createBodyMeasurement(), createMuscleGoal(), deleteInBodyRecord(), deleteMuscleGoal(), getBodyMeasurements(), getMuscleGoals(), getWebUserIdOrThrow(), updateBodyMeasurement() (+19 more)

### Community 13 - "Food Logging & Food Library"
Cohesion: 0.23
Nodes (11): AddFoodLogModal(), calcNutrients(), computeAutoCalories(), ExtraRow, MACRO_KEYS, MEAL_OPTIONS, MealType, Props (+3 more)

### Community 14 - "InBody Segmental Form Input"
Cohesion: 0.14
Nodes (16): FAT_KEYS, FormMode, fs, GOAL_KEYS, inferModeFromMetric(), inferZoneFromMetric(), LEAN_KEYS, Props (+8 more)

### Community 15 - "Nutrient Config & Goals"
Cohesion: 0.23
Nodes (15): AddNutrientForm, GoalEditState, NutrientConfigScreen(), Props, slugify(), styles, createNutrientConfig(), deleteNutrientConfig() (+7 more)

### Community 16 - "Repository - Create/Insert Functions"
Cohesion: 0.24
Nodes (11): BLANK_FORM, computeAutoCalories(), ExtraRow, FoodForm, FoodLibraryScreen(), Props, styles, createNutritionFood() (+3 more)

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

### Community 32 - "TDEECalculatorScreen.tsx"
Cohesion: 0.11
Nodes (19): BMR_METHOD_LABELS, BmrMethod, breakdownStyles, calcBmrKatch(), calcComponent(), calcTdee(), formatDate(), GOAL_LABELS (+11 more)

### Community 33 - "planExportImportService.ts"
Cohesion: 0.22
Nodes (13): getExercises(), getMuscleGroups(), LogMode, LogScreen(), styles, exportMuscleGroupsAndExercises(), exportWorkoutPlan(), groupExercisesByParent() (+5 more)

### Community 34 - "imageUpload.ts"
Cohesion: 0.32
Nodes (11): deleteImageFromStorage(), deleteImage(), encodeObjectKey(), getImageUrl(), ImageUploadProgress, ImageUploadResult, makeImageKey(), normalizeEndpoint() (+3 more)

### Community 35 - "ExerciseDetailScreen.tsx"
Cohesion: 0.27
Nodes (9): deleteExercise(), setExerciseActive(), softDeleteExercise(), updateExercise(), uploadExerciseImage(), confirmAction(), ExerciseDetailScreen(), formatDate() (+1 more)

### Community 36 - "MusclesScreen.tsx"
Cohesion: 0.25
Nodes (8): persistImageLocally(), createMuscleGroup(), insertMuscleGroup(), WeekStat, getWeekRange(), MUSCLE_CATEGORIES, MusclesScreen(), styles

## Knowledge Gaps
- **265 isolated node(s):** `styles`, `{ defineConfig }`, `expoConfig`, `{ getDefaultConfig }`, `config` (+260 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Colors` connect `Community & Social Feature` to `Weekly Plan Feature`, `Dashboard & Overview Tabs`, `Nutrition Tracking & TDEE Calculator`, `Auth, Sync & App Shell`, `Exercise/Muscle Detail & Image Upload`, `Cardio Logging & Chart`, `Strength Logging & Repository Core`, `Body Segmental Visualization`, `Body Metrics Screen`, `Food Logging & Food Library`, `InBody Segmental Form Input`, `Nutrient Config & Goals`, `Repository - Create/Insert Functions`, `Body Metrics Tabs (History/Overview)`, `Body Metrics - Goals Tab`, `TDEECalculatorScreen.tsx`, `planExportImportService.ts`, `ExerciseDetailScreen.tsx`, `MusclesScreen.tsx`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `getMuscleGroups()` connect `planExportImportService.ts` to `Community & Social Feature`, `Weekly Plan Feature`, `ExerciseDetailScreen.tsx`, `Exercise/Muscle Detail & Image Upload`, `Strength Logging & Repository Core`, `Body Metrics Screen`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `getDatabase()` connect `LocalDB CRUD Functions (A)` to `LocalDB CRUD Functions & Types (B)`, `LocalDB Schema Migration`, `Auth, Sync & App Shell`, `LocalDB Mark-Deleted Reconciliation`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `styles`, `{ defineConfig }`, `expoConfig` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community & Social Feature` be split into smaller, more focused modules?**
  _Cohesion score 0.05216197666437886 - nodes in this community are weakly interconnected._
- **Should `Weekly Plan Feature` be split into smaller, more focused modules?**
  _Cohesion score 0.0782608695652174 - nodes in this community are weakly interconnected._
- **Should `Dashboard & Overview Tabs` be split into smaller, more focused modules?**
  _Cohesion score 0.05656565656565657 - nodes in this community are weakly interconnected._