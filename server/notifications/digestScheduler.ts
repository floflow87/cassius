import { db } from "../db";
import { notifications, notificationPreferences, digestRuns, users, surgeryImplants, implants, operations, patients } from "@shared/schema";
import { eq, and, gte, isNull, inArray, lt, desc, sql, lte } from "drizzle-orm";
import { sendEmail } from "../emails/send";
import type { NotificationDigestData } from "../emails/templates/notificationDigest";
import { notificationEvents } from "./notificationService";

interface DigestResult {
  userId: string;
  email: string;
  notificationCount: number;
  success: boolean;
  error?: string;
}

const CATEGORY_TO_KIND: Record<string, string[]> = {
  ALERTS_REMINDERS: ["ALERT", "REMINDER"],
  TEAM_ACTIVITY: ["ACTIVITY"],
  IMPORTS: ["IMPORT"],
  SYSTEM: ["SYSTEM"],
};

export async function runDailyDigest(): Promise<{ processed: number; results: DigestResult[] }> {
  console.log("[DIGEST] Running daily digest for users with digest preferences...");
  return runDigestForFrequency("daily");
}


async function runDigestForFrequency(
  digestType: "daily" | "weekly"
): Promise<{ processed: number; results: DigestResult[] }> {
  const results: DigestResult[] = [];
  const now = new Date();
  const periodLabel = digestType === "daily" ? "Quotidien" : "Hebdomadaire";
  const periodMs = digestType === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const cutoffTime = new Date(now.getTime() - periodMs);

  try {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const prefsWithDigest = await db
      .select({
        userId: notificationPreferences.userId,
        organisationId: notificationPreferences.organisationId,
        category: notificationPreferences.category,
        digestTime: notificationPreferences.digestTime,
      })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.frequency, "DIGEST"),
          eq(notificationPreferences.emailEnabled, true)
        )
      );

    const filteredPrefs = prefsWithDigest.filter((pref) => {
      const timeStr = pref.digestTime?.trim();
      if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
        console.log(`[DIGEST] Invalid digestTime "${pref.digestTime}" for user ${pref.userId}, defaulting to 08:00`);
        return currentHour === 8 && currentMinute === 0;
      }
      const [hourStr, minStr] = timeStr.split(":");
      const prefHour = parseInt(hourStr, 10);
      const prefMinute = parseInt(minStr, 10);
      return prefHour === currentHour && prefMinute === currentMinute;
    });

    if (filteredPrefs.length === 0) {
      // Only log at :00 to reduce noise
      if (currentMinute === 0) {
        console.log(`[DIGEST] No users with digest preferences for ${String(currentHour).padStart(2, '0')}:00`);
      }
      return { processed: 0, results: [] };
    }

    const userPrefsMap = new Map<string, Map<string, { category: string; digestTime: string | null; orgId: string }[]>>();
    
    for (const pref of filteredPrefs) {
      if (!userPrefsMap.has(pref.userId)) {
        userPrefsMap.set(pref.userId, new Map());
      }
      const userOrgs = userPrefsMap.get(pref.userId)!;
      if (!userOrgs.has(pref.organisationId)) {
        userOrgs.set(pref.organisationId, []);
      }
      userOrgs.get(pref.organisationId)!.push({
        category: pref.category,
        digestTime: pref.digestTime,
        orgId: pref.organisationId,
      });
    }

    const userIds = Array.from(userPrefsMap.keys());
    for (const userId of userIds) {
      const orgPrefsMap = userPrefsMap.get(userId)!;
      try {
        const [user] = await db
          .select({ email: users.username, firstName: users.prenom })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user?.email) {
          console.log(`[DIGEST] User ${userId} has no email, skipping`);
          continue;
        }

        const orgIds = Array.from(orgPrefsMap.keys());
        for (const orgId of orgIds) {
          const prefs = orgPrefsMap.get(orgId)!;
          const categoryKinds: string[] = [];
          const categories: string[] = [];
          
          for (const pref of prefs) {
            const kinds = CATEGORY_TO_KIND[pref.category];
            if (kinds) {
              categoryKinds.push(...kinds);
              categories.push(pref.category);
            }
          }

          if (categoryKinds.length === 0) continue;

          const lastDigest = await db
            .select()
            .from(digestRuns)
            .where(
              and(
                eq(digestRuns.userId, userId),
                eq(digestRuns.organisationId, orgId),
                eq(digestRuns.status, "SENT")
              )
            )
            .orderBy(desc(digestRuns.sentAt))
            .limit(1);

          const sinceTime = lastDigest.length > 0 && lastDigest[0].sentAt 
            ? lastDigest[0].sentAt 
            : cutoffTime;

          const userNotifications = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.recipientUserId, userId),
                eq(notifications.organisationId, orgId),
                inArray(notifications.kind, categoryKinds as any),
                gte(notifications.createdAt, sinceTime),
                lt(notifications.createdAt, now),
                isNull(notifications.digestedAt)
              )
            )
            .orderBy(notifications.createdAt);

          if (userNotifications.length === 0) {
            continue;
          }

          const baseUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : process.env.REPLIT_DEPLOYMENT_URL 
            ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
            : 'http://localhost:5000';
          
          const digestData: NotificationDigestData = {
            firstName: user.firstName || undefined,
            periodLabel,
            dashboardUrl: `${baseUrl}/notifications`,
            notifications: userNotifications.map((n) => {
              let patientName: string | undefined;
              if (n.metadata) {
                try {
                  const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
                  patientName = meta.patientName || meta.patientNom || undefined;
                } catch {}
              }
              return {
                title: n.title,
                body: n.body || undefined,
                severity: n.severity,
                entityType: n.entityType || undefined,
                patientName,
                createdAt: n.createdAt.toLocaleString('fr-FR', { 
                  dateStyle: 'short', 
                  timeStyle: 'short' 
                }),
              };
            }),
          };

          const emailResult = await sendEmail(user.email, "notificationDigest", digestData);

          if (emailResult.success) {
            const notificationIds = userNotifications.map((n) => n.id);
            
            await db.transaction(async (tx) => {
              await tx
                .update(notifications)
                .set({ digestedAt: now })
                .where(inArray(notifications.id, notificationIds));

              for (const category of categories) {
                const categoryNotificationCount = userNotifications.filter((n) => {
                  const kinds = CATEGORY_TO_KIND[category] || [];
                  return kinds.includes(n.kind);
                }).length;
                
                if (categoryNotificationCount > 0) {
                  await tx.insert(digestRuns).values({
                    organisationId: orgId,
                    userId,
                    category: category as any,
                    periodStart: sinceTime,
                    periodEnd: now,
                    status: "SENT" as const,
                    notificationCount: categoryNotificationCount,
                    sentAt: now,
                  });
                }
              }
            });

            results.push({
              userId,
              email: user.email,
              notificationCount: userNotifications.length,
              success: true,
            });

            console.log(`[DIGEST] Sent ${periodLabel} digest to ${user.email} (org: ${orgId}) with ${userNotifications.length} notifications`);
          } else {
            for (const category of categories) {
              const categoryNotificationCount = userNotifications.filter((n) => {
                const kinds = CATEGORY_TO_KIND[category] || [];
                return kinds.includes(n.kind);
              }).length;
              
              if (categoryNotificationCount > 0) {
                await db.insert(digestRuns).values({
                  organisationId: orgId,
                  userId,
                  category: category as any,
                  periodStart: sinceTime,
                  periodEnd: now,
                  status: "FAILED" as const,
                  errorMessage: emailResult.error || "Unknown error",
                  notificationCount: categoryNotificationCount,
                });
              }
            }

            results.push({
              userId,
              email: user.email,
              notificationCount: userNotifications.length,
              success: false,
              error: "Failed to send email",
            });

            console.log(`[DIGEST] Failed to send ${periodLabel} digest to ${user.email}`);
          }
        }
      } catch (userError: any) {
        console.error(`[DIGEST] Error processing user ${userId}:`, userError);
        results.push({
          userId,
          email: "unknown",
          notificationCount: 0,
          success: false,
          error: userError.message,
        });
      }
    }

    return { processed: results.length, results };
  } catch (error) {
    console.error(`[DIGEST] Error running ${digestType} digest:`, error);
    throw error;
  }
}

let minuteIntervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export function startDigestScheduler(): void {
  console.log("[DIGEST] Starting digest scheduler (runs every minute)...");

  async function runDigestCheck() {
    if (isRunning) {
      console.log("[DIGEST] Skipping - previous run still in progress");
      return;
    }
    isRunning = true;
    try {
      const result = await runDailyDigest();
      if (result.processed > 0) {
        console.log(`[DIGEST] Digest check complete: ${result.processed} digests sent`);
      }
      
      // Check for implants reaching 24 months (run once daily)
      const currentHour = new Date().getHours();
      if (currentHour === 8) {
        await checkAutoSuccessRateNotifications();
      }
    } catch (error) {
      // Errors are caught here - runDailyDigest exceptions don't escape
      console.error("[DIGEST] Digest check failed:", error);
    } finally {
      // Always reset mutex - finally runs after catch handles any error
      isRunning = false;
    }
  }

  // Run immediately on startup, then every minute
  runDigestCheck();
  minuteIntervalId = setInterval(runDigestCheck, 60 * 1000);
}

export function stopDigestScheduler(): void {
  if (minuteIntervalId) {
    clearInterval(minuteIntervalId);
    minuteIntervalId = null;
  }
  console.log("[DIGEST] Digest scheduler stopped");
}

function getSuccessRateFromISQ(isq: number): number {
  if (isq === 100) return 100;
  if (isq >= 81) return 80;
  if (isq >= 61) return 60;
  if (isq >= 41) return 40;
  if (isq >= 21) return 20;
  return 0;
}

