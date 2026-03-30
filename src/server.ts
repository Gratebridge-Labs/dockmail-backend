import http from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { createSocket } from "./config/socket";
import { logger } from "./config/logger";
import { registerEmailWorkers } from "./modules/email/email.queue";

const server = http.createServer(app);
createSocket(server);
registerEmailWorkers();

server.listen(env.PORT, () => {
  logger.info(`DockMail backend listening on port ${env.PORT}`);
});
