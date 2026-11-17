import { Resend } from "resend";

export const MAIL_FROM = "Ontic Destek <destek@ontic.com.tr>";
export const PRODUCER_PANEL_URL = "https://www.ontic.com.tr/uretici";

const BRAND = "#c2410c";
const INK = "#18181b";
const MUTED = "#71717a";
const LINE = "#e4e4e7";
const PAGE = "#f3f4f6";

export function normalizeMailAddress(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY tanımlı değil");
  }
  return new Resend(apiKey);
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: MAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
    replyTo: replyTo || "destek@ontic.com.tr",
  });

  if (error) {
    throw new Error(error.message || "Mail gönderilemedi");
  }

  return data;
}

export function buildProducerNewOrderMail({
  producerName,
  orderNumber,
  items,
}) {
  const name = String(producerName || "").trim() || "Üreticimiz";
  const lines = (items || [])
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => ({
      title: String(item.title || "Ürün").trim() || "Ürün",
      quantity: Number(item.quantity),
    }));

  const itemRows = lines
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${LINE};font-size:15px;line-height:1.4;color:${INK};">${escapeHtml(item.title)}</td>
          <td style="padding:14px 0 14px 16px;border-bottom:1px solid ${LINE};font-size:15px;font-weight:700;color:${INK};text-align:right;white-space:nowrap;">${item.quantity} adet</td>
        </tr>`
    )
    .join("");

  const orderLine = orderNumber
    ? `<p style="margin:0 0 18px;font-size:14px;color:${MUTED};">Sipariş no: <strong style="color:${INK};">${escapeHtml(orderNumber)}</strong></p>`
    : "";

  const html = `
    <div style="margin:0;padding:32px 16px;background:${PAGE};font-family:Arial,Helvetica,sans-serif;color:${INK};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
        <tr>
          <td style="height:6px;background:${BRAND};font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;vertical-align:middle;">
                  <img src="https://www.ontic.com.tr/logo.png" width="40" height="40" alt="Ontic" style="display:block;border:0;border-radius:10px;" />
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${INK};">Ontic</p>
                  <p style="margin:2px 0 0;font-size:12px;color:${MUTED};">Üretici Ağı</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 8px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND};">Yeni siparişiniz var</p>
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:700;color:${INK};">Merhaba ${escapeHtml(name)},</h1>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#3f3f46;">Size yeni bir üretim siparişi atandı. Ürün ve adet bilgisi aşağıda.</p>
            ${orderLine}
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 8px;">
            <p style="margin:0;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;font-size:14px;line-height:1.5;color:#9a3412;">
              Siparişi hemen onaylamak için <strong>3 saatiniz</strong> var.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;">
            <a href="${PRODUCER_PANEL_URL}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:12px;">Siparişi görüntüle</a>
          </td>
        </tr>
      </table>
      <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">
        Bu ileti Ontic üretici hesabınıza yeni sipariş atandığı için gönderildi.
      </p>
    </div>
  `;

  const text = [
    `Merhaba ${name},`,
    "",
    "Yeni siparişiniz var.",
    orderNumber ? `Sipariş no: ${orderNumber}` : null,
    "",
    ...lines.map((item) => `${item.title} — ${item.quantity} adet`),
    "",
    "Siparişi hemen onaylamak için 3 saatiniz var.",
    PRODUCER_PANEL_URL,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject: "Yeni siparişiniz var",
    html,
    text,
  };
}

export async function sendProducerNewOrderMail({
  to,
  producerName,
  orderNumber,
  items,
}) {
  const message = buildProducerNewOrderMail({
    producerName,
    orderNumber,
    items,
  });
  return sendMail({ to, ...message });
}

export async function sendTestMail(to = "omergungorco@gmail.com") {
  return sendMail({
    to,
    subject: "Ontic test maili",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b">
        <p>Merhaba,</p>
        <p>Bu bir <strong>Ontic</strong> test mailidir. Resend bağlantısı çalışıyor.</p>
        <p style="color:#71717a;font-size:13px">Gönderen: destek@ontic.com.tr</p>
      </div>
    `,
    text: "Bu bir Ontic test mailidir. Resend bağlantısı çalışıyor.",
  });
}
