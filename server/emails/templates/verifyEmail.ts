import { baseLayout } from '../baseLayout';
import { button, linkFallback, heading, paragraph, expiryNotice } from '../components';

export interface VerifyEmailData {
  verifyUrl: string;
  firstName?: string;
}

export function verifyEmailHtml(data: VerifyEmailData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  const content = `
    ${heading('Confirmez votre adresse email')}
    ${paragraph(greeting)}
    ${paragraph('Bienvenue sur Cassius ! Pour finaliser votre inscription, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.')}
    ${button('Confirmer mon email', data.verifyUrl)}
    ${linkFallback(data.verifyUrl)}
    ${expiryNotice('Ce lien expire dans 24 heures.')}
  `;
  
  return baseLayout({
    title: 'Confirmez votre adresse email - Cassius',
    preheader: 'Confirmez votre adresse email pour activer votre compte Cassius',
    content,
  });
}

export function verifyEmailText(data: VerifyEmailData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  return `
CONFIRMEZ VOTRE ADRESSE EMAIL
=============================

${greeting}

Bienvenue sur Cassius ! Pour finaliser votre inscription, veuillez confirmer votre adresse email.

Cliquez sur le lien ci-dessous :
${data.verifyUrl}

Ce lien expire dans 24 heures.

--
L'equipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
