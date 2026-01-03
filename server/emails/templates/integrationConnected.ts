import { baseLayout } from '../baseLayout';
import { heading, paragraph, infoBox, button, linkFallback } from '../components';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface IntegrationConnectedData {
  integrationName: string;
  firstName?: string;
  connectedAt?: Date;
  settingsUrl?: string;
}

const INTEGRATION_LABELS: Record<string, string> = {
  'google_calendar': 'Google Calendar',
  'google-calendar': 'Google Calendar',
};

export function integrationConnectedHtml(data: IntegrationConnectedData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  const integrationLabel = INTEGRATION_LABELS[data.integrationName] || data.integrationName;
  const connectedDate = data.connectedAt 
    ? format(data.connectedAt, "d MMMM yyyy 'a' HH:mm", { locale: fr }) 
    : '';
  
  const dateInfo = connectedDate ? infoBox(`Connecte le ${connectedDate}`) : '';
  
  const settingsButton = data.settingsUrl 
    ? `${button('Gerer mes integrations', data.settingsUrl)}${linkFallback(data.settingsUrl, 'Acces aux parametres :')}`
    : '';
  
  const content = `
    ${heading(`${integrationLabel} connecte`)}
    ${paragraph(greeting)}
    ${paragraph(`L'integration <strong>${integrationLabel}</strong> a ete connectee avec succes a votre compte Cassius.`)}
    ${dateInfo}
    ${paragraph('Vos rendez-vous seront desormais synchronises automatiquement.')}
    ${settingsButton}
  `;
  
  return baseLayout({
    title: `${integrationLabel} connecte - Cassius`,
    preheader: `L'integration ${integrationLabel} a ete connectee a votre compte Cassius`,
    content,
  });
}

export function integrationConnectedText(data: IntegrationConnectedData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  const integrationLabel = INTEGRATION_LABELS[data.integrationName] || data.integrationName;
  const connectedDate = data.connectedAt 
    ? format(data.connectedAt, "d MMMM yyyy 'a' HH:mm", { locale: fr }) 
    : '';
  
  const dateInfo = connectedDate ? `\nConnecte le ${connectedDate}\n` : '';
  const settingsLink = data.settingsUrl ? `\nGerer mes integrations :\n${data.settingsUrl}\n` : '';
  
  return `
${integrationLabel.toUpperCase()} CONNECTE
${'='.repeat(integrationLabel.length + 10)}

${greeting}

L'integration ${integrationLabel} a ete connectee avec succes a votre compte Cassius.
${dateInfo}
Vos rendez-vous seront desormais synchronises automatiquement.
${settingsLink}
--
L'equipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
