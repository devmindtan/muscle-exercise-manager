import { getDB } from './db';

export async function clearLocalData(): Promise<void> {
  const db = await getDB();

  await db.execAsync(`
    BEGIN TRANSACTION;
    DELETE FROM workout_logs;
    DELETE FROM exercises;
    DELETE FROM muscle_groups;
    DELETE FROM app_meta;
    COMMIT;
  `);
}
