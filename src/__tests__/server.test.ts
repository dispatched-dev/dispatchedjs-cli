import { Server } from '../server';
import express, { Express, Request, Response } from 'express';

// Create mock types
type MockExpress = jest.Mocked<Express> & {
    use: jest.Mock;
    post: jest.Mock;
    listen: jest.Mock;
};

type MockExpressFactory = jest.Mock<MockExpress>;

// Mock express and its methods
jest.mock('express', () => {
    const json = jest.fn();
    const mockApp = {
        use: jest.fn(),
        post: jest.fn(),
        listen: jest.fn((port, callback) => callback()),
    };
    return Object.assign(jest.fn(() => mockApp), { json });
});

// Mock fetch
global.fetch = jest.fn();

describe('Server', () => {
    let server: Server;
    let mockExpressApp: MockExpress;

    const mockConfig = {
        webhookSecret: 'test-secret',
        forwardUrl: 'http://test-forward-url.com',
        port: 3000
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

    describe('webhook endpoint', () => {
        it('should process webhook and forward request', async () => {
            // Get the webhook handler function
            const webhookHandler = mockExpressApp.post.mock.calls[0][1];

            // Mock request and response objects
            const mockReq = {
                body: { data: 'test-data' }
            } as Request;

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            } as unknown as Response;

            // Mock successful fetch response
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200
            });

            // Call the webhook handler
            await webhookHandler(mockReq, mockRes);

            // Verify fetch was called with correct parameters
            expect(global.fetch).toHaveBeenCalledWith(
                mockConfig.forwardUrl,
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mockConfig.webhookSecret}`
                    },
                    body: expect.stringContaining('"payload":{"data":"test-data"}')
                })
            );
        });

        it('should handle errors and return 500 status', async () => {
            const webhookHandler = mockExpressApp.post.mock.calls[0][1];

            const mockReq = {
                body: { data: 'test-data' }
            } as Request;

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            } as unknown as Response;

            // Mock fetch error
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            // Call the webhook handler
            await webhookHandler(mockReq, mockRes);

            // Verify error handling
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Internal server error'
            });
        });
    });

    describe('listen', () => {
        it('should start server on specified port', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            server.listen();

            expect(mockExpressApp.listen).toHaveBeenCalledWith(
                mockConfig.port,
                expect.any(Function)
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(`🚀 Webhook server running on port ${mockConfig.port}`)
            );

            consoleSpy.mockRestore();
        });
    });
});
