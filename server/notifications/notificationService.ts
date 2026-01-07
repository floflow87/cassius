import { db } from "../db";
import { 
  notifications, 
  notificationPreferences, 
  users,
  InsertNotification,
  Notification,
  NotificationPreference
} from "@shared/schema";
import { eq, and, desc, isNull, sql, lt, gte } from "drizzle-orm";
import { sendEmail } from "../emails/send";

type NotificationKind = "ALERT" | "REMINDER" | "ACTIVITY" | "IMPORT" | "SYSTEM";
type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";
type NotificationEntityType = "PATIENT" | "IMPLANT" | "OPERATION" | "APPOINTMENT" | "DOCUMENT" | "IMPORT" | "INTEGRATION" | "BILLING";
type NotificationCategory = "ALERTS_REMINDERS" | "TEAM_ACTIVITY" | "IMPORTS" | "SYSTEM";
type NotificationFrequency = "NONE" | "DIGEST" | "IMMEDIATE";

interface CreateNotificationParams {
  organisationId: string;
  recipientUserId: string;
  kind: NotificationKind;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  body?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  actorUserId?: string;
  metadata?: Record<string, any>;
  dedupeKey?: string;
}

interface UserPreferences {
  frequency: NotificationFrequency;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  frequency: "IMMEDIATE",
  inAppEnabled: true,
  emailEnabled: false,
};

function kindToCategory(kind: NotificationKind): NotificationCategory {
  switch (kind) {
    case "ALERT":
    case "REMINDER":
      return "ALERTS_REMINDERS";
    case "ACTIVITY":
      return "TEAM_ACTIVITY";
    case "IMPORT":
      return "IMPORTS";
    case "SYSTEM":
      return "SYSTEM";
  }
}

async function getPreferences(userId: string, organisationId: string, category: NotificationCategory): Promise<UserPreferences> {
  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.organisationId, organisationId),
        eq(notificationPreferences.category, category)
      )
    )
    .limit(1);

  if (!pref) {
    return DEFAULT_PREFERENCES;
  }

  return {
    frequency: pref.frequency as NotificationFrequency,
    inAppEnabled: pref.inAppEnabled,
    emailEnabled: pref.emailEnabled,
  };
}

async function checkDedupe(dedupeKey: string, recipientUserId: string, cooldownMinutes: number = 30): Promise<boolean> {
  const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  
  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.dedupeKey, dedupeKey),
        eq(notifications.recipientUserId, recipientUserId),
        gte(notifications.createdAt, cooldownTime)
      )
    )
    .limit(1);

  return !!existing;
}

export async function createNotification(params: CreateNotificationParams): Promise<Notification | null> {
  const {
    organisationId,
    recipientUserId,
    kind,
    type,
    severity = "INFO",
    title,
    body,
    entityType,
    entityId,
    actorUserId,
    metadata,
    dedupeKey,
  } = params;

  const category = kindToCategory(kind);
  const prefs = await getPreferences(recipientUserId, organisationId, category);

  if (prefs.frequency === "NONE" || (!prefs.inAppEnabled && !prefs.emailEnabled)) {
    console.log(`[Notification] Skipping notification for user ${recipientUserId} - disabled by preferences`);
    return null;
  }

  if (dedupeKey) {
    const isDupe = await checkDedupe(dedupeKey, recipientUserId);
    if (isDupe) {
      console.log(`[Notification] Skipping duplicate notification: ${dedupeKey}`);
      return null;
    }
  }

  const [notification] = await db
    .insert(notifications)
    .values({
      organisationId,
      recipientUserId,
      kind,
      type,
      severity,
      title,
      body,
      entityType,
      entityId,
      actorUserId,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      dedupeKey,
    })
    .returning();

  console.log(`[Notification] Created notification ${notification.id} for user ${recipientUserId}: ${title}`);

  if (prefs.emailEnabled && prefs.frequency === "IMMEDIATE") {
    await sendImmediateEmailNotification(notification, recipientUserId, organisationId);
  }

  return notification;
}

