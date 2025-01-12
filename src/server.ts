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
        console.log("Job Received", req.body);

        const webhookHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.webhookSecret}`,
        };
        const webhookBody = {
          jobId: randomId(),
          attempt: randomId(),
          attemptNumber: 1,
          status: "QUEUED",
          payload: req.body,
        };

        console.log('Sending webhook to:', this.config.forwardUrl, {
          method: "POST",
          headers: webhookHeaders,
          body: webhookBody,
        });

        const response = await fetch(this.config.forwardUrl, {
          method: "POST",
          headers: webhookHeaders,
          body: JSON.stringify(webhookBody),
        });

        console.log('Webhook Response:', response);
      } catch (error) {
        console.error("Error processing request:", error);
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
          6
        )}...`
      );
      console.log(' ');
    });
  }
}

const randomId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};
