import Koa from "koa";
import { Server } from "http";
import { ErrorCallback, retry } from "async";
import pino from "pino";
import helmet from "koa-helmet";
import cors from "@koa/cors";
import cookie from "koa-cookie";
export class AppServer {
  private app: Koa;
  private server: Server;
  constructor(app: Koa) {
    this.app = app;
  }

  public listen(port: number): Server {
    this.server = this.app.listen(port);
    return this.server;
  }

  public getServer(): Server {
    return this.server;
  }

  public closeServer(): Promise<void> {
    if (typeof this.server === undefined) {
      throw new Error("Server is not open");
    }
    const checkPendingRequests = (
      callback: ErrorCallback<Error | undefined>
    ) => {
      this.server.getConnections(
        (err: Error | null, pendingRequests: number) => {
          if (err) {
            callback(err);
          } else if (pendingRequests > 0) {
            callback(Error(`Number of pending requests: ${pendingRequests}`));
          } else {
            callback(undefined);
          }
        }
      );
    };

    return new Promise<void>((resolve, reject) => {
      retry(
        { times: 10, interval: 1000 },
        checkPendingRequests.bind(this),
        ((error: Error | undefined) => {
          if (error) {
            this.server.close(() => reject(error));
          } else {
            this.server.close(() => resolve());
          }
        }).bind(this)
      );
    });
  }
}

export function createServer(): AppServer {
  const app = new Koa();
  const appSrv = new AppServer(app);
  const logger = pino();

  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production" ? undefined : false,
    })
  );
  app.use(cors());
  app.use(cookie());

  // Register routes

  return appSrv;
}