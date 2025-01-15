import express, { Express, Request, Response } from "express";

interface ServerConfig {
  webhookSecret: string;
  forwardUrl: string;
  port: number;
}

export class Server {
  private app: Express;
  private config: ServerConfig;
  private jobCache: Map<string, any>;

  constructor(config: ServerConfig) {
    this.app = express();
    this.config = config;
    this.setupMiddleware();
    this.setupWebhook();
    this.jobCache = new Map<string, any>();
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

        const job = {
          id: randomId(),
          status: "QUEUED",
        };
        this.jobCache.set(job.id, job);

        const webhookBody = {
          jobId: job.id,
          attemptId: randomId(),
          attemptNumber: 1,
          status: job.status,
          payload: req.body?.payload ?? {},
        };

        console.log("Sending webhook to:", this.config.forwardUrl, {
          method: "POST",
          headers: webhookHeaders,
          body: webhookBody,
        });

        try {
          fetch(this.config.forwardUrl, {
            method: "POST",
            headers: webhookHeaders,
            body: JSON.stringify(webhookBody),
          })
            .then((res) => {
              this.jobCache.set(job.id, {
                ...job,
                status: "COMPLETED",
              });
              console.log("Webhook Response:", res);
              return res.text();
            })
            .then((res) => {
              console.log("Webhook Response Text:", res);
            })
            .catch((err) => {
              this.jobCache.set(job.id, {
                ...job,
                status: "FAILED",
              });
              console.log("Webhook Error:", err);
            });
        } catch (error) {
          console.log("Dispatch Error:", error);
          return res.status(500).json({ error: "Internal server error" });
        }

        console.log("Dispatch Response", job);
        console.log("--------------------------------------------------------");

        res.status(201).json(job);
      } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    this.app.get("/api/jobs/:id", (req: Request, res: Response) => {
      const job = this.jobCache.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.status(200).json(job);
    });

    this.app.delete("/api/jobs/:id", (req: Request, res: Response) => {
      const job = this.jobCache.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "QUEUED") {
        return res.status(400).json({ error: "Job already completed" });
      }

      console.log("Cancelling job", job);

      this.jobCache.set(req.params.id, {
        ...job,
        status: "CANCELLED",
      });

      console.log("Job cancelled", job);

      res.status(200).json(job);
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
      console.log(" ");
    });
  }
}

const randomId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};
