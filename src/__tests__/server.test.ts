import { Server } from "../server";
import express, { Express, Request, Response } from "express";

// Create mock types
type MockExpress = jest.Mocked<Express> & {
  use: jest.Mock;
  post: jest.Mock;
  get: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
  listen: jest.Mock;
};

type MockExpressFactory = jest.Mock<MockExpress>;

// Mock express and its methods
jest.mock("express", () => {
  const json = jest.fn();
  const mockApp = {
    use: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn((port, callback) => callback()),
  };
  return Object.assign(
    jest.fn(() => mockApp),
    { json }
  );
});

// Mock fetch
global.fetch = jest.fn();

describe("Server", () => {
  let server: Server;
  let mockExpressApp: MockExpress;

  const mockConfig = {
    webhookSecret: "test-secret",
    forwardUrl: "http://test-forward-url.com",
    port: 3000,
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();

    // Create new server instance
    server = new Server(mockConfig);
    mockExpressApp = (express as unknown as MockExpressFactory)();
  });

  describe("webhook endpoint", () => {
    it("should process webhook and forward request", async () => {
      const webhookHandler = mockExpressApp.post.mock.calls[0][1];

      const mockReq = {
        body: {
          payload: {
            data: "test-data",
          },
        },
      } as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      // Mock successful fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("success"),
      });

      await webhookHandler(mockReq, mockRes);

      expect(global.fetch).toHaveBeenCalledWith(
        mockConfig.forwardUrl,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockConfig.webhookSecret}`,
          },
          body: expect.stringContaining('"payload":{"data":"test-data"}'),
        })
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          status: "QUEUED",
        })
      );
    });

    it("should handle errors and return 500 status", async () => {
      const webhookHandler = mockExpressApp.post.mock.calls[0][1];

      const mockReq = {
        body: {
          payload: {
            data: "test-data",
          },
        },
      } as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      // Mock fetch throwing an error
      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Network error");
      });

      await webhookHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });

    it("should verify webhook endpoint path", () => {
      expect(mockExpressApp.post).toHaveBeenCalledWith(
        "/api/jobs/dispatch",
        expect.any(Function)
      );
    });
  });

  describe("job endpoints", () => {
    it("should get job by id", () => {
      const jobHandler = mockExpressApp.get.mock.calls[0][1];
      const mockJob = { id: "123", status: "COMPLETED" };

      const mockReq = {
        params: { id: "123" },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      server["jobCache"].set("123", mockJob);

      jobHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockJob);
    });

    it("should return 404 for non-existent job", () => {
      const jobHandler = mockExpressApp.get.mock.calls[0][1];

      const mockReq = {
        params: { id: "non-existent" },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      jobHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Job not found" });
    });

    it("should cancel job", () => {
      const cancelHandler = mockExpressApp.delete.mock.calls[0][1];
      const mockJob = { id: "456", status: "QUEUED" };

      const mockReq = {
        params: { id: "456" },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      server["jobCache"].set("456", { ...mockJob });

      cancelHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "456",
        })
      );
    });

    it("should not cancel completed job", () => {
      const cancelHandler = mockExpressApp.delete.mock.calls[0][1];
      const mockJob = { id: "456", status: "COMPLETED" };

      const mockReq = {
        params: { id: "456" },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      server["jobCache"].set("456", { ...mockJob });

      cancelHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Job already completed",
      });
    });

    it("should update job scheduledFor", () => {
      const updateHandler = mockExpressApp.patch.mock.calls[0][1];
      const mockJob = { id: "789", status: "QUEUED", scheduledFor: "2024-01-01T00:00:00Z" };

      const mockReq = {
        params: { id: "789" },
        body: { scheduledFor: "2024-12-31T23:59:59Z" },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      server["jobCache"].set("789", { ...mockJob });

      updateHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "789",
          status: "QUEUED",
          scheduledFor: "2024-12-31T23:59:59.000Z",
        })
      );
    });

    it("should not update non-existent job", () => {
      const updateHandler = mockExpressApp.patch.mock.calls[0][1];

      const mockReq = {
        params: { id: "non-existent" },
        body: { scheduledFor: "2024-12-31T23:59:59Z" },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      updateHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Job not found" });
    });

    it("should not update completed job", () => {
      const updateHandler = mockExpressApp.patch.mock.calls[0][1];
      const mockJob = { id: "completed", status: "COMPLETED", scheduledFor: "2024-01-01T00:00:00Z" };

      const mockReq = {
        params: { id: "completed" },
        body: { scheduledFor: "2024-12-31T23:59:59Z" },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      server["jobCache"].set("completed", { ...mockJob });

      updateHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Job can only be updated when status is QUEUED",
      });
    });

    it("should require scheduledFor in update request", () => {
      const updateHandler = mockExpressApp.patch.mock.calls[0][1];
      const mockJob = { id: "test", status: "QUEUED", scheduledFor: "2024-01-01T00:00:00Z" };

      const mockReq = {
        params: { id: "test" },
        body: {},
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      server["jobCache"].set("test", { ...mockJob });

      updateHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "scheduledFor is required",
      });
    });
  });

  describe("listen", () => {
    it("should start server on specified port", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      server.listen();

      expect(mockExpressApp.listen).toHaveBeenCalledWith(
        mockConfig.port,
        expect.any(Function)
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `🚀 Webhook server running on port ${mockConfig.port}`
        )
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `📮 Forwarding webhooks to: ${mockConfig.forwardUrl}`
        )
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `🔒 Validating webhooks with secret: ${mockConfig.webhookSecret.slice(
            0,
            6
          )}...`
        )
      );

      consoleSpy.mockRestore();
    });
  });
});
