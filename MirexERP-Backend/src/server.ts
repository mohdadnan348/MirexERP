
import "dotenv/config";

import app from "./app";
import { connectDatabase, disconnectDatabase } from "./database/connection";

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  try {
    // Connect database before starting server
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`
========================================
       MIREXERP API SERVER
========================================
  Status      : Running
  Port        : ${PORT}
  Environment : ${process.env.NODE_ENV || "development"}
  API         : http://localhost:${PORT}/api/v1
  Health      : http://localhost:${PORT}/health
========================================
      `);
    });

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`${signal} received. Shutting down server...`);

      const forceExit = setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
      }, 15000);
      forceExit.unref();

      server.close(async (closeError) => {
        try {
          if (closeError) throw closeError;
          console.log("HTTP server closed.");
          await disconnectDatabase();
          clearTimeout(forceExit);
          process.exit(0);
        } catch (error) {
          console.error("Graceful shutdown failed:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // An unhandled rejection is treated as fatal; stop accepting requests and
    // close the database cleanly rather than continuing in an unknown state.
    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled Rejection:", reason);
      shutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    console.error("Failed to start MirexERP server:", error);
    process.exit(1);
  }
};

void startServer();
