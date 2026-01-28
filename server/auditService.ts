import { storage } from "./storage";
import type { AuditLog, InsertAuditLog } from "@shared/schema";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "ARCHIVE" | "RESTORE";
export type AuditEntityType = "PATIENT" | "OPERATION" | "SURGERY_IMPLANT" | "CATALOG_IMPLANT" | "DOCUMENT" | "RADIO" | "APPOINTMENT";

interface AuditLogParams {
  organisationId: string;
  userId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  details?: string;
  metadata?: Record<string, any>;
}

class AuditService {
  async log(params: AuditLogParams): Promise<AuditLog | null> {
    try {
      const auditLog: InsertAuditLog = {
        organisationId: params.organisationId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        details: params.details || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };
      
      return await storage.createAuditLog(auditLog);
    } catch (error) {
      // Log error but don't crash the app - audit is non-critical
      console.error("[AuditService] Failed to create audit log:", error);
      return null;
    }
  }

  async getEntityHistory(organisationId: string, entityType: AuditEntityType, entityId: string) {
    try {
      return await storage.getEntityAuditLogs(organisationId, entityType, entityId);
    } catch (error) {
      console.error("[AuditService] Failed to get entity history:", error);
      return [];
    }
  }

  async getRecentActivity(organisationId: string, limit: number = 10) {
    try {
      return await storage.getAuditLogs(organisationId, limit);
    } catch (error) {
      console.error("[AuditService] Failed to get recent activity:", error);
      return [];
    }
  }
}

export const auditService = new AuditService();
