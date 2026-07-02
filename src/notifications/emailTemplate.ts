const BRAND_NAME = 'QR Schedule';
const BRAND_GRADIENT = 'linear-gradient(135deg, #6c4cf5, #5636e8)';
const INK = '#1f1a17';
const MUTED = '#6f6760';

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailLayoutInput {
  preheader?: string;
  eyebrow?: string;
  heading: string;
  bodyHtml: string;
  button?: EmailButton;
  footerNote?: string;
}

const renderButton = (button: EmailButton | undefined): string => {
  if (!button) {
    return '';
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px">
      <tr>
        <td style="border-radius:999px;background:${BRAND_GRADIENT}">
          <a href="${button.url}"
             style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;
                    color:#ffffff;text-decoration:none;border-radius:999px;font-family:inherit">
            ${button.label}
          </a>
        </td>
      </tr>
    </table>
  `;
};

export const renderEmailLayout = ({
  preheader = '',
  eyebrow = '',
  heading,
  bodyHtml,
  button,
  footerNote = `You're receiving this email because of activity on your ${BRAND_NAME} account.`
}: EmailLayoutInput): string => `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f2ef;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ef;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;
                        box-shadow:0 12px 32px rgba(31,26,23,0.08)">
            <tr>
              <td style="background:${BRAND_GRADIENT};padding:26px 32px">
                <span style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:-0.02em">
                  ${BRAND_NAME}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px">
                ${eyebrow ? `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;
                              text-transform:uppercase;color:#6c4cf5">${eyebrow}</p>` : ''}
                <h1 style="margin:0 0 14px;font-size:1.4rem;font-weight:800;color:${INK};letter-spacing:-0.02em">
                  ${heading}
                </h1>
                <div style="font-size:0.96rem;line-height:1.6;color:${MUTED}">
                  ${bodyHtml}
                </div>
                ${renderButton(button)}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9c9490">${footerNote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
