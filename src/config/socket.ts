import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { corsAllowedOrigins, env } from "./env";

export let io: Server;

export function createSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: corsAllowedOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("UNAUTHORIZED"));
    }
    try {
      jwt.verify(token, env.JWT_ACCESS_SECRET);
      return next();
    } catch {
      return next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:mailbox", ({ mailboxId }) => {
      socket.join(`mailbox:${mailboxId}`);
    });
    socket.on("unsubscribe:mailbox", ({ mailboxId }) => {
      socket.leave(`mailbox:${mailboxId}`);
    });
    socket.on("subscribe:workspace", ({ workspaceId }) => {
      socket.join(`workspace:${workspaceId}`);
    });
  });

  return io;
}
