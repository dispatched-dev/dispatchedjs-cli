import express, { Express, Request, Response } from "express";

interface ServerConfig {
  webhookSecret: string;
  forwardUrl: string;
  port: number;
  scheduledDelay?: number; // seconds to add to scheduled jobs, defaults to 30
}

export class Server {
  private app: Express;
  private config: ServerConfig;
  private jobCache: Map<string, any>;
  private jobScheduler: NodeJS.Timeout | null = null;

  constructor(config: ServerConfig) {
    this.app = express();
    this.config = { scheduledDelay: 30, ...config }; // default 30 seconds
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

        const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : new Date();
        const now = new Date();
        const isImmediate = scheduledFor <= now;

        const job = {
          id: randomId(),
          status: "QUEUED",
          scheduledFor: scheduledFor.toISOString(),
          payload: req.body?.payload ?? {},
          createdAt: now.toISOString(),
        };

        this.jobCache.set(job.id, job);

        if (isImmediate) {
          // Dispatch immediately
          await this.dispatchJob(job);
        } else {
          console.log(`Job ${job.id} scheduled for ${job.scheduledFor} (will dispatch when time comes)`);
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

    this.app.patch("/api/jobs/:id", (req: Request, res: Response) => {
      const job = this.jobCache.get(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: "Job not found",
          message: `Job with id '${req.params.id}' does not exist`,
          code: "JOB_NOT_FOUND"
        });
      }

      if (job.status !== "QUEUED") {
        return res.status(400).json({ error: "Job can only be updated when status is QUEUED" });
      }

      const { scheduledFor } = req.body;

      if (!scheduledFor) {
        return res.status(400).json({ error: "scheduledFor is required" });
      }

      console.log("Updating job", job.id, "with scheduledFor:", scheduledFor);

      const newScheduledTime = new Date(scheduledFor);
      const now = new Date();

      const updatedJob = {
        ...job,
        scheduledFor: newScheduledTime.toISOString(),
      };

      this.jobCache.set(req.params.id, updatedJob);

      // If updated to immediate time and hasn't been dispatched yet, dispatch now
      if (newScheduledTime <= now) {
        this.dispatchJob(updatedJob).catch(err => {
          console.error("Error dispatching updated job:", err);
        });
      }

      console.log("Job updated", updatedJob);

      res.status(200).json(updatedJob);
    });

    this.app.delete("/api/jobs/:id", (req: Request, res: Response) => {
      const job = this.jobCache.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "QUEUED") {
        return res.status(400).json({ error: "Job can only be cancelled when status is QUEUED" });
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

  private async dispatchJob(job: any): Promise<void> {
    console.log(`Dispatching job ${job.id}`);

    // Update job status to DISPATCHED
    const dispatchedJob = { ...job, status: "DISPATCHED" };
    this.jobCache.set(job.id, dispatchedJob);

    const webhookHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.webhookSecret}`,
    };

    const webhookBody = {
      jobId: job.id,
      attemptId: randomId(),
      attemptNumber: 1,
      status: "DISPATCHED",
      payload: job.payload,
    };

    console.log("Sending webhook to:", this.config.forwardUrl, {
      method: "POST",
      headers: webhookHeaders,
      body: webhookBody,
    });

    try {
      const response = await fetch(this.config.forwardUrl, {
        method: "POST",
        headers: webhookHeaders,
        body: JSON.stringify(webhookBody),
      });

      if (response.ok) {
        this.jobCache.set(job.id, {
          ...dispatchedJob,
          status: "COMPLETED",
        });
        const responseText = await response.text();
        console.log("Webhook Response:", response.status, responseText);
      } else {
        this.jobCache.set(job.id, {
          ...dispatchedJob,
          status: "FAILED",
        });
        console.log("Webhook Error - Non-200 status:", response.status);
      }
    } catch (error) {
      this.jobCache.set(job.id, {
        ...dispatchedJob,
        status: "FAILED",
      });
      console.log("Webhook Error:", error);
    }
  }

  private startJobScheduler(): void {
    if (this.jobScheduler) {
      clearInterval(this.jobScheduler);
    }

    console.log(`⏰ Job scheduler started (checking every 1 second, scheduled delay: ${this.config.scheduledDelay} seconds)`);

    this.jobScheduler = setInterval(() => {
      this.processScheduledJobs();
    }, 1000); // Always check every 1 second
  }

  private stopJobScheduler(): void {
    if (this.jobScheduler) {
      clearInterval(this.jobScheduler);
      this.jobScheduler = null;
      console.log("⏹️  Job scheduler stopped");
    }
  }

  private async processScheduledJobs(): Promise<void> {
    const now = new Date();
    const readyJobs = Array.from(this.jobCache.values()).filter(
      job => {
        if (job.status !== "QUEUED") return false;

        const scheduledTime = new Date(job.scheduledFor);
        const delayedTime = new Date(scheduledTime.getTime() + (this.config.scheduledDelay! * 1000));

        return delayedTime <= now;
      }
    );

    if (readyJobs.length > 0) {
      console.log(`📋 Processing ${readyJobs.length} scheduled job(s)`);

      for (const job of readyJobs) {
        // Dispatch jobs that are ready and haven't been dispatched yet
        if (job.status === "QUEUED") {
          await this.dispatchJob(job);
        }
      }
    }
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

      // Start the job scheduler
      this.startJobScheduler();
    });
  }

  stop(): void {
    this.stopJobScheduler();
  }
}

const randomId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};
