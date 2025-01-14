import yargs from "yargs";

import { Server } from "../server";

// Mock dependencies
jest.mock("yargs", () => {
  const mockYargs = jest.fn(() => ({
    command: jest.fn().mockReturnThis(),
    demandCommand: jest.fn().mockReturnThis(),
    scriptName: jest.fn().mockReturnThis(),
    usage: jest.fn().mockReturnThis(),
    example: jest.fn().mockReturnThis(),
    describe: jest.fn().mockReturnThis(),
    epilog: jest.fn().mockReturnThis(),
    showHelpOnFail: jest.fn().mockReturnThis(),
    help: jest.fn().mockReturnThis(),
    argv: {},
  }));
  mockYargs.hideBin = jest.fn((args) => args);
  return mockYargs;
});

jest.mock("../server");

describe("CLI", () => {
  let mockServer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = {
      listen: jest.fn(),
    };
    Server.mockImplementation(() => mockServer);
  });

  it("should initialize yargs with correct commands and options", async () => {
    // Execute the CLI code
    jest.isolateModules(() => {
      require("../index.js");
    });

    // Remove duplicate options and fix the order of verification
    expect(yargs).toHaveBeenCalled();
    const yargsInstance = yargs.mock.results[0].value;
    expect(yargsInstance.command).toHaveBeenCalledWith(
      "listen",
      "Start the local webhook server",
      {
        secret: {
          type: "string",
          demandOption: true,
          description:
            "Secret for webhook validation (e.g. 'abc123' for local dev)",
        },
        forward: {
          type: "string",
          demandOption: true,
          description:
            "URL to forward webhooks to (e.g. http://localhost:3000/webhook)",
        },
        port: {
          type: "number",
          default: 3100,
          description: "Port to run the server on",
        },
      },
      expect.any(Function)
    );
  });

  it("should initialize and start server with correct config when listen command is used", async () => {
    jest.isolateModules(() => {
      require("../index");
    });

    // Get the command handler
    const yargsInstance = yargs.mock.results[0].value;
    const commandHandler = yargsInstance.command.mock.calls[0][3];

    // Execute handler with test args
    const testArgs = {
      secret: "test-secret",
      forward: "http://test-url",
      port: 3200,
    };
    commandHandler(testArgs);

    // Verify server initialization
    expect(Server).toHaveBeenCalledWith({
      webhookSecret: "test-secret",
      forwardUrl: "http://test-url",
      port: 3200,
    });

    // Verify server started
    expect(mockServer.listen).toHaveBeenCalled();
  });
});
