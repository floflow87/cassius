import { pool } from "../db";
import { logger } from "../lib/logger";
import type { JobConfig } from "./index";

async function autoCompleteAppointments(): Promise<void> {
  const now = new Date();
  
  const result = await pool.query(`
    UPDATE appointments 
    SET status = 'COMPLETED'
    WHERE status = 'UPCOMING' 
    AND date_end < $1
    RETURNING id, patient_id, organisation_id, title
  `, [now]);
  
  if (result.rowCount && result.rowCount > 0) {
    logger.info(`[APPOINTMENT-AUTO-COMPLETE] Updated ${result.rowCount} appointments to COMPLETED`, {
      appointmentIds: result.rows.map(r => r.id),
    });
  }
}

export const appointmentAutoCompleteJob: JobConfig = {
  name: "appointment_auto_complete",
  intervalMs: 60 * 1000, // Run every minute
  handler: autoCompleteAppointments,
};
