import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.TURSO_DATABASE_URL || `file:${path.join(root, 'data.db')}`,
  databaseToken: process.env.TURSO_AUTH_TOKEN,
  vapidKeys: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  },
  vapidSubject: process.env.VAPID_SUBJECT,
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    production: process.env.NODE_ENV === 'production',
  },
  staticDir: path.resolve(root, '../client/dist'),
};
