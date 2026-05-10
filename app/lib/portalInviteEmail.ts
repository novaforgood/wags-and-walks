/** Invite email for Apps Script `send_single_email` — plain `body` + HTML for Gmail-friendly layout. */

export const PORTAL_INVITE_SUBJECT =
  'Invitation to Access the Wags & Walks Foster Portal'

/** Brand teal — `globals.css` `--color-teal-normal` */
const BRAND = '#05aaaf'
const TEXT = '#1a1a1a'

export function buildPortalInviteEmail(input: { signupUrl: string }): string {
  return [
    'Hello,',
    '',
    'You have been granted access to the Wags & Walks Foster Portal, our internal platform used to support foster coordination, communication, and animal care operations.',
    '',
    'To activate your account, please use the link below and complete your registration using this email address:',
    '',
    input.signupUrl,
    '',
    'For security purposes, this invitation is intended only for the recipient of this email. If you received this message in error or were not expecting an invitation, please disregard this email.',
    '',
    'We are grateful for your support of Wags & Walks and look forward to working together to help dogs find safe and loving homes.',
    '',
    'Warm regards,',
    'Wags & Walks Foster Team',
  ].join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML version: same copy as plain text, minimal styling. */
export function buildPortalInviteEmailHtml(input: { signupUrl: string }): string {
  const url = escapeHtml(input.signupUrl)
  const subjectEsc = escapeHtml(PORTAL_INVITE_SUBJECT)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subjectEsc}</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f7f7f7;font-family:'Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${TEXT};font-size:15px;line-height:1.6;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:8px;padding:28px 28px 32px 28px;">
<tr><td>
<p style="margin:0 0 16px 0;">Hello,</p>
<p style="margin:0 0 16px 0;">You have been granted access to the Wags &amp; Walks Foster Portal, our internal platform used to support foster coordination, communication, and animal care operations.</p>
<p style="margin:0 0 16px 0;">To activate your account, please use the link below and complete your registration using this email address:</p>
<p style="margin:0 0 20px 0;"><a href="${url}" style="color:${BRAND};font-weight:600;">${url}</a></p>
<p style="margin:0 0 16px 0;">For security purposes, this invitation is intended only for the recipient of this email. If you received this message in error or were not expecting an invitation, please disregard this email.</p>
<p style="margin:0 0 16px 0;">We are grateful for your support of Wags &amp; Walks and look forward to working together to help dogs find safe and loving homes.</p>
<p style="margin:0;">Warm regards,<br>Wags &amp; Walks Foster Team</p>
</td></tr>
</table>
</body>
</html>`
}
