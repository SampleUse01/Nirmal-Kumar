import colors from "colors";
import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

async function startServer(): Promise<void> {
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(colors.green(`WMS API listening on port ${env.PORT}`));
  });

  let isShuttingDown = false;
  let databaseRetryTimer: NodeJS.Timeout | undefined;
  let isConnecting = false;
  const scheduleDatabaseRetry = () => {
    if (databaseRetryTimer || isShuttingDown) return;
    databaseRetryTimer = setTimeout(() => {
      databaseRetryTimer = undefined;
      if (isConnecting || isShuttingDown) return;
      isConnecting = true;
      void connectDatabase()
        .catch(scheduleDatabaseRetry)
        .finally(() => {
          isConnecting = false;
        });
    }, 10_000);
    databaseRetryTimer.unref();
  };

  try {
    isConnecting = true;
    await connectDatabase();
  } catch {
    console.warn(colors.yellow("API is online; database-dependent requests will return 503 until MongoDB connects."));
    scheduleDatabaseRetry();
  } finally {
    isConnecting = false;
  }

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(colors.yellow(`${signal} received; closing the WMS API.`));
    if (databaseRetryTimer) clearTimeout(databaseRetryTimer);

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDatabase();
    } catch (error) {
      console.error(colors.red("Failed to shut down the WMS API cleanly."), error);
      process.exitCode = 1;
    }
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

await startServer();
