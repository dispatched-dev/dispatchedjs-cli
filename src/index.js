#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { Server } from "./server";

yargs(hideBin(process.argv))
  .command(
    "listen",
    "Start the webhook server",
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
    (argv) => {
      const server = new Server({
        webhookSecret: argv.secret,
        forwardUrl: argv.forward,
        port: argv.port,
      });
      server.listen();
    }
  )
  .scriptName("dispatchedjs")
  .usage(
    'Usage: dispatchedjs listen --secret="any-webhook-secret-for-local-dev" --forward="http://localhost:3000/path/to/webhook/endpoint" --port=3100'
  )
  .example(
    "$0 listen --secret \"abc123\" --forward \"http://localhost:3000/webhook\"",
    "Start webhook server"
  )
  .example(
    "$0 listen --secret \"abc123\" --forward\" http://localhost:3000/webhook\" --port 3200",
    "Start on custom port"
  )
  .describe("help", "Show help")
  .describe("version", "Show version number")
  .epilog(
    "For more information, visit https://github.com/dispatched-dev/dispatchedjs-cli.git"
  )
  .help().argv;
