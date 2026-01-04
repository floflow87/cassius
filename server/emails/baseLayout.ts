export interface BaseLayoutProps {
  title: string;
  preheader?: string;
  content: string;
}

const COLORS = {
  primary: '#1e40af',
  primaryHover: '#1e3a8a',
  text: '#111827',
  textSecondary: '#6B7280',
  background: '#F9FAFB',
  cardBackground: '#FFFFFF',
  border: '#E5E7EB',
  divider: '#E5E7EB',
};

export function baseLayout({ title, preheader, content }: BaseLayoutProps): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${COLORS.background};
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: ${COLORS.text};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .wrapper {
      width: 100%;
      background-color: ${COLORS.background};
      padding: 40px 20px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
    }
    .card {
      background-color: ${COLORS.cardBackground};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid ${COLORS.divider};
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: ${COLORS.primary};
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .logo-icon {
      display: inline-block;
      width: 28px;
      height: 28px;
      margin-right: 8px;
      vertical-align: middle;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      color: ${COLORS.text};
      margin: 0 0 24px 0;
      line-height: 1.3;
    }
    p {
      font-size: 15px;
      color: ${COLORS.text};
      margin: 0 0 16px 0;
      line-height: 1.7;
    }
    .text-secondary {
      color: ${COLORS.textSecondary};
      font-size: 14px;
    }
    .btn {
      display: inline-block;
      background-color: ${COLORS.primary};
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 6px;
      margin: 24px 0;
      text-align: center;
    }
    .btn:hover {
      background-color: ${COLORS.primaryHover};
    }
    .link-fallback {
      background-color: ${COLORS.background};
      border: 1px solid ${COLORS.border};
      border-radius: 6px;
      padding: 16px;
      margin: 24px 0;
      word-break: break-all;
    }
    .link-fallback p {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: ${COLORS.textSecondary};
    }
    .link-fallback a {
      font-size: 13px;
      color: ${COLORS.primary};
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: ${COLORS.divider};
      margin: 32px 0;
    }
    .footer {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid ${COLORS.divider};
      margin-top: 32px;
    }
    .footer p {
      font-size: 13px;
      color: ${COLORS.textSecondary};
      margin: 0 0 8px 0;
    }
    .footer .signature {
      font-weight: 500;
      color: ${COLORS.text};
      margin-bottom: 16px;
    }
    .footer .legal {
      font-size: 12px;
      color: ${COLORS.textSecondary};
    }
    .info-box {
      background-color: ${COLORS.background};
      border-left: 3px solid ${COLORS.primary};
      padding: 16px;
      margin: 20px 0;
      border-radius: 0 6px 6px 0;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .card {
        padding: 24px;
      }
      h1 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="wrapper">
    <div class="container">
      <div class="card">
        <div class="header">
          <a href="https://cassiuspro.com" class="logo">
            <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="${COLORS.primary}"/>
            </svg>
            Cassius
          </a>
        </div>
        ${content}
        <div class="footer">
          <p class="signature">L'equipe Cassius</p>
          <p class="legal">Cassius - Logiciel de gestion pour implantologues</p>
          <p class="legal">Cet email a ete envoye automatiquement. Merci de ne pas y repondre directement.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export { COLORS };