async function sendImmediateEmailNotification(notification: Notification, userId: string, organisationId: string) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.username) {
      console.log(`[Notification] Cannot send email - user not found or no email`);
      return;
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DEPLOYMENT_URL 
      ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
      : 'http://localhost:5000';

    let deepLink = `${baseUrl}/notifications`;
    if (notification.entityType && notification.entityId) {
      switch (notification.entityType) {
        case "PATIENT":
          deepLink = `${baseUrl}/patients/${notification.entityId}`;
          break;
        case "APPOINTMENT":
          deepLink = `${baseUrl}/calendar`;
          break;
        case "IMPORT":
          deepLink = `${baseUrl}/import`;
          break;
      }
    }

    await sendEmail(user.username, 'systemAlert', {
      alertType: 'action_required',
      message: `${notification.title}${notification.body ? '\n\n' + notification.body : ''}`,
      actionLabel: 'Ouvrir dans Cassius',
      actionUrl: deepLink,
      firstName: user.prenom || user.nom || undefined,
    });

    console.log(`[Notification] Sent immediate email to ${user.username}`);
  } catch (error) {
    console.error(`[Notification] Failed to send immediate email:`, error);
  }
}

export async function getNotifications(
  userId: string,
  organisationId: string,
  options: {
    kind?: NotificationKind;
    unreadOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ notifications: Notification[]; total: number }> {
  const { kind, unreadOnly = false, page = 1, pageSize = 20 } = options;

  let whereConditions = [
    eq(notifications.recipientUserId, userId),
    eq(notifications.organisationId, organisationId),
    isNull(notifications.archivedAt),
  ];

  if (kind) {
    whereConditions.push(eq(notifications.kind, kind));
  }

  if (unreadOnly) {
    whereConditions.push(isNull(notifications.readAt));
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(...whereConditions));

  const total = countResult?.count || 0;

  const results = await db
    .select()
    .from(notifications)
    .where(and(...whereConditions))
    .orderBy(desc(notifications.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { notifications: results, total };
}

export async function getUnreadCount(userId: string, organisationId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.organisationId, organisationId),
        isNull(notifications.readAt),
        isNull(notifications.archivedAt)
      )
    );

  return result?.count || 0;
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientUserId, userId)
      )
    )
    .returning();

  return !!updated;
}

export async function markAsUnread(notificationId: string, userId: string): Promise<boolean> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: null })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientUserId, userId)
      )
    )
    .returning();

  return !!updated;
}

export async function markAllAsRead(userId: string, organisationId: string): Promise<number> {
  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.organisationId, organisationId),
        isNull(notifications.readAt),
        isNull(notifications.archivedAt)
      )
    )
    .returning();

  return result.length;
}

export async function archiveNotification(notificationId: string, userId: string): Promise<boolean> {
  const [updated] = await db
    .update(notifications)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientUserId, userId)
      )
    )
    .returning();

  return !!updated;
}

export async function getUserPreferences(userId: string, organisationId: string): Promise<NotificationPreference[]> {
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.organisationId, organisationId)
      )
    );

  return prefs;
}

export async function updatePreference(
  userId: string,
  organisationId: string,
  category: NotificationCategory,
  updates: {
    frequency?: NotificationFrequency;
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
    digestTime?: string;
    disabledTypes?: string[];
    disabledEmailTypes?: string[];
  }
): Promise<NotificationPreference> {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.organisationId, organisationId),
        eq(notificationPreferences.category, category)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        organisationId,
        category,
        frequency: updates.frequency || "IMMEDIATE",
        inAppEnabled: updates.inAppEnabled ?? true,
        emailEnabled: updates.emailEnabled ?? false,
        digestTime: updates.digestTime || "08:30",
        disabledTypes: updates.disabledTypes || [],
        disabledEmailTypes: updates.disabledEmailTypes || [],
      })
      .returning();
    return created;
  }
}

