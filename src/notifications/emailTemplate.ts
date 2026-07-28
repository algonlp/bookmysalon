const BRAND_NAME = 'QR Schedule';
const BRAND_GRADIENT = 'linear-gradient(135deg, #6c4cf5, #5636e8)';
const PROMO_GRADIENT = 'linear-gradient(135deg, #6c4cf5 0%, #8b5cf6 55%, #a855f7 100%)';
const INK = '#1f1a17';
const MUTED = '#6f6760';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

export interface MarketingEmailInput {
  preheader?: string;
  businessName: string;
  offerBadge: string;
  headline: string;
  bodyHtml: string;
  originalPrice?: string;
  discountedPrice?: string;
  happyHourWindow?: string;
  ctaUrl: string;
  ctaLabel: string;
  footerNote?: string;
}

// A bold, promotional marketing email (used for campaign blasts). bodyHtml is
// treated as trusted HTML; all other text fields are escaped here.
export const renderMarketingEmail = ({
  preheader = '',
  businessName,
  offerBadge,
  headline,
  bodyHtml,
  originalPrice = '',
  discountedPrice = '',
  happyHourWindow = '',
  ctaUrl,
  ctaLabel,
  footerNote = ''
}: MarketingEmailInput): string => {
  const priceBox =
    originalPrice && discountedPrice
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px">
          <tr>
            <td style="padding:16px 20px;border:1px solid #ece8fb;border-radius:14px;background:#faf8ff">
              <span style="font-size:14px;color:#9c9490;text-decoration:line-through">${escapeHtml(originalPrice)}</span>
              <span style="font-size:22px;font-weight:900;color:#1f8a4c;margin-left:12px">${escapeHtml(discountedPrice)}</span>
            </td>
          </tr>
        </table>`
      : '';

  const happyHourChip = happyHourWindow
    ? `<p style="margin:18px 0 0">
         <span style="display:inline-block;padding:7px 15px;border-radius:999px;background:#f3efff;
                      color:#6c4cf5;font-size:13px;font-weight:700">🕐 Happy hour ${escapeHtml(happyHourWindow)}</span>
       </p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1eefb;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1eefb;padding:30px 14px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden;
                        box-shadow:0 18px 42px rgba(76,45,168,0.18)">
            <tr>
              <td style="background:${PROMO_GRADIENT};padding:36px 32px;text-align:center">
                <p style="margin:0 0 16px;color:rgba(255,255,255,0.86);font-size:13px;font-weight:700;
                          letter-spacing:0.16em;text-transform:uppercase">${escapeHtml(businessName)}</p>
                <span style="display:inline-block;padding:7px 16px;border-radius:999px;background:rgba(255,255,255,0.2);
                             color:#ffffff;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase">
                  ✨ Exclusive offer
                </span>
                <h1 style="margin:18px 0 0;color:#ffffff;font-size:34px;font-weight:900;letter-spacing:-0.02em;line-height:1.1">
                  ${escapeHtml(offerBadge)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px">
                <h2 style="margin:0 0 14px;font-size:20px;font-weight:800;color:${INK};letter-spacing:-0.01em">
                  ${escapeHtml(headline)}
                </h2>
                <div style="font-size:15px;line-height:1.65;color:${MUTED}">
                  ${bodyHtml}
                </div>
                ${priceBox}
                ${happyHourChip}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px">
                  <tr>
                    <td style="border-radius:999px;background:${PROMO_GRADIENT}">
                      <a href="${ctaUrl}"
                         style="display:inline-block;padding:16px 38px;font-size:16px;font-weight:800;
                                color:#ffffff;text-decoration:none;border-radius:999px;font-family:inherit">
                        ${escapeHtml(ctaLabel)}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 30px">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9c9490">${escapeHtml(footerNote)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#b7b0a8">Powered by ${BRAND_NAME}</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};
