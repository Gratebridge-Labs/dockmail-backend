import http from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { createSocket } from "./config/socket";
import { logger } from "./config/logger";
import { registerEmailWorkers } from "./modules/email/email.queue";
import { startImapInboundSync } from "./modules/email/imap-inbound.sync";

const server = http.createServer(app);
createSocket(server);
registerEmailWorkers();
startImapInboundSync();

server.listen(env.PORT, () => {
  logger.info(`DockMail backend listening on port ${env.PORT}`);
});
