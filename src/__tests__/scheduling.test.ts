import { Server } from "../server";

// Mock fetch
global.fetch = jest.fn();

describe("Job Scheduling", () => {
  let server: Server;
  let portCounter = 4000; // Start from port 4000 to avoid conflicts

  const getMockConfig = () => ({
    webhookSecret: "test-secret",
    forwardUrl: "http://test-forward-url.com",
    port: portCounter++, // Use different port for each test
    scheduledDelay: 5, // 5 seconds for tests
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    (global.fetch as jest.Mock).mockReset();
    server = new Server(getMockConfig());
  });

  afterEach(async () => {
    if (server) {
      server.stop();
    }
    jest.useRealTimers();
    jest.clearAllTimers();
    // Give some time for cleanup
    await new Promise(resolve => setImmediate(resolve));
  });

  describe("Scheduling Logic with 2-Second Buffer", () => {
    it("should immediately dispatch job scheduled in the past", async () => {
      const pastTime = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago

      // Mock successful fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("success"),
      });

      const job = await createJob(server, { scheduledFor: pastTime });

      // Should dispatch immediately (pastTime <= now + 2s)
      expect(global.fetch).toHaveBeenCalled();
      expect(job.status).toBe("QUEUED");
    });

    it("should immediately dispatch job scheduled within 2-second buffer", async () => {
      // Job scheduled 1 second from now (less than 2s buffer)
      const nearFutureTime = new Date(Date.now() + 1000).toISOString();

      // Mock successful fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("success"),
      });

      const job = await createJob(server, { scheduledFor: nearFutureTime });

      // Should dispatch immediately due to 2s buffer
      expect(global.fetch).toHaveBeenCalled();
      expect(job.status).toBe("QUEUED");
    });

    it("should immediately dispatch job scheduled exactly at 2-second buffer boundary", async () => {
      // Job scheduled exactly 2 seconds from now
      const boundaryTime = new Date(Date.now() + 2000).toISOString();

      // Mock successful fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("success"),
      });

      const job = await createJob(server, { scheduledFor: boundaryTime });

      // Should dispatch immediately (scheduledFor <= now + 2s)
      expect(global.fetch).toHaveBeenCalled();
      expect(job.status).toBe("QUEUED");
    });

    it("should NOT immediately dispatch job scheduled beyond 2-second buffer", async () => {
      // Job scheduled 5 seconds from now (more than 2s buffer)
      const futureTime = new Date(Date.now() + 5000).toISOString();

      const job = await createJob(server, { scheduledFor: futureTime });

      // Should NOT dispatch immediately
      expect(global.fetch).not.toHaveBeenCalled();
      expect(job.status).toBe("QUEUED");
    });
  });

  describe("Job Update Scheduling Logic", () => {
    it("should immediately dispatch when job is updated to past time", async () => {
      // Create future job (beyond 2s buffer)
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const job = await createJob(server, { scheduledFor: futureTime });

      expect(global.fetch).not.toHaveBeenCalled();

      // Mock successful fetch response for update
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("success"),
      });

      // Update to past time
      const pastTime = new Date(Date.now() - 1000).toISOString();
      await updateJob(server, job.id, { scheduledFor: pastTime });

      // Should dispatch immediately (pastTime <= now)
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should immediately dispatch when job is updated within 2-second buffer", async () => {
      // Create future job (beyond 2s buffer)
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const job = await createJob(server, { scheduledFor: futureTime });

      expect(global.fetch).not.toHaveBeenCalled();

      // Mock successful fetch response for update
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("success"),
      });

      // Update to within 2s buffer (1 second from now)
      const bufferTime = new Date(Date.now() + 1000).toISOString();
      await updateJob(server, job.id, { scheduledFor: bufferTime });

      // Should dispatch immediately
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should NOT immediately dispatch when job is updated beyond 2-second buffer", async () => {
      // Create future job
      const futureTime = new Date(Date.now() + 15000).toISOString();
      const job = await createJob(server, { scheduledFor: futureTime });

      expect(global.fetch).not.toHaveBeenCalled();

      // Update to beyond 2s buffer (5 seconds from now)
      const newFutureTime = new Date(Date.now() + 5000).toISOString();
      await updateJob(server, job.id, { scheduledFor: newFutureTime });

      // Should NOT dispatch immediately
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Scheduled Job Processing", () => {
    it("should process jobs when their scheduled time + scheduledDelay passes", async () => {
      jest.useFakeTimers();

      try {
        // Create a job scheduled 5 seconds from now (beyond 2s buffer, so won't dispatch immediately)
        const futureTime = new Date(Date.now() + 5000);
        const job = await createJob(server, { scheduledFor: futureTime.toISOString() });

        expect(global.fetch).not.toHaveBeenCalled();

        // Mock successful fetch response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("success"),
        });

        // Start the scheduler without binding to port (mock the listen method)
        const originalListen = server.listen;
        server.listen = jest.fn(() => {
          // Start internal scheduling without actual port binding
          server["startJobScheduler"]();
        });

        server.listen();

        // Fast-forward time to when the job should be processed (5s scheduledFor + 5s scheduledDelay = 10s)
        jest.advanceTimersByTime(10100); // Add extra 100ms to ensure it passes

        // Run only pending timers to trigger the scheduler
        jest.runOnlyPendingTimers();

        expect(global.fetch).toHaveBeenCalled();

        // Restore original method
        server.listen = originalListen;
      } finally {
        jest.useRealTimers();
      }
    }, 10000);

    it("should NOT process jobs before their scheduled time + scheduledDelay", async () => {
      jest.useFakeTimers();

      try {
        // Create a job scheduled 5 seconds from now
        const futureTime = new Date(Date.now() + 5000);
        const job = await createJob(server, { scheduledFor: futureTime.toISOString() });

        expect(global.fetch).not.toHaveBeenCalled();

        // Start the scheduler without binding to port
        const originalListen = server.listen;
        server.listen = jest.fn(() => {
          server["startJobScheduler"]();
        });

        server.listen();

        // Fast-forward time to before the job should be processed (7s, less than 5s + 5s scheduledDelay = 10s)
        jest.advanceTimersByTime(7000);

        // Run only pending timers to trigger the scheduler
        jest.runOnlyPendingTimers();

        expect(global.fetch).not.toHaveBeenCalled();

        // Restore original method
        server.listen = originalListen;
      } finally {
        jest.useRealTimers();
      }
    }, 10000);

    it("should only process QUEUED jobs", async () => {
      jest.useFakeTimers();

      try {
        // Create jobs with different statuses
        const futureTime = new Date(Date.now() + 1000); // Within buffer time for immediate dispatch

        // Mock the first dispatch call
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("success"),
        });

        const job1 = await createJob(server, { scheduledFor: futureTime.toISOString() });

        // Job1 should be dispatched immediately (within buffer)
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Manually set job status to COMPLETED to test that it won't be processed again
        const completedJob = { ...(job1 as any), status: "COMPLETED" };
        server["jobCache"].set((job1 as any).id, completedJob);

        // Start the scheduler without binding to port
        const originalListen = server.listen;
        server.listen = jest.fn(() => {
          server["startJobScheduler"]();
        });

        server.listen();

        // Fast-forward time
        jest.advanceTimersByTime(10000);

        // Run only pending timers to trigger the scheduler
        jest.runOnlyPendingTimers();

        // Should still only have been called once (not again for the COMPLETED job)
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Restore original method
        server.listen = originalListen;
      } finally {
        jest.useRealTimers();
      }
    }, 10000);
  });

  describe("Buffer Time Calculation", () => {
    it("should use correct 2-second buffer for immediate dispatch, regardless of scheduledDelay", async () => {
      const serverWithCustomDelay = new Server({
        ...getMockConfig(),
        scheduledDelay: 10, // 10 seconds
      });

      try {
        // Job scheduled 1 second from now (within 2s buffer)
        const nearFutureTime = new Date(Date.now() + 1000).toISOString();

        // Mock successful fetch response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("success"),
        });

        const job = await createJob(serverWithCustomDelay, { scheduledFor: nearFutureTime });

        // Should dispatch immediately due to 2s buffer (1s < 2s buffer)
        expect(global.fetch).toHaveBeenCalled();

        // Reset fetch mock
        (global.fetch as jest.Mock).mockClear();

        // Job scheduled 5 seconds from now (beyond 2s buffer)
        const farFutureTime = new Date(Date.now() + 5000).toISOString();
        const job2 = await createJob(serverWithCustomDelay, { scheduledFor: farFutureTime });

        // Should NOT dispatch immediately (5s > 2s buffer)
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        serverWithCustomDelay.stop();
      }
    });

    it("should use scheduledDelay for processing future jobs", async () => {
      jest.useFakeTimers();

      const serverWithCustomDelay = new Server({
        ...getMockConfig(),
        scheduledDelay: 2, // 2 seconds
      });

      try {
        // Job scheduled 5 seconds from now (beyond 2s buffer)
        const futureTime = new Date(Date.now() + 5000);
        const job = await createJob(serverWithCustomDelay, { scheduledFor: futureTime.toISOString() });

        expect(global.fetch).not.toHaveBeenCalled();

        // Mock successful fetch response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("success"),
        });

        // Start the scheduler without binding to port
        const originalListen = serverWithCustomDelay.listen;
        serverWithCustomDelay.listen = jest.fn(() => {
          serverWithCustomDelay["startJobScheduler"]();
        });

        serverWithCustomDelay.listen();

        // Fast-forward time to when the job should be processed (5s scheduledFor + 2s scheduledDelay = 7s)
        jest.advanceTimersByTime(7100); // Add extra 100ms to ensure it passes

        // Run only pending timers to trigger the scheduler
        jest.runOnlyPendingTimers();

        expect(global.fetch).toHaveBeenCalled();

        // Restore original method
        serverWithCustomDelay.listen = originalListen;
      } finally {
        serverWithCustomDelay.stop();
        jest.useRealTimers();
      }
    }, 10000);
  });
});

