import { Resend } from "resend";

export const MAIL_FROM = "Ontic Destek <destek@ontic.com.tr>";

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
