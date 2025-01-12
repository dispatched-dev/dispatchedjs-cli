import express, { Express, Request, Response } from "express";

interface ServerConfig {
  webhookSecret: string;
  forwardUrl: string;
  port: number;
}

export class Server {
  private app: Express;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.app = express();
    this.config = config;
    this.setupMiddleware();
    this.setupWebhook();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupWebhook(): void {
    this.app.post("/api/jobs/dispatch", async (req: Request, res: Response) => {
      try {
        console.log("Processing:", req.body);

        const response = await fetch(this.config.forwardUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.webhookSecret}`,
          },
          body: JSON.stringify({
            jobId: randomId(),
            attempt: randomId(),
            attemptNumber: 1,
            status: "QUEUED",
            payload: req.body,
          }),
        });
        console.log("Processor Response:", response);
      } catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }

  listen(): void {
    this.app.listen(this.config.port, () => {
      console.log(`🚀 Webhook server running on port ${this.config.port}`);
      console.log(`📮 Forwarding webhooks to: ${this.config.forwardUrl}`);
      console.log(
        `🔒 Validating webhooks with secret: ${this.config.webhookSecret.slice(
          0,
          3
        )}...`
      );
    });
  }
}

const randomId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};
