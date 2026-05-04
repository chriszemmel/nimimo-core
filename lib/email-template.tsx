export function createMagicLinkEmail(params: {
  url: string
  host: string
  email: string
}) {
  const { host } = params

  // Parse the original URL to extract token and email
  const originalUrl = new URL(params.url)
  const token = originalUrl.searchParams.get("token")
  const email = originalUrl.searchParams.get("email")

  // Build new URL that goes to NextAuth callback but redirects to verify page
  const callbackUrl = `${originalUrl.origin}/auth/verify`
  const magicLinkUrl = `${originalUrl.origin}/api/auth/callback/email?token=${token}&email=${encodeURIComponent(email || "")}&callbackUrl=${encodeURIComponent(callbackUrl)}`

  const escapedHost = host.replace(/\./g, "&#8203;.")

  const _brandColor = "#4A90E2"
  const _backgroundColor = "#0B1220"
  const _cardBackground = "#F4F7FB"
  const _textColor = "#1a1a1a"

  return {
    subject: `Sign in to ${host}`,
    html: html({ url: magicLinkUrl, host: escapedHost }),
    text: text({ url: magicLinkUrl, host }),
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function html(params: { url: string; host: string }) {
  const { url: rawUrl, host } = params
  const url = escapeHtml(rawUrl)

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Inter", "Segoe UI", sans-serif; mso-line-height-rule: exactly;}
  </style>
  <![endif]-->
  <title>Sign in to nimimo</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      word-break: break-word;
      -webkit-font-smoothing: antialiased;
      background-color: #0B1220;
    }
    
    .button {
      display: inline-block;
      background-color: #4A90E2;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      line-height: 24px;
      text-align: center;
    }
    
    .button:hover {
      background-color: #357ABD;
    }
    
    @media (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #0B1220;">
  <div role="article" aria-roledescription="email" aria-label="Sign in to nimimo" lang="en">
    <table style="width: 100%; font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="background-color: #0B1220; padding: 40px 16px;">
          <table class="container" style="width: 600px; max-width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
            <!-- Logo and Header -->
            <tr>
              <td align="center" style="padding-bottom: 32px;">
                <!-- Updated to use absolute URL from nimimo.com domain -->
                <img src="https://www.nimimo.com/email-logo.png" alt="nimimo" width="64" height="64" style="display: block; margin: 0 auto 16px;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.2;">
                  nimimo
                </h1>
              </td>
            </tr>
            
            <!-- Main Card -->
            <tr>
              <td style="background-color: #F4F7FB; border-radius: 16px; padding: 48px 40px;">
                <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M22 6l-10 7L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">
                        Sign in to nimimo
                      </h2>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 32px;">
                      <p style="margin: 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                        Click the button below to securely sign in to your account. This link will expire in 24 hours.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 32px;">
                      <a href="${url}" class="button" style="display: inline-block; background-color: #4A90E2; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; line-height: 24px;">
                        Sign In to nimimo
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
                      <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.5;">
                        If you didn't request this email, you can safely ignore it. The link will expire automatically.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top: 32px;">
                <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.5;">
                  © ${new Date().getFullYear()} nimimo. All rights reserved.
                </p>
                <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">
                  ${host}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`
}

function text(params: { url: string; host: string }) {
  const { url, host } = params
  return `Sign in to nimimo\n\nClick the link below to sign in to ${host}:\n\n${url}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this email, you can safely ignore it.\n\n© ${new Date().getFullYear()} nimimo. All rights reserved.`
}