export const notificationEvents = {
  async onIsqLow(params: { 
    organisationId: string; 
    recipientUserId: string; 
    patientId: string;
    implantRef: string;
    isqValue: number;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ALERT",
      type: "ISQ_LOW",
      severity: "CRITICAL",
      title: "ISQ bas détecté",
      body: `Un implant présente un ISQ faible (${params.isqValue}). Action requise.`,
      entityType: "PATIENT",
      entityId: params.patientId,
      metadata: { implantRef: params.implantRef, isqValue: params.isqValue },
      dedupeKey: `isq_low_${params.patientId}_${params.implantRef}`,
    });
  },

  async onFollowupToSchedule(params: {
    organisationId: string;
    recipientUserId: string;
    patientId: string;
    patientName: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "REMINDER",
      type: "FOLLOWUP_TO_SCHEDULE",
      severity: "WARNING",
      title: "Suivi a programmer",
      body: `Un patient necessite un rendez-vous de suivi.`,
      entityType: "PATIENT",
      entityId: params.patientId,
      dedupeKey: `followup_${params.patientId}`,
    });
  },

  async onDocumentUploaded(params: {
    organisationId: string;
    recipientUserId: string;
    actorUserId: string;
    documentId: string;
    documentName: string;
    patientId?: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ACTIVITY",
      type: "DOCUMENT_ADDED",
      severity: "INFO",
      title: "Document ajouté",
      body: `Un document a été ajouté.`,
      entityType: "DOCUMENT",
      entityId: params.documentId,
      actorUserId: params.actorUserId,
      metadata: { documentName: params.documentName, patientId: params.patientId },
    });
  },

  async onImportStarted(params: {
    organisationId: string;
    recipientUserId: string;
    importId: string;
    fileName: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "IMPORT",
      type: "IMPORT_STARTED",
      severity: "INFO",
      title: "Import démarré",
      body: `L'import est en cours.`,
      entityType: "IMPORT",
      entityId: params.importId,
      metadata: { fileName: params.fileName },
    });
  },

  async onImportCompleted(params: {
    organisationId: string;
    recipientUserId: string;
    importId: string;
    successCount: number;
    failureCount: number;
  }) {
    const severity = params.failureCount > 0 ? "WARNING" : "INFO";
    const type = params.failureCount > 0 ? "IMPORT_PARTIAL" : "IMPORT_COMPLETED";
    
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "IMPORT",
      type,
      severity,
      title: params.failureCount > 0 ? "Import terminé avec erreurs" : "Import terminé",
      body: `${params.successCount} éléments importés` + (params.failureCount > 0 ? `, ${params.failureCount} erreurs` : ""),
      entityType: "IMPORT",
      entityId: params.importId,
      metadata: { successCount: params.successCount, failureCount: params.failureCount },
    });
  },

  async onImportFailed(params: {
    organisationId: string;
    recipientUserId: string;
    importId: string;
    errorMessage: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "IMPORT",
      type: "IMPORT_FAILED",
      severity: "CRITICAL",
      title: "Échec de l'import",
      body: `L'import a échoué.`,
      entityType: "IMPORT",
      entityId: params.importId,
      metadata: { errorMessage: params.errorMessage },
    });
  },

  async onSyncError(params: {
    organisationId: string;
    recipientUserId: string;
    integrationName: string;
    errorMessage: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "SYSTEM",
      type: "SYNC_ERROR",
      severity: "WARNING",
      title: "Erreur de synchronisation",
      body: `La synchronisation ${params.integrationName} a rencontré une erreur.`,
      entityType: "INTEGRATION",
      metadata: { integrationName: params.integrationName, errorMessage: params.errorMessage },
      dedupeKey: `sync_error_${params.integrationName}`,
    });
  },

  async onPatientUpdated(params: {
    organisationId: string;
    recipientUserId: string;
    actorUserId: string;
    patientId: string;
    changes: string[];
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ACTIVITY",
      type: "PATIENT_UPDATED",
      severity: "INFO",
      title: "Fiche patient modifiée",
      body: `Des modifications ont été apportées à une fiche patient.`,
      entityType: "PATIENT",
      entityId: params.patientId,
      actorUserId: params.actorUserId,
      metadata: { changes: params.changes },
    });
  },

  async onAppointmentCreated(params: {
    organisationId: string;
    recipientUserId: string;
    actorUserId?: string;
    appointmentId: string;
    appointmentDate: string;
    patientId?: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ACTIVITY",
      type: "APPOINTMENT_CREATED",
      severity: "INFO",
      title: "Nouveau rendez-vous",
      body: `Un rendez-vous a été programmé.`,
      entityType: "APPOINTMENT",
      entityId: params.appointmentId,
      actorUserId: params.actorUserId,
      metadata: { appointmentDate: params.appointmentDate, patientId: params.patientId },
    });
  },

  // Clinical: ISQ declining (drop of 10+ points)
  async onIsqDeclining(params: {
    organisationId: string;
    recipientUserId: string;
    patientId: string;
    patientName: string;
    implantSite: string;
    previousIsq: number;
    currentIsq: number;
    drop: number;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ALERT",
      type: "ISQ_DECLINING",
      severity: "WARNING",
      title: `Baisse significative de stabilité implantaire`,
      body: `L'implant site ${params.implantSite} (${params.patientName}) a perdu ${params.drop} points ISQ (${params.previousIsq} -> ${params.currentIsq}).`,
      entityType: "PATIENT",
      entityId: params.patientId,
      metadata: { implantSite: params.implantSite, previousIsq: params.previousIsq, currentIsq: params.currentIsq, drop: params.drop },
      dedupeKey: `isq_declining_${params.patientId}_${params.implantSite}`,
    });
  },

  // Clinical: No post-op follow-up
  async onNoPostOpFollowup(params: {
    organisationId: string;
    recipientUserId: string;
    patientId: string;
    patientName: string;
    operationId: string;
    operationDate: string;
    daysSinceOp: number;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "REMINDER",
      type: "NO_POSTOP_FOLLOWUP",
      severity: "WARNING",
      title: `Suivi post-opératoire manquant`,
      body: `${params.patientName}: intervention du ${params.operationDate} sans contrôle ISQ à J+${params.daysSinceOp}.`,
      entityType: "PATIENT",
      entityId: params.patientId,
      metadata: { operationId: params.operationId, operationDate: params.operationDate, daysSinceOp: params.daysSinceOp },
      dedupeKey: `no_postop_${params.operationId}`,
    });
  },

  // Clinical: Implant without visit for X months
  async onNoRecentVisit(params: {
    organisationId: string;
    recipientUserId: string;
    patientId: string;
    patientName: string;
    implantSite: string;
    monthsSinceVisit: number;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "REMINDER",
      type: "NO_RECENT_VISIT",
      severity: "INFO",
      title: `Implant sans visite récente`,
      body: `${params.patientName}, site ${params.implantSite}: aucune visite depuis ${params.monthsSinceVisit} mois.`,
      entityType: "PATIENT",
      entityId: params.patientId,
      metadata: { implantSite: params.implantSite, monthsSinceVisit: params.monthsSinceVisit },
      dedupeKey: `no_recent_visit_${params.patientId}_${params.implantSite}`,
    });
  },

  // Clinical: Unstable ISQ history (multiple low consecutive)
  async onUnstableIsqHistory(params: {
    organisationId: string;
    recipientUserId: string;
    patientId: string;
    patientName: string;
    implantSite: string;
    lowIsqCount: number;
    recentIsqValues: number[];
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ALERT",
      type: "UNSTABLE_ISQ_HISTORY",
      severity: "CRITICAL",
      title: `Historique ISQ instable`,
      body: `${params.patientName}, site ${params.implantSite}: ${params.lowIsqCount} mesures ISQ faibles consécutives (${params.recentIsqValues.join(', ')}).`,
      entityType: "PATIENT",
      entityId: params.patientId,
      metadata: { implantSite: params.implantSite, lowIsqCount: params.lowIsqCount, recentIsqValues: params.recentIsqValues },
      dedupeKey: `unstable_isq_${params.patientId}_${params.implantSite}`,
    });
  },

  // Clinical: Surgery without planned follow-up
  async onSurgeryNoFollowupPlanned(params: {
    organisationId: string;
    recipientUserId: string;
    patientId: string;
    patientName: string;
    operationId: string;
    operationDate: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "REMINDER",
      type: "SURGERY_NO_FOLLOWUP_PLANNED",
      severity: "WARNING",
      title: `Acte chirurgical sans suivi planifié`,
      body: `${params.patientName}: opération du ${params.operationDate} sans RDV de suivi programmé.`,
      entityType: "PATIENT",
      entityId: params.patientId,
      metadata: { operationId: params.operationId, operationDate: params.operationDate },
      dedupeKey: `surgery_no_followup_${params.operationId}`,
    });
  },

  // Activity: Radio added
  async onRadioAdded(params: {
    organisationId: string;
    recipientUserId: string;
    actorUserId: string;
    patientId: string;
    patientName: string;
    radioType: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ACTIVITY",
      type: "RADIO_ADDED",
      severity: "INFO",
      title: `Radiographie ajoutée`,
      body: `${params.radioType} ajoutée pour ${params.patientName}.`,
      entityType: "PATIENT",
      entityId: params.patientId,
      actorUserId: params.actorUserId,
      metadata: { radioType: params.radioType },
    });
  },

  // Collaboration: Invitation sent
  async onInvitationSent(params: {
    organisationId: string;
    recipientUserId: string;
    inviteeEmail: string;
    role: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ACTIVITY",
      type: "INVITATION_SENT",
      severity: "INFO",
      title: `Invitation envoyée`,
      body: `Une invitation a été envoyée à ${params.inviteeEmail} en tant que ${params.role}.`,
      metadata: { inviteeEmail: params.inviteeEmail, role: params.role },
    });
  },

  // Collaboration: New member joined
  async onNewMemberJoined(params: {
    organisationId: string;
    recipientUserId: string;
    newMemberName: string;
    newMemberEmail: string;
    role: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ACTIVITY",
      type: "NEW_MEMBER_JOINED",
      severity: "INFO",
      title: `Nouveau membre`,
      body: `${params.newMemberName} (${params.newMemberEmail}) a rejoint l'équipe en tant que ${params.role}.`,
      metadata: { newMemberName: params.newMemberName, newMemberEmail: params.newMemberEmail, role: params.role },
    });
  },

  // Collaboration: Role changed
  async onRoleChanged(params: {
    organisationId: string;
    recipientUserId: string;
    affectedUserName: string;
    previousRole: string;
    newRole: string;
    actorUserId: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "ACTIVITY",
      type: "ROLE_CHANGED",
      severity: "INFO",
      title: `Rôle modifié`,
      body: `Le rôle de ${params.affectedUserName} a été modifié: ${params.previousRole} -> ${params.newRole}.`,
      actorUserId: params.actorUserId,
      metadata: { affectedUserName: params.affectedUserName, previousRole: params.previousRole, newRole: params.newRole },
    });
  },

  // Technical: Email sending error
  async onEmailError(params: {
    organisationId: string;
    recipientUserId: string;
    emailType: string;
    targetEmail: string;
    errorMessage: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "SYSTEM",
      type: "EMAIL_ERROR",
      severity: "WARNING",
      title: `Erreur d'envoi d'email`,
      body: `L'email ${params.emailType} vers ${params.targetEmail} n'a pas pu être envoyé.`,
      metadata: { emailType: params.emailType, targetEmail: params.targetEmail, errorMessage: params.errorMessage },
      dedupeKey: `email_error_${params.targetEmail}_${params.emailType}`,
    });
  },

  // System: Maintenance notification
  async onSystemMaintenance(params: {
    organisationId: string;
    recipientUserId: string;
    maintenanceType: string;
    scheduledAt?: string;
    description: string;
  }) {
    return createNotification({
      organisationId: params.organisationId,
      recipientUserId: params.recipientUserId,
      kind: "SYSTEM",
      type: "SYSTEM_MAINTENANCE",
      severity: "INFO",
      title: `Maintenance système`,
      body: params.description,
      metadata: { maintenanceType: params.maintenanceType, scheduledAt: params.scheduledAt },
    });
  },
};

export default {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  archiveNotification,
  getUserPreferences,
  updatePreference,
  notificationEvents,
};
