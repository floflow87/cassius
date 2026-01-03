import { baseLayout } from '../baseLayout';
import { heading, paragraph, infoBox, button, linkFallback } from '../components';

export interface SystemAlertData {
  alertType: 'action_required' | 'payment_failed' | 'trial_ending' | 'subscription_update';
  firstName?: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  expiryInfo?: string;
}

const ALERT_CONFIG = {
  action_required: {
    title: 'Action requise dans Cassius',
  },
  payment_failed: {
    title: 'Probleme de paiement',
  },
  trial_ending: {
    title: 'Votre essai se termine bientot',
  },
  subscription_update: {
    title: 'Mise a jour de votre abonnement',
  },
};

export function systemAlertHtml(data: SystemAlertData): string {
  const config = ALERT_CONFIG[data.alertType];
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  const actionButton = data.actionUrl && data.actionLabel 
    ? `${button(data.actionLabel, data.actionUrl)}${linkFallback(data.actionUrl)}`
    : '';
  
  const expiryInfo = data.expiryInfo 
    ? `<p style="font-size: 13px; color: #6B7280; margin: 16px 0 0 0; font-style: italic;">${data.expiryInfo}</p>`
    : '';
  
  const content = `
    ${heading(config.title)}
    ${paragraph(greeting)}
    ${paragraph(data.message)}
    ${actionButton}
    ${expiryInfo}
  `;
  
  return baseLayout({
    title: `${config.title} - Cassius`,
    preheader: data.message.substring(0, 100),
    content,
  });
}

export function systemAlertText(data: SystemAlertData): string {
  const config = ALERT_CONFIG[data.alertType];
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  const actionLink = data.actionUrl ? `\n${data.actionLabel || 'Lien'} :\n${data.actionUrl}\n` : '';
  const expiryInfo = data.expiryInfo ? `\n${data.expiryInfo}\n` : '';
  
  return `
${config.title.toUpperCase()}
${'='.repeat(config.title.length)}

${greeting}

${data.message}
${actionLink}${expiryInfo}
--
L'equipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
