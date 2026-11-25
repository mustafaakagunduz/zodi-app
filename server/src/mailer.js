import nodemailer from 'nodemailer';

// SMTP tanımlıysa e-posta gönderir. Geliştirmede tanımlı değilse içeriği terminale yazar.
// Canlıda tanımlı değilse null döner: kodlar kayıt dosyalarına düşmemeli.
export function createMailer({ host, port, user, pass, from, production }) {
  if (host) {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: user ? { user, pass } : undefined,
    });
    return { send: (mail) => transport.sendMail({ from, ...mail }) };
  }
  if (production) {
    console.warn('SMTP_HOST tanımlı değil: "Şifremi unuttum" çalışmayacak.');
    return null;
  }
  return {
    send: async ({ to, subject, text }) =>
      console.log(`\n--- E-posta (gönderilmedi, SMTP tanımlı değil) ---\n${to}\n${subject}\n\n${text}\n---\n`),
  };
}
