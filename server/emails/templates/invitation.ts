import { baseLayout } from '../baseLayout';
import { button, linkFallback, heading, paragraph, infoBox, expiryNotice } from '../components';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface InvitationData {
  inviteUrl: string;
  organisationName: string;
  inviterName: string;
  role: string;
  expiresAt: Date;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  CHIRURGIEN: 'Chirurgien',
  ASSISTANT: 'Assistant',
};

export function invitationHtml(data: InvitationData): string {
  const roleLabel = ROLE_LABELS[data.role] || data.role;
  const expiryDate = format(data.expiresAt, "d MMMM yyyy", { locale: fr });
  
  const content = `
    ${heading('Invitation a rejoindre ${data.organisationName}')}
    ${paragraph('Bonjour,')}
    ${paragraph(`<strong>${data.inviterName}</strong> vous invite a rejoindre <strong>${data.organisationName}</strong> sur Cassius.`)}
    ${infoBox(`Role propose : <strong>${roleLabel}</strong>`)}
    ${paragraph('Cliquez sur le bouton ci-dessous pour accepter l\'invitation et creer votre compte.')}
    ${button('Accepter l\'invitation', data.inviteUrl)}
    ${linkFallback(data.inviteUrl)}
    ${expiryNotice(`Cette invitation expire le ${expiryDate}.`)}
  `;
  
  return baseLayout({
    title: `Invitation a rejoindre ${data.organisationName} - Cassius`,
    preheader: `${data.inviterName} vous invite a rejoindre ${data.organisationName} sur Cassius`,
    content,
  });
}

export function invitationText(data: InvitationData): string {
  const roleLabel = ROLE_LABELS[data.role] || data.role;
  const expiryDate = format(data.expiresAt, "d MMMM yyyy", { locale: fr });
  
  return `
INVITATION A REJOINDRE ${data.organisationName.toUpperCase()}
${'='.repeat(25 + data.organisationName.length)}

Bonjour,

${data.inviterName} vous invite a rejoindre ${data.organisationName} sur Cassius.

Role propose : ${roleLabel}

Cliquez sur le lien ci-dessous pour accepter l'invitation :
${data.inviteUrl}

Cette invitation expire le ${expiryDate}.

--
L'equipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
