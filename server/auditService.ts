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
  async log(params: AuditLogParams): Promise<AuditLog> {
    const auditLog: InsertAuditLog = {
      organisationId: params.organisationId,
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      details: params.details || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    };
    
    return storage.createAuditLog(auditLog);
  }

  async getEntityHistory(organisationId: string, entityType: AuditEntityType, entityId: string) {
    return storage.getEntityAuditLogs(organisationId, entityType, entityId);
  }

  async getRecentActivity(organisationId: string, limit: number = 10) {
    return storage.getAuditLogs(organisationId, limit);
  }
}

export const auditService = new AuditService();
