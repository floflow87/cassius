import { db } from "../db";
import { notifications, notificationPreferences, digestRuns, users } from "@shared/schema";
import { eq, and, gte, isNull, inArray, lt, desc } from "drizzle-orm";
import { sendEmail } from "../emails/send";
import type { NotificationDigestData } from "../emails/templates/notificationDigest";

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
      if (!pref.digestTime) return currentHour === 8;
      const prefHour = parseInt(pref.digestTime.split(":")[0], 10);
      return prefHour === currentHour;
    });

    if (filteredPrefs.length === 0) {
      console.log(`[DIGEST] No users with digest preferences for hour ${currentHour}`);
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
            notifications: userNotifications.map((n) => ({
              title: n.title,
              body: n.body || undefined,
              severity: n.severity,
              entityType: n.entityType || undefined,
              createdAt: n.createdAt.toLocaleString('fr-FR', { 
                dateStyle: 'short', 
                timeStyle: 'short' 
              }),
            })),
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

let hourlyTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function startDigestScheduler(): void {
  console.log("[DIGEST] Starting hourly digest scheduler...");

  function scheduleNextHourly() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const msUntilNext = nextHour.getTime() - now.getTime();

    console.log(`[DIGEST] Next digest check scheduled for ${nextHour.toISOString()}`);

    hourlyTimeoutId = setTimeout(async () => {
      try {
        console.log("[DIGEST] Running hourly digest check...");
        const result = await runDailyDigest();
        console.log(`[DIGEST] Digest check complete: ${result.processed} digests sent`);
      } catch (error) {
        console.error("[DIGEST] Digest check failed:", error);
      }
      scheduleNextHourly();
    }, msUntilNext);
  }

  scheduleNextHourly();
}

export function stopDigestScheduler(): void {
  if (hourlyTimeoutId) {
    clearTimeout(hourlyTimeoutId);
    hourlyTimeoutId = null;
  }
  console.log("[DIGEST] Digest scheduler stopped");
}
