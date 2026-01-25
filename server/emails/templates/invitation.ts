import { baseLayout } from '../baseLayout';
import { buttonCentered, linkFallback, heading, paragraph, infoBox, expiryNotice } from '../components';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface InvitationData {
  inviteUrl: string;
  organisationName: string;
  inviterName: string;
  role: string;
  expiresAt: Date;
  inviteeFirstName?: string;
  inviteeLastName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  CHIRURGIEN: 'Chirurgien',
  ASSISTANT: 'Assistant',
};

export function invitationHtml(data: InvitationData): string {
  const roleLabel = ROLE_LABELS[data.role] || data.role;
  const expiryDate = format(data.expiresAt, "d MMMM yyyy", { locale: fr });
  const inviteeName = [data.inviteeFirstName, data.inviteeLastName].filter(Boolean).join(' ') || '';
  const greeting = inviteeName ? `Bonjour ${inviteeName},` : 'Bonjour,';
  
  const content = `
    ${heading(`Invitation à rejoindre ${data.organisationName}`)}
    ${paragraph(greeting)}
    ${paragraph(`<strong>${data.inviterName}</strong> vous invite à rejoindre <strong>${data.organisationName}</strong> sur Cassius.`)}
    ${infoBox(`Rôle proposé : <strong>${roleLabel}</strong>`)}
    ${paragraph("Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.")}
    ${buttonCentered("Accepter l'invitation", data.inviteUrl)}
    ${linkFallback(data.inviteUrl)}
    ${expiryNotice(`Cette invitation expire le ${expiryDate}.`)}
  `;
  
  return baseLayout({
    title: `Invitation à rejoindre ${data.organisationName} - Cassius`,
    preheader: `${data.inviterName} vous invite à rejoindre ${data.organisationName} sur Cassius`,
    content,
  });
}

export function invitationText(data: InvitationData): string {
  const roleLabel = ROLE_LABELS[data.role] || data.role;
  const expiryDate = format(data.expiresAt, "d MMMM yyyy", { locale: fr });
  const inviteeName = [data.inviteeFirstName, data.inviteeLastName].filter(Boolean).join(' ') || '';
  const greeting = inviteeName ? `Bonjour ${inviteeName},` : 'Bonjour,';
  
  return `
INVITATION À REJOINDRE ${data.organisationName.toUpperCase()}
${'='.repeat(25 + data.organisationName.length)}

${greeting}

${data.inviterName} vous invite à rejoindre ${data.organisationName} sur Cassius.

Rôle proposé : ${roleLabel}

Cliquez sur le lien ci-dessous pour accepter l'invitation :
${data.inviteUrl}

Cette invitation expire le ${expiryDate}.

--
L'équipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
