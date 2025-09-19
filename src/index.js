#!/usr/bin/env node
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {Server} from "./server";

const BIN_NAME = 'dispatchedjs';

yargs(hideBin(process.argv))
    .command(
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
        (argv) => {
            const server = new Server({
                webhookSecret: argv.secret,
                forwardUrl: argv.forward,
                port: argv.port,
            });
            server.listen();
        }
    )
    .command(
        "update <jobId>",
        "Update a job's scheduledFor time",
        {
            scheduledFor: {
                type: "string",
                demandOption: true,
                description: "New scheduled time (ISO string or relative like '5m', '1h')",
            },
            url: {
                type: "string",
                default: "http://localhost:3100",
                description: "Base URL of the dispatched server",
            },
        },
        async (argv) => {
            try {
                let scheduledFor = argv.scheduledFor;

                // Handle relative time formats like '5m', '1h', '30s'
                if (scheduledFor.match(/^\d+[smhd]$/)) {
                    const value = parseInt(scheduledFor.slice(0, -1));
                    const unit = scheduledFor.slice(-1);
                    let milliseconds = 0;

                    switch (unit) {
                        case 's': milliseconds = value * 1000; break;
                        case 'm': milliseconds = value * 60 * 1000; break;
                        case 'h': milliseconds = value * 60 * 60 * 1000; break;
                        case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
                    }

                    scheduledFor = new Date(Date.now() + milliseconds).toISOString();
                }

                const response = await fetch(`${argv.url}/api/jobs/${argv.jobId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ scheduledFor }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Error updating job:', error.error || response.statusText);
                    process.exit(1);
                }

                const job = await response.json();
                console.log('Job updated successfully:');
                console.log(JSON.stringify(job, null, 2));
            } catch (error) {
                console.error('Error updating job:', error.message);
                process.exit(1);
            }
        }
    )
    .demandCommand(1, 'You need at least one command before moving on')
    .scriptName(BIN_NAME)
    .usage(
        `Usage: ${BIN_NAME} <command> [options]`
    )
    .example(
        `${BIN_NAME} listen --secret "abc123" --forward "http://localhost:3000/webhook"`,
        "Start webhook server"
    )
    .example(
        `${BIN_NAME} listen --secret "abc123" --forward "http://localhost:3000/webhook" --port 3200`,
        "Start on custom port"
    )
    .example(
        `${BIN_NAME} update job123 --scheduledFor "2024-12-31T23:59:59Z"`,
        "Update job with specific time"
    )
    .example(
        `${BIN_NAME} update job123 --scheduledFor "5m"`,
        "Update job to run in 5 minutes"
    )
    .describe("help", "Show help")
    .describe("version", "Show version number")
    .epilog(
        "For more information, visit https://github.com/dispatched-dev/dispatchedjs-cli.git"
    )
    .showHelpOnFail(true, 'Specify --help for available options')
    .help().argv;
