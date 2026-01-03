import { Resend } from 'resend';
import { resetPasswordHtml, resetPasswordText, ResetPasswordData } from './templates/resetPassword';
import { verifyEmailHtml, verifyEmailText, VerifyEmailData } from './templates/verifyEmail';
import { invitationHtml, invitationText, InvitationData } from './templates/invitation';
import { securityNoticeHtml, securityNoticeText, SecurityNoticeData } from './templates/securityNotice';
import { integrationConnectedHtml, integrationConnectedText, IntegrationConnectedData } from './templates/integrationConnected';
import { systemAlertHtml, systemAlertText, SystemAlertData } from './templates/systemAlert';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { 
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email || 'noreply@cassiuspro.com' 
  };
}

function getBaseUrl(): string {
  return process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DEPLOYMENT_URL 
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : 'http://localhost:5000';
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export type TemplateName = 
  | 'resetPassword'
  | 'verifyEmail'
  | 'invitation'
  | 'securityNotice'
  | 'integrationConnected'
  | 'systemAlert';

export type TemplateData = {
  resetPassword: ResetPasswordData;
  verifyEmail: VerifyEmailData;
  invitation: InvitationData;
  securityNotice: SecurityNoticeData;
  integrationConnected: IntegrationConnectedData;
  systemAlert: SystemAlertData;
};

const SUBJECT_MAP: Record<TemplateName, (data: any) => string> = {
  resetPassword: () => 'Reinitialisation de votre mot de passe - Cassius',
  verifyEmail: () => 'Confirmez votre adresse email - Cassius',
  invitation: (data: InvitationData) => `Invitation a rejoindre ${data.organisationName} - Cassius`,
  securityNotice: (data: SecurityNoticeData) => {
    const titles: Record<string, string> = {
      new_login: 'Nouvelle connexion detectee - Cassius',
      password_changed: 'Mot de passe modifie - Cassius',
      email_changed: 'Adresse email modifiee - Cassius',
    };
    return titles[data.type] || 'Alerte de securite - Cassius';
  },
  integrationConnected: (data: IntegrationConnectedData) => `${data.integrationName} connecte - Cassius`,
  systemAlert: (data: SystemAlertData) => {
    const titles: Record<string, string> = {
      action_required: 'Action requise dans Cassius',
      payment_failed: 'Probleme de paiement - Cassius',
      trial_ending: 'Votre essai se termine bientot - Cassius',
      subscription_update: 'Mise a jour de votre abonnement - Cassius',
    };
    return titles[data.alertType] || 'Notification Cassius';
  },
};

function generateHtml(template: TemplateName, data: any): string {
  switch (template) {
    case 'resetPassword':
      return resetPasswordHtml(data);
    case 'verifyEmail':
      return verifyEmailHtml(data);
    case 'invitation':
      return invitationHtml(data);
    case 'securityNotice':
      return securityNoticeHtml(data);
    case 'integrationConnected':
      return integrationConnectedHtml(data);
    case 'systemAlert':
      return systemAlertHtml(data);
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

function generateText(template: TemplateName, data: any): string {
  switch (template) {
    case 'resetPassword':
      return resetPasswordText(data);
    case 'verifyEmail':
      return verifyEmailText(data);
    case 'invitation':
      return invitationText(data);
    case 'securityNotice':
      return securityNoticeText(data);
    case 'integrationConnected':
      return integrationConnectedText(data);
    case 'systemAlert':
      return systemAlertText(data);
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

export async function sendEmail<T extends TemplateName>(
  toEmail: string,
  template: T,
  data: TemplateData[T]
): Promise<EmailResult> {
  try {
    const { apiKey, fromEmail } = await getCredentials();
    const resend = new Resend(apiKey);
    
    const subject = SUBJECT_MAP[template](data);
    const html = generateHtml(template, data);
    const text = generateText(template, data);
    
    const response = await resend.emails.send({
      from: `Cassius <${fromEmail}>`,
      to: toEmail,
      subject,
      html,
      text,
    });
    
    if (response.error) {
      console.error(`[Email] Failed to send ${template} email:`, response.error);
      return { success: false, error: response.error.message };
    }
    
    console.log(`[Email] ${template} email sent to ${toEmail}, messageId: ${response.data?.id}`);
    return { success: true, messageId: response.data?.id };
  } catch (error: any) {
    console.error(`[Email] Error sending ${template} email:`, error);
    return { success: false, error: error.message };
  }
}

export function getPreviewHtml(template: TemplateName, data?: any): string {
  const baseUrl = getBaseUrl();
  
  const sampleData: Record<TemplateName, any> = {
    resetPassword: {
      resetUrl: `${baseUrl}/reset-password?token=sample-token-12345`,
      firstName: 'Jean',
    },
    verifyEmail: {
      verifyUrl: `${baseUrl}/verify-email?token=sample-token-12345`,
      firstName: 'Marie',
    },
    invitation: {
      inviteUrl: `${baseUrl}/accept-invitation?token=sample-token-12345`,
      organisationName: 'Cabinet Dentaire du Parc',
      inviterName: 'Dr. Martin Dupont',
      role: 'CHIRURGIEN',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    securityNotice: {
      type: 'new_login',
      firstName: 'Pierre',
      deviceInfo: 'Chrome sur MacOS',
      ipAddress: '192.168.1.1',
      timestamp: new Date(),
      securityUrl: `${baseUrl}/settings/security`,
    },
    integrationConnected: {
      integrationName: 'Google Calendar',
      firstName: 'Sophie',
      connectedAt: new Date(),
      settingsUrl: `${baseUrl}/settings/integrations`,
    },
    systemAlert: {
      alertType: 'trial_ending',
      firstName: 'Lucas',
      message: 'Votre periode d\'essai gratuit se termine dans 3 jours. Passez a un abonnement payant pour continuer a utiliser Cassius sans interruption.',
      actionUrl: `${baseUrl}/settings/billing`,
      actionLabel: 'Voir les offres',
      expiryInfo: 'Votre essai expire le 10 janvier 2026.',
    },
  };
  
  const templateData = data || sampleData[template];
  return generateHtml(template, templateData);
}

export { getBaseUrl };
