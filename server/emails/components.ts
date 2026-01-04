import { COLORS } from './baseLayout';

export function button(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td>
          <a href="${url}" class="btn" style="display: inline-block; background-color: ${COLORS.primary}; color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 6px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function linkFallback(url: string, label?: string): string {
  return `
    <div class="link-fallback" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; margin: 24px 0; word-break: break-all;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280;">${label || 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :'}</p>
      <a href="${url}" style="font-size: 13px; color: ${COLORS.primary}; text-decoration: none;">${url}</a>
    </div>
  `;
}

export function infoBox(content: string): string {
  return `
    <div class="info-box" style="background-color: #F9FAFB; border-left: 3px solid ${COLORS.primary}; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; font-size: 14px;">${content}</p>
    </div>
  `;
}

export function divider(): string {
  return '<div class="divider" style="height: 1px; background-color: #E5E7EB; margin: 32px 0;"></div>';
}

export function paragraph(text: string, secondary?: boolean): string {
  const color = secondary ? COLORS.textSecondary : COLORS.text;
  const fontSize = secondary ? '14px' : '15px';
  return `<p style="font-size: ${fontSize}; color: ${color}; margin: 0 0 16px 0; line-height: 1.7;">${text}</p>`;
}

export function heading(text: string): string {
  return `<h1 style="font-size: 22px; font-weight: 600; color: ${COLORS.text}; margin: 0 0 24px 0; line-height: 1.3;">${text}</h1>`;
}

export function expiryNotice(text: string): string {
  return `
    <p style="font-size: 13px; color: #6B7280; margin: 16px 0 0 0; font-style: italic;">
      ${text}
    </p>
  `;
}