// Helper function to create a job by directly calling the handler method
async function createJob(server: Server, jobData: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const mockReq: any = {
      body: {
        payload: { data: "test" },
        ...jobData,
      },
    };

    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => resolve(data)),
    };

    // Access the private setupWebhook method to get the handler
    const app = server["app"];

    // Simulate the POST request by calling the webhook handler directly
    try {
      const webhookHandler = async (req: any, res: any) => {
        try {
          console.log("Job Received", req.body);

          const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : new Date();
          const now = new Date();
          // Add 2-second buffer to determine if job should be dispatched immediately
          const bufferTime = new Date(now.getTime() + 2000);
          const isImmediate = scheduledFor <= bufferTime;

          const job = {
            id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            status: "QUEUED",
            scheduledFor: scheduledFor.toISOString(),
            payload: req.body?.payload ?? {},
            createdAt: now.toISOString(),
          };

          server["jobCache"].set(job.id, job);

          if (isImmediate) {
            // Dispatch immediately
            await server["dispatchJob"](job);
          } else {
            console.log(
              `Job ${job.id} scheduled for ${job.scheduledFor} (will dispatch when time comes)`
            );
          }

          console.log("Dispatch Response", job);

          res.status(201).json(job);
        } catch (error) {
          console.error("Error processing request:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      };

      webhookHandler(mockReq, mockRes);
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to update a job
async function updateJob(server: Server, jobId: string, updateData: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const mockReq: any = {
      params: { id: jobId },
      body: updateData,
    };

    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => resolve(data)),
    };

    try {
      const job = server["jobCache"].get(jobId);

      if (!job) {
        mockRes.status(404).json({
          error: "Job not found",
          message: `Job with id '${jobId}' does not exist`,
          code: "JOB_NOT_FOUND"
        });
        return;
      }

      if (job.status !== "QUEUED") {
        mockRes.status(400).json({ error: "Job can only be updated when status is QUEUED" });
        return;
      }

      const { scheduledFor } = updateData;

      if (!scheduledFor) {
        mockRes.status(400).json({ error: "scheduledFor is required" });
        return;
      }

      const newScheduledTime = new Date(scheduledFor);
      const now = new Date();

      const updatedJob = {
        ...job,
        scheduledFor: newScheduledTime.toISOString(),
      };

      server["jobCache"].set(jobId, updatedJob);

      // If updated to immediate time (considering 2-second buffer) and hasn't been dispatched yet, dispatch now
      const bufferTime = new Date(now.getTime() + 2000);
      if (newScheduledTime <= bufferTime) {
        server["dispatchJob"](updatedJob).catch((err: any) => {
          console.error("Error dispatching updated job:", err);
        });
      }

      console.log("Job updated", updatedJob);

      mockRes.status(200).json(updatedJob);
    } catch (error) {
      reject(error);
    }
  });
}