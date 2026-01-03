import { baseLayout } from '../baseLayout';
import { heading, paragraph, infoBox, button, linkFallback } from '../components';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface SecurityNoticeData {
  type: 'new_login' | 'password_changed' | 'email_changed';
  firstName?: string;
  deviceInfo?: string;
  ipAddress?: string;
  timestamp?: Date;
  securityUrl?: string;
}

const NOTICE_CONFIG = {
  new_login: {
    title: 'Nouvelle connexion detectee',
    description: 'Une nouvelle connexion a ete detectee sur votre compte Cassius.',
  },
  password_changed: {
    title: 'Mot de passe modifie',
    description: 'Votre mot de passe Cassius a ete modifie avec succes.',
  },
  email_changed: {
    title: 'Adresse email modifiee',
    description: 'L\'adresse email associee a votre compte Cassius a ete modifiee.',
  },
};

export function securityNoticeHtml(data: SecurityNoticeData): string {
  const config = NOTICE_CONFIG[data.type];
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  const timestamp = data.timestamp ? format(data.timestamp, "d MMMM yyyy 'a' HH:mm", { locale: fr }) : '';
  
  let details = '';
  if (data.type === 'new_login' && (data.deviceInfo || data.ipAddress || timestamp)) {
    const detailLines = [];
    if (timestamp) detailLines.push(`Date : ${timestamp}`);
    if (data.deviceInfo) detailLines.push(`Appareil : ${data.deviceInfo}`);
    if (data.ipAddress) detailLines.push(`Adresse IP : ${data.ipAddress}`);
    details = infoBox(detailLines.join('<br>'));
  }
  
  const securityButton = data.securityUrl 
    ? `${button('Verifier mon compte', data.securityUrl)}${linkFallback(data.securityUrl, 'Lien de securite :')}`
    : '';
  
  const content = `
    ${heading(config.title)}
    ${paragraph(greeting)}
    ${paragraph(config.description)}
    ${details}
    ${paragraph('Si vous n\'etes pas a l\'origine de cette action, veuillez securiser votre compte immediatement.', true)}
    ${securityButton}
  `;
  
  return baseLayout({
    title: `${config.title} - Cassius`,
    preheader: config.description,
    content,
  });
}

export function securityNoticeText(data: SecurityNoticeData): string {
  const config = NOTICE_CONFIG[data.type];
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  const timestamp = data.timestamp ? format(data.timestamp, "d MMMM yyyy 'a' HH:mm", { locale: fr }) : '';
  
  let details = '';
  if (data.type === 'new_login' && (data.deviceInfo || data.ipAddress || timestamp)) {
    details = '\nDetails :\n';
    if (timestamp) details += `- Date : ${timestamp}\n`;
    if (data.deviceInfo) details += `- Appareil : ${data.deviceInfo}\n`;
    if (data.ipAddress) details += `- Adresse IP : ${data.ipAddress}\n`;
  }
  
  const securityLink = data.securityUrl ? `\nVerifiez votre compte :\n${data.securityUrl}\n` : '';
  
  return `
${config.title.toUpperCase()}
${'='.repeat(config.title.length)}

${greeting}

${config.description}
${details}
Si vous n'etes pas a l'origine de cette action, veuillez securiser votre compte immediatement.
${securityLink}
--
L'equipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
