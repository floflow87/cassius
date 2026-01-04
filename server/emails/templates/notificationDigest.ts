import { baseLayout } from '../baseLayout';
import { heading, paragraph, button, linkFallback } from '../components';

interface NotificationItem {
  title: string;
  body?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entityType?: string;
  createdAt: string;
}

export interface NotificationDigestData {
  firstName?: string;
  periodLabel: string;
  notifications: NotificationItem[];
  dashboardUrl: string;
}

const SEVERITY_STYLES = {
  INFO: {
    bg: '#F0F9FF',
    border: '#0EA5E9',
    text: '#0C4A6E',
  },
  WARNING: {
    bg: '#FFFBEB',
    border: '#F59E0B',
    text: '#78350F',
  },
  CRITICAL: {
    bg: '#FEF2F2',
    border: '#EF4444',
    text: '#7F1D1D',
  },
};

function notificationCard(item: NotificationItem): string {
  const style = SEVERITY_STYLES[item.severity];
  return `
    <div style="background-color: ${style.bg}; border-left: 4px solid ${style.border}; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: ${style.text}; font-size: 14px;">${item.title}</p>
      ${item.body ? `<p style="margin: 0; color: #4B5563; font-size: 13px;">${item.body}</p>` : ''}
      <p style="margin: 8px 0 0 0; font-size: 11px; color: #9CA3AF;">${item.createdAt}</p>
    </div>
  `;
}

export function notificationDigestHtml(data: NotificationDigestData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  const criticalCount = data.notifications.filter(n => n.severity === 'CRITICAL').length;
  const warningCount = data.notifications.filter(n => n.severity === 'WARNING').length;
  
  let summaryText = `Voici le resume de vos ${data.notifications.length} notifications`;
  if (criticalCount > 0) {
    summaryText += ` dont ${criticalCount} critique${criticalCount > 1 ? 's' : ''}`;
  }
  if (warningCount > 0) {
    summaryText += ` et ${warningCount} avertissement${warningCount > 1 ? 's' : ''}`;
  }
  summaryText += '.';
  
  const notificationsList = data.notifications
    .slice(0, 10)
    .map(notificationCard)
    .join('');
  
  const moreNotifications = data.notifications.length > 10
    ? `<p style="text-align: center; color: #6B7280; font-size: 13px; margin: 16px 0;">Et ${data.notifications.length - 10} autres notifications...</p>`
    : '';
  
  const content = `
    ${heading(`Resume des notifications - ${data.periodLabel}`)}
    ${paragraph(greeting)}
    ${paragraph(summaryText)}
    <div style="margin: 24px 0;">
      ${notificationsList}
      ${moreNotifications}
    </div>
    ${button('Voir toutes les notifications', data.dashboardUrl)}
    ${linkFallback(data.dashboardUrl)}
  `;
  
  return baseLayout({
    title: `Resume des notifications - Cassius`,
    preheader: summaryText,
    content,
  });
}

export function notificationDigestText(data: NotificationDigestData): string {
  const greeting = data.firstName ? `Bonjour ${data.firstName},` : 'Bonjour,';
  
  const notificationsList = data.notifications
    .slice(0, 10)
    .map((n, i) => `${i + 1}. [${n.severity}] ${n.title}${n.body ? '\n   ' + n.body : ''}`)
    .join('\n\n');
  
  const moreNotifications = data.notifications.length > 10
    ? `\n\n...et ${data.notifications.length - 10} autres notifications`
    : '';
  
  return `
RESUME DES NOTIFICATIONS - ${data.periodLabel.toUpperCase()}
${'='.repeat(50)}

${greeting}

Voici le resume de vos ${data.notifications.length} notifications.

${notificationsList}${moreNotifications}

Voir toutes les notifications :
${data.dashboardUrl}

--
L'equipe Cassius
Cassius - Logiciel de gestion pour implantologues
  `.trim();
}
