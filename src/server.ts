import http from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { createSocket } from "./config/socket";
import { logger } from "./config/logger";

const server = http.createServer(app);
createSocket(server);

server.listen(env.PORT, () => {
  logger.info(`DockMail backend listening on port ${env.PORT}`);
});
