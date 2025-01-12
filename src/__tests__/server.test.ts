import { Server } from "../server";
import express from "express";

// Mock external dependencies
jest.mock("node-fetch");
jest.mock("express");

describe("Server", () => {
  let server: Server;
  const mockConfig = {
    webhookSecret: "test-secret",
    forwardUrl: "http://test-url.com",
    port: 3000,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock express and its methods
    const mockExpress = express as jest.MockedFunction<typeof express>;
    const mockApp = {
      use: jest.fn(),
      post: jest.fn(),
      listen: jest.fn().mockImplementation((port, callback) => {
        callback();
        return { close: jest.fn() };
      }),
    };
    mockExpress.mockReturnValue(mockApp as any);

    server = new Server(mockConfig);
  });

  describe("constructor", () => {
    it("should initialize with correct config", () => {
      expect(server["config"]).toEqual(mockConfig);
      expect(express).toHaveBeenCalled();
    });
  });

  describe("setupMiddleware", () => {
    it("should set up json middleware", () => {
      expect(server["app"].use).toHaveBeenCalledWith(express.json());
    });
  });

  describe("setupWebhook", () => {
    it("should set up POST endpoint for /api/jobs/dispatch", () => {
      expect(server["app"].post).toHaveBeenCalledWith(
        "/api/jobs/dispatch",
        expect.any(Function)
      );
    });

    it("should forward webhook with correct headers and body", async () => {
      // Get the webhook handler function
      const postHandler = (server["app"].post as jest.Mock).mock.calls[0][1];

      const mockReq = {
        body: { testData: "test" },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      // Mock fetch response
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
      } as any);

      // Call the handler
      await postHandler(mockReq, mockRes);

      // Verify fetch was called with correct parameters
      expect(fetch).toHaveBeenCalledWith(
        mockConfig.forwardUrl,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockConfig.webhookSecret}`,
          },
          body: expect.any(String),
        })
      );

      // Verify the body structure
      const calledBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(calledBody).toMatchObject({
        attemptNumber: 1,
        status: "QUEUED",
        payload: mockReq.body,
      });
      expect(calledBody.jobId).toBeDefined();
      expect(calledBody.attempt).toBeDefined();
    });

    it("should handle errors appropriately", async () => {
      const postHandler = (server["app"].post as jest.Mock).mock.calls[0][1];

      const mockReq = { body: {} };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error("Network error")
      );

      await postHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
      });
    });
  });

  describe("listen", () => {
    it("should start server on specified port", () => {
      server.listen();
      expect(server["app"].listen).toHaveBeenCalledWith(
        mockConfig.port,
        expect.any(Function)
      );
    });
  });
});
