import { Resend } from 'resend';

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
    fromEmail: fromEmail || 'noreply@cassius.app'
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

export async function sendPasswordResetEmail(
  toEmail: string,
  token: string,
  userName?: string
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
    
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${APP_NAME} - Réinitialisation de votre mot de passe`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #64748b; font-size: 13px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">${APP_NAME}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Gestion de cabinet dentaire</p>
  </div>
  <div class="content">
    <h2 style="color: #1e40af; margin-top: 0;">Réinitialisation de mot de passe</h2>
    <p>Bonjour${userName ? ` ${userName}` : ''},</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ${APP_NAME}.</p>
    <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button" style="color: white;">Réinitialiser mon mot de passe</a>
    </p>
    <div class="warning">
      <strong>Important :</strong> Ce lien expire dans 1 heure pour des raisons de sécurité. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
    </div>
    <p style="color: #64748b; font-size: 13px;">
      Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
      <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>
  <div class="footer">
    <p>Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Merci de ne pas y répondre directement.</p>
  </div>
</body>
</html>
      `.trim(),
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
  userName?: string
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
    
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${APP_NAME} - Confirmez votre adresse email`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #64748b; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">${APP_NAME}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Gestion de cabinet dentaire</p>
  </div>
  <div class="content">
    <h2 style="color: #1e40af; margin-top: 0;">Confirmez votre adresse email</h2>
    <p>Bonjour${userName ? ` ${userName}` : ''},</p>
    <p>Bienvenue sur ${APP_NAME} ! Pour activer pleinement votre compte et accéder à toutes les fonctionnalités, veuillez confirmer votre adresse email.</p>
    <p style="text-align: center;">
      <a href="${verifyUrl}" class="button" style="color: white;">Confirmer mon email</a>
    </p>
    <p style="color: #64748b; font-size: 13px;">
      Ce lien expire dans 24 heures. Si le bouton ne fonctionne pas, copiez ce lien :<br>
      <a href="${verifyUrl}" style="color: #3b82f6; word-break: break-all;">${verifyUrl}</a>
    </p>
  </div>
  <div class="footer">
    <p>Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Merci de ne pas y répondre directement.</p>
  </div>
</body>
</html>
      `.trim(),
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
  role: string
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
    
    const roleDisplay = role === 'ADMIN' ? 'Administrateur' : role === 'CHIRURGIEN' ? 'Chirurgien' : 'Assistant';
    
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${APP_NAME} - Invitation à rejoindre ${organisationName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #64748b; font-size: 13px; }
    .info-box { background: #eff6ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">${APP_NAME}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Gestion de cabinet dentaire</p>
  </div>
  <div class="content">
    <h2 style="color: #1e40af; margin-top: 0;">Vous êtes invité(e) !</h2>
    <p>Bonjour,</p>
    <p><strong>${inviterName}</strong> vous invite à rejoindre le cabinet <strong>${organisationName}</strong> sur ${APP_NAME}.</p>
    <div class="info-box">
      <p style="margin: 0;"><strong>Rôle proposé :</strong> ${roleDisplay}</p>
    </div>
    <p>${APP_NAME} est une plateforme de gestion complète pour les cabinets d'implantologie dentaire, permettant de suivre les patients, les actes chirurgicaux et les implants.</p>
    <p style="text-align: center;">
      <a href="${inviteUrl}" class="button" style="color: white;">Accepter l'invitation</a>
    </p>
    <p style="color: #64748b; font-size: 13px;">
      Cette invitation expire dans 7 jours. Si le bouton ne fonctionne pas, copiez ce lien :<br>
      <a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a>
    </p>
  </div>
  <div class="footer">
    <p>Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Si vous n'attendiez pas cette invitation, vous pouvez l'ignorer.</p>
  </div>
</body>
</html>
      `.trim(),
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
  userName: string,
  organisationName: string,
  amount: string
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
    
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${APP_NAME} - Problème avec votre paiement`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #64748b; font-size: 13px; }
    .warning { background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">${APP_NAME}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Attention requise</p>
  </div>
  <div class="content">
    <h2 style="color: #dc2626; margin-top: 0;">Échec du paiement</h2>
    <p>Bonjour ${userName},</p>
    <p>Nous n'avons pas pu traiter le paiement de ${amount} pour votre abonnement ${APP_NAME} pour le cabinet <strong>${organisationName}</strong>.</p>
    <div class="warning">
      <strong>Action requise :</strong> Veuillez mettre à jour vos informations de paiement pour éviter toute interruption de service.
    </div>
    <p style="text-align: center;">
      <a href="${billingUrl}" class="button" style="color: white;">Mettre à jour le paiement</a>
    </p>
    <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
  </div>
  <div class="footer">
    <p>Cet email a été envoyé automatiquement par ${APP_NAME}.</p>
  </div>
</body>
</html>
      `.trim(),
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
  userName: string,
  organisationName: string,
  daysRemaining: number
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
    
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${APP_NAME} - Votre période d'essai se termine dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #64748b; font-size: 13px; }
    .info-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">${APP_NAME}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Rappel important</p>
  </div>
  <div class="content">
    <h2 style="color: #f59e0b; margin-top: 0;">Fin de période d'essai</h2>
    <p>Bonjour ${userName},</p>
    <p>Votre période d'essai gratuite de ${APP_NAME} pour le cabinet <strong>${organisationName}</strong> se termine dans <strong>${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}</strong>.</p>
    <div class="info-box">
      Pour continuer à utiliser ${APP_NAME} et conserver toutes vos données, veuillez souscrire à un abonnement avant la fin de votre essai.
    </div>
    <p style="text-align: center;">
      <a href="${billingUrl}" class="button" style="color: white;">Choisir un abonnement</a>
    </p>
    <p>Nous espérons que ${APP_NAME} vous aide dans la gestion de votre cabinet !</p>
  </div>
  <div class="footer">
    <p>Cet email a été envoyé automatiquement par ${APP_NAME}.</p>
  </div>
</body>
</html>
      `.trim(),
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

export async function sendAccountRestrictedEmail(
  toEmail: string,
  userName: string,
  organisationName: string,
  reason: string
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
    
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${APP_NAME} - Accès restreint à votre compte`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #64748b; font-size: 13px; }
    .warning { background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">${APP_NAME}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Action requise</p>
  </div>
  <div class="content">
    <h2 style="color: #dc2626; margin-top: 0;">Compte restreint</h2>
    <p>Bonjour ${userName},</p>
    <p>L'accès à votre compte ${APP_NAME} pour le cabinet <strong>${organisationName}</strong> a été restreint.</p>
    <div class="warning">
      <strong>Raison :</strong> ${reason}
    </div>
    <p>Vos données sont préservées et seront à nouveau accessibles dès que la situation sera régularisée.</p>
    <p style="text-align: center;">
      <a href="${billingUrl}" class="button" style="color: white;">Régulariser mon compte</a>
    </p>
    <p>Si vous pensez qu'il s'agit d'une erreur, veuillez nous contacter.</p>
  </div>
  <div class="footer">
    <p>Cet email a été envoyé automatiquement par ${APP_NAME}.</p>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error('[Email] Failed to send account restricted email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending account restricted email:', err);
    return { success: false, error: err.message };
  }
}
