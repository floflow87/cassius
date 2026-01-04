import { Resend } from 'resend';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail || 'noreply@cassiuspro.com'
  };
}

const APP_NAME = 'Cassius';

function getBaseUrl(): string {
  return process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DEPLOYMENT_URL 
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : 'http://localhost:5000';
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function createSimpleEmailHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    a { color: #1e40af; }
    .signature { margin-top: 30px; color: #64748b; }
  </style>
</head>
<body>
${content}
</body>
</html>
  `.trim();
}

export async function sendPasswordResetEmail(
  toEmail: string,
  token: string,
  firstName?: string
): Promise<EmailResult> {
  try {
    let clientData;
    try {
      clientData = await getUncachableResendClient();
    } catch (credError: any) {
      console.log("[EMAIL] Resend not configured, skipping email:", credError.message);
      return { success: true, messageId: 'skipped-no-resend' };
    }
    const { client, fromEmail } = clientData;
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;
    const expiryMinutes = 60;
    
    const htmlContent = createSimpleEmailHtml(`
<p>Bonjour ${firstName || ''},</p>
<p>Nous avons reçu une demande de réinitialisation du mot de passe de votre compte ${APP_NAME}.</p>
<p>Pour réinitialiser votre mot de passe, cliquez sur ce lien : <a href="${resetUrl}">${resetUrl}</a></p>
<p>Ce lien expire dans ${expiryMinutes} minutes.</p>
<p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
<p class="signature">— L'équipe ${APP_NAME}</p>
    `);

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Réinitialisation de votre mot de passe — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Password reset email sent to:', toEmail, 'messageId:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending password reset email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendEmailVerificationEmail(
  toEmail: string,
  token: string,
  firstName?: string
): Promise<EmailResult> {
  try {
    let clientData;
    try {
      clientData = await getUncachableResendClient();
    } catch (credError: any) {
      console.log("[EMAIL] Resend not configured, skipping email:", credError.message);
      return { success: true, messageId: 'skipped-no-resend' };
    }
    const { client, fromEmail } = clientData;
    const verifyUrl = `${getBaseUrl()}/verify-email?token=${token}`;
    
    const htmlContent = createSimpleEmailHtml(`
<p>Bonjour ${firstName || ''},</p>
<p>Pour finaliser l'activation de votre compte ${APP_NAME}, merci de confirmer votre adresse email.</p>
<p>Confirmer mon email ici : <a href="${verifyUrl}">${verifyUrl}</a></p>
<p>Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.</p>
<p class="signature">— L'équipe ${APP_NAME}</p>
    `);

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Confirmez votre adresse email pour votre inscription à ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send verification email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Verification email sent to:', toEmail, 'messageId:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending verification email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendCollaboratorInvitationEmail(
  toEmail: string,
  token: string,
  organisationName: string,
  inviterName: string,
  role: string,
  expiresAt: Date
): Promise<EmailResult> {
  try {
    let clientData;
    try {
      clientData = await getUncachableResendClient();
    } catch (credError: any) {
      console.log("[EMAIL] Resend not configured, skipping email:", credError.message);
      return { success: true, messageId: 'skipped-no-resend' };
    }
    const { client, fromEmail } = clientData;
    const inviteUrl = `${getBaseUrl()}/accept-invitation?token=${token}`;
    
    const roleLabel = role === 'ADMIN' ? 'Administrateur' : role === 'CHIRURGIEN' ? 'Chirurgien' : 'Assistant';
    const expiryDate = format(expiresAt, 'dd MMMM yyyy', { locale: fr });
    
    const htmlContent = createSimpleEmailHtml(`
<p>Bonjour,</p>
<p>${inviterName} vous a invité(e) à rejoindre ${organisationName} sur ${APP_NAME} en tant que ${roleLabel}.</p>
<p>Rejoindre le cabinet maintenant : <a href="${inviteUrl}">${inviteUrl}</a></p>
<p>Ce lien expire le ${expiryDate}.</p>
<p>Si vous pensez qu'il s'agit d'une erreur, vous pouvez ignorer cet email.</p>
<p class="signature">— ${APP_NAME}</p>
    `);

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Vous avez été invité(e) à rejoindre ${organisationName} sur ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send invitation email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Invitation email sent to:', toEmail, 'messageId:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending invitation email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendPaymentFailedEmail(
  toEmail: string,
  firstName: string
): Promise<EmailResult> {
  try {
    let clientData;
    try {
      clientData = await getUncachableResendClient();
    } catch (credError: any) {
      console.log("[EMAIL] Resend not configured, skipping email:", credError.message);
      return { success: true, messageId: 'skipped-no-resend' };
    }
    const { client, fromEmail } = clientData;
    const billingUrl = `${getBaseUrl()}/settings?section=billing`;
    
    const htmlContent = createSimpleEmailHtml(`
<p>Bonjour ${firstName},</p>
<p>Nous n'avons pas pu renouveler votre abonnement ${APP_NAME} (paiement refusé).</p>
<p>Afin de conserver votre compte, mettez à jour votre moyen de paiement ici : <a href="${billingUrl}">${billingUrl}</a></p>
<p>Vos données restent accessibles, mais certaines fonctionnalités pourront être limitées si la situation n'est pas régularisée.</p>
<p class="signature">— ${APP_NAME}</p>
    `);

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Action requise — problème de paiement ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send payment failed email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending payment failed email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendTrialEndingEmail(
  toEmail: string,
  firstName: string,
  trialEndDate: Date
): Promise<EmailResult> {
  try {
    let clientData;
    try {
      clientData = await getUncachableResendClient();
    } catch (credError: any) {
      console.log("[EMAIL] Resend not configured, skipping email:", credError.message);
      return { success: true, messageId: 'skipped-no-resend' };
    }
    const { client, fromEmail } = clientData;
    const billingUrl = `${getBaseUrl()}/settings?section=billing`;
    const formattedDate = format(trialEndDate, 'dd MMMM yyyy', { locale: fr });
    
    const htmlContent = createSimpleEmailHtml(`
<p>Bonjour ${firstName},</p>
<p>Votre période d'essai se termine le ${formattedDate}.</p>
<p>Pour conserver l'accès complet à ${APP_NAME}, vous pouvez activer votre abonnement à tout moment.</p>
<p>Gérer mon abonnement maintenant : <a href="${billingUrl}">${billingUrl}</a></p>
<p class="signature">— ${APP_NAME}</p>
    `);

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Votre essai ${APP_NAME} se termine bientôt`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send trial ending email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending trial ending email:', err);
    return { success: false, error: err.message };
  }
}
