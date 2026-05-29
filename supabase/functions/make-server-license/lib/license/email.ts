// Transactional license emails via Resend.
//
// Sends from the already-verified contact.fastoosh.com domain. Three templates:
//   1. license delivery (on purchase.completed)
//   2. subscription past-due (on subscription.past_due)
//   3. license revoked (on refund / manual revoke)
//
// Each builder returns { subject, html, text } so the template and the sending
// are decoupled and testable. Styling mirrors the site's existing dark emails.

import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Fastoosh Licenses <licenses@contact.fastoosh.com>';
const SUPPORT_URL = 'https://fastoosh.com/contact';
const YEAR = new Date().getFullYear();

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// Shared dark-email shell matching the site's other transactional emails.
function shell(bodyHtml: string): string {
  return `
  <div style="background:#0a0a0a;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid #262629;border-radius:16px;overflow:hidden;">
      <div style="padding:28px 32px 8px;">
        <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Fastoosh</span>
      </div>
      <div style="padding:8px 32px 32px;color:#d4d4d8;font-size:14px;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:18px 32px;border-top:1px solid #262629;">
        <p style="margin:0;font-size:11px;color:#71717a;">© ${YEAR} Fastoosh · <a href="https://fastoosh.com" style="color:#71717a;text-decoration:none;">fastoosh.com</a></p>
      </div>
    </div>
  </div>`;
}

// ── 1. License delivery ───────────────────────────────────────────────────────
export function buildLicenseDeliveryEmail(params: {
  email: string;
  licenseKey: string;
  productName: string;
  planTier: string;
  type: 'lifetime' | 'subscription';
  machineLimit: number;
  downloadUrl?: string;
}): EmailContent {
  const { licenseKey, productName, planTier, type, machineLimit, downloadUrl } = params;
  const typeLabel = type === 'lifetime' ? 'Lifetime license' : 'Subscription';

  const html = shell(`
    <h1 style="margin:0 0 16px;font-size:20px;color:#ffffff;font-weight:700;">Your ${productName} license</h1>
    <p style="margin:0 0 20px;">Thanks for your purchase. Here is your license key — keep it safe.</p>
    <div style="background:#0a0a0a;border:1px solid #3f3f46;border-radius:10px;padding:18px;text-align:center;margin:0 0 20px;">
      <span style="font-family:'SF Mono',Menlo,monospace;font-size:18px;color:#a78bfa;letter-spacing:0.08em;font-weight:600;">${licenseKey}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px;">
      <tr><td style="padding:4px 0;color:#71717a;">Plan</td><td style="padding:4px 0;color:#d4d4d8;text-align:right;text-transform:capitalize;">${planTier} · ${typeLabel}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Machines</td><td style="padding:4px 0;color:#d4d4d8;text-align:right;">Up to ${machineLimit}</td></tr>
    </table>
    <p style="margin:0 0 8px;color:#a1a1aa;font-size:13px;"><strong style="color:#d4d4d8;">How to activate:</strong></p>
    <ol style="margin:0 0 20px;padding-left:18px;color:#a1a1aa;font-size:13px;">
      <li style="margin-bottom:6px;">Open the extension in After Effects.</li>
      <li style="margin-bottom:6px;">Paste your license key when prompted.</li>
      <li>You're set — it works offline after the first activation.</li>
    </ol>
    ${downloadUrl ? `<a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:10px;">Download the extension</a>` : ''}
    <p style="margin:20px 0 0;font-size:12px;color:#71717a;">Questions? <a href="${SUPPORT_URL}" style="color:#a78bfa;text-decoration:none;">Contact support</a>.</p>
  `);

  const text = [
    `Your ${productName} license`,
    ``,
    `License key: ${licenseKey}`,
    `Plan: ${planTier} (${typeLabel})`,
    `Machines: up to ${machineLimit}`,
    ``,
    `How to activate:`,
    `1. Open the extension in After Effects.`,
    `2. Paste your license key when prompted.`,
    `3. It works offline after the first activation.`,
    downloadUrl ? `\nDownload: ${downloadUrl}` : ``,
    ``,
    `Questions? ${SUPPORT_URL}`,
    `— Fastoosh · https://fastoosh.com`,
  ].join('\n');

  return { subject: `Your ${productName} license`, html, text };
}

// ── 2. Subscription past-due ──────────────────────────────────────────────────
export function buildPastDueEmail(params: {
  productName: string;
  updatePaymentUrl?: string;
}): EmailContent {
  const { productName, updatePaymentUrl } = params;
  const html = shell(`
    <h1 style="margin:0 0 16px;font-size:20px;color:#ffffff;font-weight:700;">Action needed: payment failed</h1>
    <p style="margin:0 0 16px;">We couldn't process the latest payment for your ${productName} subscription. Your license will keep working for a short grace period, then stop until payment succeeds.</p>
    ${updatePaymentUrl ? `<a href="${updatePaymentUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:10px;margin:0 0 16px;">Update payment method</a>` : ''}
    <p style="margin:8px 0 0;font-size:12px;color:#71717a;">Already fixed it? You can ignore this email. Questions? <a href="${SUPPORT_URL}" style="color:#a78bfa;text-decoration:none;">Contact support</a>.</p>
  `);
  const text = [
    `Action needed: payment failed for your ${productName} subscription.`,
    ``,
    `Your license keeps working for a short grace period, then stops until payment succeeds.`,
    updatePaymentUrl ? `\nUpdate payment method: ${updatePaymentUrl}` : ``,
    ``,
    `Questions? ${SUPPORT_URL}`,
    `— Fastoosh · https://fastoosh.com`,
  ].join('\n');
  return { subject: `Action needed: payment failed for your Fastoosh subscription`, html, text };
}

// ── 3. License revoked ────────────────────────────────────────────────────────
export function buildRevokedEmail(params: {
  productName: string;
  reason?: string;
}): EmailContent {
  const { productName, reason } = params;
  const html = shell(`
    <h1 style="margin:0 0 16px;font-size:20px;color:#ffffff;font-weight:700;">Your license has been deactivated</h1>
    <p style="margin:0 0 16px;">Your ${productName} license has been deactivated${reason ? ` (${reason})` : ''}. It will stop working at the next online check.</p>
    <p style="margin:8px 0 0;font-size:12px;color:#71717a;">Think this is a mistake? <a href="${SUPPORT_URL}" style="color:#a78bfa;text-decoration:none;">Contact support</a> and we'll sort it out.</p>
  `);
  const text = [
    `Your ${productName} license has been deactivated${reason ? ` (${reason})` : ''}.`,
    `It will stop working at the next online check.`,
    ``,
    `Think this is a mistake? ${SUPPORT_URL}`,
    `— Fastoosh · https://fastoosh.com`,
  ].join('\n');
  return { subject: `Your Fastoosh license has been deactivated`, html, text };
}

// ── Sender ────────────────────────────────────────────────────────────────────
export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  if (error) {
    // Don't throw — a failed email must not roll back a successful license
    // creation. Log it; the admin reissue endpoint can resend later.
    console.error('[email] send failed:', error);
  }
}
