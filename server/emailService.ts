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
  // Support custom domain for production
  if (process.env.CUSTOM_DOMAIN) {
    return `https://${process.env.CUSTOM_DOMAIN}`;
  }
  // Production deployment URL (app.cassiuspro.com)
  if (process.env.NODE_ENV === 'production') {
    return 'https://app.cassiuspro.com';
  }
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

function createEmailTemplate(params: {
  title: string;
  content: string;
  actionUrl?: string;
  actionLabel?: string;
  infoBox?: { title: string; lines: string[] };
  warningBox?: { title: string; lines: string[] };
  successBox?: { title: string; lines: string[] };
}): string {
  const { title, content, actionUrl, actionLabel, infoBox, warningBox, successBox } = params;

  let boxHtml = '';
  if (warningBox) {
    boxHtml = `
      <div style="margin:14px 0 18px 0;padding:12px;border-radius:10px;background:#FFF7ED;border:1px solid #FED7AA;color:#7C2D12;">
        <div style="font-weight:700;margin-bottom:6px;">${warningBox.title}</div>
        ${warningBox.lines.map(line => `<div>${line}</div>`).join('')}
      </div>`;
  } else if (successBox) {
    boxHtml = `
      <div style="margin:14px 0 18px 0;padding:12px;border-radius:10px;background:#F0FDF4;border:1px solid #BBF7D0;color:#14532D;">
        <div style="font-weight:700;margin-bottom:6px;">${successBox.title}</div>
        ${successBox.lines.map(line => `<div>${line}</div>`).join('')}
      </div>`;
  } else if (infoBox) {
    boxHtml = `
      <div style="margin-top:14px;padding:12px 12px;border-radius:10px;background:#F8FAFC;border:1px solid #E2E8F0;color:#334155;">
        <div style="font-weight:600;margin-bottom:6px;">${infoBox.title}</div>
        ${infoBox.lines.map(line => `<div>${line}</div>`).join('')}
      </div>`;
  }

  const buttonHtml = actionUrl && actionLabel ? `
      <div style="margin:18px 0 18px 0;">
        <a href="${actionUrl}"
           style="display:inline-block;background:#3C83F6;color:#FFFFFF;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px;">
          ${actionLabel}
        </a>
      </div>` : '';

  const fallbackLinkHtml = actionUrl ? `
      <p style="margin:18px 0 0 0;color:#64748B;font-size:12px;">
        Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
        <span style="word-break:break-all;color:#3C83F6;">${actionUrl}</span>
      </p>` : '';

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#F6F8FB;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0F172A;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden;">
        <div style="padding:22px 22px 8px 22px;">
          <div style="font-size:14px;color:#475569;letter-spacing:0.2px;">Cassius</div>
          <h1 style="margin:10px 0 0 0;font-size:20px;line-height:1.3;color:#0F172A;">
            ${title}
          </h1>
        </div>

        <div style="padding:16px 22px 22px 22px;font-size:14px;line-height:1.7;color:#0F172A;">
          ${content}
          ${boxHtml}
          ${buttonHtml}
          ${fallbackLinkHtml}
        </div>

        <div style="padding:16px 22px;background:#FBFCFE;border-top:1px solid #E5E7EB;">
          <div style="color:#64748B;font-size:12px;line-height:1.6;">
            —<br />
            <b>Cassius</b> — Le compagnon des chirurgiens-dentistes<br />
            Cet email a été envoyé automatiquement, merci de ne pas y répondre.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
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
    
    const htmlContent = createEmailTemplate({
      title: 'Réinitialisation de votre mot de passe',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName || ''},</p>
        <p style="margin:0 0 14px 0;">
          Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte Cassius.
        </p>
        <p style="margin:0 0 18px 0;">
          Pour définir un nouveau mot de passe et sécuriser l'accès à votre espace, cliquez sur le bouton ci-dessous.
        </p>
      `,
      actionUrl: resetUrl,
      actionLabel: 'Réinitialiser mon mot de passe',
      infoBox: {
        title: 'À savoir',
        lines: [
          'Ce lien est valable pendant <b>60 minutes</b>.',
          "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email."
        ]
      }
    });

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
    
    const htmlContent = createEmailTemplate({
      title: 'Confirmez votre adresse email',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName || ''},</p>
        <p style="margin:0 0 14px 0;">
          Bienvenue sur Cassius.
        </p>
        <p style="margin:0 0 18px 0;">
          Afin de finaliser la création de votre compte et sécuriser l'accès à votre espace professionnel,
          nous vous invitons à confirmer votre adresse email.
        </p>
      `,
      actionUrl: verifyUrl,
      actionLabel: 'Confirmer mon adresse email'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Confirmez votre adresse email — ${APP_NAME}`,
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
    
    const htmlContent = createEmailTemplate({
      title: `Invitation à rejoindre ${organisationName}`,
      content: `
        <p style="margin:0 0 14px 0;">Bonjour,</p>
        <p style="margin:0 0 14px 0;">
          <b>${inviterName}</b> vous invite à rejoindre l'organisation <b>${organisationName}</b> sur Cassius.
        </p>
        <p style="margin:0 0 18px 0;">
          Pour accepter l'invitation et accéder à l'espace, cliquez ci-dessous.
        </p>
      `,
      actionUrl: inviteUrl,
      actionLabel: "Accepter l'invitation",
      infoBox: {
        title: 'Sécurité',
        lines: ['Cette invitation est personnelle et valable pour une durée limitée.']
      }
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Invitation à rejoindre ${organisationName} — ${APP_NAME}`,
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

export async function sendISQAlertEmail(
  toEmail: string,
  firstName: string,
  isqValue: number,
  threshold: number,
  contextLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Alerte clinique — stabilité implantaire faible',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">
          Une mesure récente indique une <b>stabilité implantaire inférieure au seuil</b> défini.
        </p>
      `,
      actionUrl,
      actionLabel: "Consulter l'alerte",
      warningBox: {
        title: 'Détail',
        lines: [
          `ISQ mesuré : <b>${isqValue}</b> (seuil : ${threshold})`,
          `Référence : ${contextLabel}`
        ]
      }
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Alerte ISQ faible — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send ISQ alert email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] ISQ alert email sent to:', toEmail, 'messageId:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending ISQ alert email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendImportCompletedEmail(
  toEmail: string,
  firstName: string,
  patientsCount: number,
  implantsCount: number,
  documentsCount: number,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Import terminé',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">
          L'import de vos données dans Cassius est maintenant terminé.
        </p>
      `,
      actionUrl,
      actionLabel: 'Voir les données importées',
      successBox: {
        title: 'Récapitulatif',
        lines: [
          `Patients importés : <b>${patientsCount}</b>`,
          `Implants importés : <b>${implantsCount}</b>`,
          `Documents importés : <b>${documentsCount}</b>`
        ]
      }
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Import terminé — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send import completed email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Import completed email sent to:', toEmail, 'messageId:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending import completed email:', err);
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
    
    const htmlContent = createEmailTemplate({
      title: 'Problème de paiement',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">
          Nous n'avons pas pu renouveler votre abonnement ${APP_NAME} (paiement refusé).
        </p>
        <p style="margin:0 0 18px 0;">
          Afin de conserver votre compte, mettez à jour votre moyen de paiement.
          Vos données restent accessibles, mais certaines fonctionnalités pourront être limitées si la situation n'est pas régularisée.
        </p>
      `,
      actionUrl: billingUrl,
      actionLabel: 'Mettre à jour mon paiement'
    });

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
    
    const htmlContent = createEmailTemplate({
      title: "Votre essai se termine bientôt",
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">
          Votre période d'essai se termine le ${formattedDate}.
        </p>
        <p style="margin:0 0 18px 0;">
          Pour conserver l'accès complet à ${APP_NAME}, vous pouvez activer votre abonnement à tout moment.
        </p>
      `,
      actionUrl: billingUrl,
      actionLabel: 'Gérer mon abonnement'
    });

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

export async function sendNotificationEmail(
  toEmail: string,
  firstName: string,
  title: string,
  body: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title,
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 18px 0;">${body}</p>
      `,
      actionUrl,
      actionLabel: 'Ouvrir dans Cassius'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${title} — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send notification email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Notification email sent to:', toEmail, 'messageId:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending notification email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendDocumentAddedEmail(
  toEmail: string,
  firstName: string,
  docName: string,
  mimeTypeLabel: string,
  actorName: string,
  contextLabel: string,
  tagsLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Document ajouté',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Un document a été ajouté dans Cassius.</p>
      `,
      infoBox: {
        title: 'Détail',
        lines: [
          `Nom : <b>${docName}</b>`,
          `Type : ${mimeTypeLabel}`,
          `Ajouté par : ${actorName}`,
          `Rattaché à : ${contextLabel}`,
          `<span style="margin-top:8px;color:#64748B;font-size:12px;">Tags : ${tagsLabel}</span>`
        ]
      },
      actionUrl,
      actionLabel: 'Ouvrir le document'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Document ajouté — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send document added email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending document added email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendRadiographAddedEmail(
  toEmail: string,
  firstName: string,
  radioTypeLabel: string,
  actorName: string,
  contextLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Radiographie ajoutée',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Une nouvelle radiographie a été ajoutée.</p>
      `,
      infoBox: {
        title: 'Détail',
        lines: [
          `Type : <b>${radioTypeLabel}</b>`,
          `Ajouté par : ${actorName}`,
          `Rattaché à : ${contextLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Voir la radiographie'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Radiographie ajoutée — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send radiograph added email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending radiograph added email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendAppointmentCreatedEmail(
  toEmail: string,
  firstName: string,
  appointmentTitle: string,
  appointmentDateLabel: string,
  appointmentTimeLabel: string,
  actorName: string,
  contextLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Nouveau rendez-vous planifié',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Un rendez-vous a été créé dans votre agenda Cassius.</p>
      `,
      infoBox: {
        title: 'Résumé',
        lines: [
          `Intitulé : <b>${appointmentTitle}</b>`,
          `Date : ${appointmentDateLabel}`,
          `Heure : ${appointmentTimeLabel}`,
          `Créé par : ${actorName}`,
          `Contexte : ${contextLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Voir le rendez-vous'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Nouveau rendez-vous planifié — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send appointment created email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending appointment created email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendPatientUpdatedEmail(
  toEmail: string,
  firstName: string,
  actorName: string,
  changeSummary: string,
  changedAtLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Fiche patient mise à jour',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Une fiche patient a été modifiée dans Cassius.</p>
      `,
      infoBox: {
        title: 'Résumé',
        lines: [
          `Modifié par : <b>${actorName}</b>`,
          `Changement : ${changeSummary}`,
          `Date : ${changedAtLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Voir la fiche'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Fiche patient mise à jour — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send patient updated email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending patient updated email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendAppointmentReminderEmail(
  toEmail: string,
  firstName: string,
  appointmentTitle: string,
  appointmentDateLabel: string,
  appointmentTimeLabel: string,
  locationLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Rappel : rendez-vous à venir',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Ce message est un rappel pour un rendez-vous planifié dans Cassius.</p>
      `,
      infoBox: {
        title: 'Rendez-vous',
        lines: [
          `Intitulé : <b>${appointmentTitle}</b>`,
          `Date : ${appointmentDateLabel}`,
          `Heure : ${appointmentTimeLabel}`,
          `Lieu : ${locationLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Ouvrir dans Cassius'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Rappel : rendez-vous à venir — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send appointment reminder email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending appointment reminder email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendSyncErrorEmail(
  toEmail: string,
  firstName: string,
  errorCount: number,
  lastErrorShort: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Synchronisation Google Calendar : action requise',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Cassius n'a pas pu synchroniser certains rendez-vous avec Google Calendar.</p>
      `,
      warningBox: {
        title: 'Détail',
        lines: [
          `Nombre d'erreurs : <b>${errorCount}</b>`,
          `Dernière erreur : ${lastErrorShort}`
        ]
      },
      actionUrl,
      actionLabel: 'Ouvrir les intégrations'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Synchronisation Google Calendar : action requise — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send sync error email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending sync error email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendFollowupRequiredEmail(
  toEmail: string,
  firstName: string,
  lastFollowupLabel: string,
  thresholdLabel: string,
  contextLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Suivi recommandé',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Un implant n'a pas eu de suivi depuis un certain temps, selon vos règles de notification.</p>
      `,
      infoBox: {
        title: 'Résumé',
        lines: [
          `Dernier suivi : <b>${lastFollowupLabel}</b>`,
          `Seuil : ${thresholdLabel}`,
          `Contexte : ${contextLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Ouvrir dans Cassius'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Suivi recommandé — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send followup required email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending followup required email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendNoRecentVisitEmail(
  toEmail: string,
  firstName: string,
  lastVisitLabel: string,
  thresholdLabel: string,
  contextLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Visite recommandée',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Un patient n'a pas eu de visite récente, selon vos règles de notification.</p>
      `,
      infoBox: {
        title: 'Résumé',
        lines: [
          `Dernière visite : <b>${lastVisitLabel}</b>`,
          `Seuil : ${thresholdLabel}`,
          `Contexte : ${contextLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Ouvrir dans Cassius'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Visite recommandée — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send no recent visit email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending no recent visit email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendFollowupNotPlannedEmail(
  toEmail: string,
  firstName: string,
  surgeryDateLabel: string,
  contextLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Suivi à planifier',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Une chirurgie n'a pas de suivi planifié.</p>
      `,
      infoBox: {
        title: 'Résumé',
        lines: [
          `Date de chirurgie : <b>${surgeryDateLabel}</b>`,
          `Contexte : ${contextLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Planifier un suivi'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Suivi à planifier — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send followup not planned email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending followup not planned email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendNewMemberJoinedEmail(
  toEmail: string,
  firstName: string,
  memberName: string,
  memberRole: string,
  joinedAtLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Nouveau membre dans l\'équipe',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Un nouveau collaborateur a rejoint votre organisation.</p>
      `,
      infoBox: {
        title: 'Détail',
        lines: [
          `Nom : <b>${memberName}</b>`,
          `Rôle : ${memberRole}`,
          `Date : ${joinedAtLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Voir l\'équipe'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Nouveau membre dans l'équipe — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send new member joined email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending new member joined email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendRoleChangedEmail(
  toEmail: string,
  firstName: string,
  memberName: string,
  oldRole: string,
  newRole: string,
  changedByName: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Rôle modifié',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Le rôle d'un membre de l'équipe a été modifié.</p>
      `,
      infoBox: {
        title: 'Détail',
        lines: [
          `Membre : <b>${memberName}</b>`,
          `Ancien rôle : ${oldRole}`,
          `Nouveau rôle : ${newRole}`,
          `Modifié par : ${changedByName}`
        ]
      },
      actionUrl,
      actionLabel: 'Voir l\'équipe'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Rôle modifié — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send role changed email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending role changed email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendInvitationSentEmail(
  toEmail: string,
  firstName: string,
  inviteeEmail: string,
  inviteeRole: string,
  sentByName: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Invitation envoyée',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Une invitation a été envoyée à un nouveau collaborateur.</p>
      `,
      infoBox: {
        title: 'Détail',
        lines: [
          `Email : <b>${inviteeEmail}</b>`,
          `Rôle proposé : ${inviteeRole}`,
          `Envoyée par : ${sentByName}`
        ]
      },
      actionUrl,
      actionLabel: 'Voir les invitations'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Invitation envoyée — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send invitation sent email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending invitation sent email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendImportStartedEmail(
  toEmail: string,
  firstName: string,
  importType: string,
  fileName: string,
  startedAtLabel: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Import démarré',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Un import de données a démarré.</p>
      `,
      infoBox: {
        title: 'Détail',
        lines: [
          `Type : <b>${importType}</b>`,
          `Fichier : ${fileName}`,
          `Démarré le : ${startedAtLabel}`
        ]
      },
      actionUrl,
      actionLabel: 'Suivre l\'import'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Import démarré — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send import started email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending import started email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendImportPartialEmail(
  toEmail: string,
  firstName: string,
  importType: string,
  successCount: number,
  errorCount: number,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Import terminé avec des erreurs',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">L'import s'est terminé avec des erreurs partielles.</p>
      `,
      warningBox: {
        title: 'Résumé',
        lines: [
          `Type : <b>${importType}</b>`,
          `Réussis : ${successCount}`,
          `Erreurs : ${errorCount}`
        ]
      },
      actionUrl,
      actionLabel: 'Voir les détails'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Import terminé avec des erreurs — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send import partial email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending import partial email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendImportFailedEmail(
  toEmail: string,
  firstName: string,
  importType: string,
  errorMessage: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Import échoué',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">L'import a échoué.</p>
      `,
      warningBox: {
        title: 'Détail',
        lines: [
          `Type : <b>${importType}</b>`,
          `Erreur : ${errorMessage}`
        ]
      },
      actionUrl,
      actionLabel: 'Réessayer'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Import échoué — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send import failed email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending import failed email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendEmailErrorEmail(
  toEmail: string,
  firstName: string,
  originalEmailType: string,
  errorMessage: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Erreur d\'envoi d\'email',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Un email n'a pas pu être envoyé.</p>
      `,
      warningBox: {
        title: 'Détail',
        lines: [
          `Type d'email : <b>${originalEmailType}</b>`,
          `Erreur : ${errorMessage}`
        ]
      },
      actionUrl,
      actionLabel: 'Vérifier les paramètres'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Erreur d'envoi d'email — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send email error email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending email error email:', err);
    return { success: false, error: err.message };
  }
}

export async function sendSystemMaintenanceEmail(
  toEmail: string,
  firstName: string,
  maintenanceTitle: string,
  scheduledDateLabel: string,
  durationLabel: string,
  description: string,
  actionUrl: string
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
    
    const htmlContent = createEmailTemplate({
      title: 'Maintenance programmée',
      content: `
        <p style="margin:0 0 14px 0;">Bonjour ${firstName},</p>
        <p style="margin:0 0 14px 0;">Une maintenance système est programmée.</p>
      `,
      infoBox: {
        title: maintenanceTitle,
        lines: [
          `Date : <b>${scheduledDateLabel}</b>`,
          `Durée estimée : ${durationLabel}`,
          `${description}`
        ]
      },
      actionUrl,
      actionLabel: 'Plus d\'informations'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Maintenance programmée — ${APP_NAME}`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send system maintenance email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[Email] Error sending system maintenance email:', err);
    return { success: false, error: err.message };
  }
}