export async function checkAutoSuccessRateNotifications(): Promise<number> {
  console.log("[AUTO_SUCCESS_RATE] Checking for implants reaching 24 months...");
  
  try {
    const twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
    const formattedDate = twentyFourMonthsAgo.toISOString().split('T')[0];
    
    const implantsToNotify = await db
      .select({
        id: surgeryImplants.id,
        organisationId: surgeryImplants.organisationId,
        datePose: surgeryImplants.datePose,
        siteFdi: surgeryImplants.siteFdi,
        isqPose: surgeryImplants.isqPose,
        isq2m: surgeryImplants.isq2m,
        isq3m: surgeryImplants.isq3m,
        isq6m: surgeryImplants.isq6m,
        implantMarque: implants.marque,
        implantRef: implants.referenceFabricant,
        patientId: operations.patientId,
      })
      .from(surgeryImplants)
      .innerJoin(implants, eq(surgeryImplants.implantId, implants.id))
      .innerJoin(operations, eq(surgeryImplants.surgeryId, operations.id))
      .where(
        and(
          lte(surgeryImplants.datePose, formattedDate)
        )
      );

    let notificationCount = 0;

    for (const implant of implantsToNotify) {
      const latestISQ = implant.isq6m ?? implant.isq3m ?? implant.isq2m ?? implant.isqPose;
      
      if (latestISQ === null || latestISQ === undefined) continue;

      const existingNotification = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.dedupeKey, `auto_success_rate_${implant.id}`),
            eq(notifications.organisationId, implant.organisationId)
          )
        )
        .limit(1);

      if (existingNotification.length > 0) continue;

      const orgAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.organisationId, implant.organisationId),
            inArray(users.role, ["ADMIN", "CHIRURGIEN"])
          )
        );

      if (orgAdmins.length === 0) continue;

      const successRate = getSuccessRateFromISQ(latestISQ);
      const implantRef = implant.implantRef || `${implant.implantMarque} (${implant.siteFdi})`;

      for (const admin of orgAdmins) {
        await notificationEvents.onAutoSuccessRate({
          organisationId: implant.organisationId,
          recipientUserId: admin.id,
          patientId: implant.patientId,
          surgeryImplantId: implant.id,
          implantRef,
          datePose: implant.datePose,
          latestISQ,
          successRate,
        });
        notificationCount++;
      }
    }

    console.log(`[AUTO_SUCCESS_RATE] Created ${notificationCount} notifications`);
    return notificationCount;
  } catch (error) {
    console.error("[AUTO_SUCCESS_RATE] Error checking implants:", error);
    return 0;
  }
}
