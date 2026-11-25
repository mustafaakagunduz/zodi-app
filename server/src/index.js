import { createApp } from './app.js';
import { config } from './config.js';
import { createDb } from './db.js';
import { createMailer } from './mailer.js';
import { createPush } from './push.js';

const db = await createDb({ url: config.databaseUrl, authToken: config.databaseToken });
const push = await createPush(db, { keys: config.vapidKeys, subject: config.vapidSubject });
const { server } = createApp({
  db, push, mailer: createMailer(config.mail), staticDir: config.staticDir,
});

server.listen(config.port, () => console.log(`Sunucu hazır: http://localhost:${config.port}`));
