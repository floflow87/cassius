import { baseLayout } from '../baseLayout';
import { button, linkFallback, heading, paragraph, expiryNotice } from '../components';

export interface ResetPasswordData {
  resetUrl: string;
  firstName?: string;
}

export function resetPasswordHtml(data: ResetPasswordData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  const content = `
    ${heading('Reinitialisation de votre mot de passe')}
    ${paragraph(greeting)}
    ${paragraph('Vous avez demande la reinitialisation de votre mot de passe Cassius. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.')}
    ${button('Reinitialiser mon mot de passe', data.resetUrl)}
    ${linkFallback(data.resetUrl)}
    ${expiryNotice('Ce lien expire dans 60 minutes. Si vous n\'avez pas demande cette reinitialisation, ignorez cet email.')}
  `;
  
  return baseLayout({
    title: 'Reinitialisation de votre mot de passe - Cassius',
    preheader: 'Reinitialisation de votre mot de passe Cassius',
    content,
  });
}

export function resetPasswordText(data: ResetPasswordData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  return `
REINITIALISATION DE VOTRE MOT DE PASSE
======================================

${greeting}

Vous avez demande la reinitialisation de votre mot de passe Cassius.

Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :
${data.resetUrl}

Ce lien expire dans 60 minutes.

Si vous n'avez pas demande cette reinitialisation, ignorez cet email.

--
L'equipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
