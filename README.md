# DispatchedJs - CLI

This is a TypeScript helper library for node.js server side to integrate [Dispatched](https://dispatched.dev) into your application.

![NPM Version](https://img.shields.io/npm/v/%40dispatchedjs%2Fcli?style=flat) ![License](https://img.shields.io/npm/l/%40dispatchedjs%2Fcli?style=flat) ![example workflow](https://github.com/dispatched-dev/dispatchedjs-cli/actions/workflows/main.yml/badge.svg)

## Usage

When developing locally, you can use the [Dispatched CLI](https://github.com/dispatched-dev/dispatchedjs-cli) to start a local server that will receive webhook callbacks.

1. Install the CLI globally:

```bash
npm install -g @dispatchedjs/cli
```

2. Start the local server:

```bash
dispatchedjs listen --secret="any-webhook-secret-for-local-dev" --forward="http://localhost:3000/path/to/webhook/endpoint" --port=3000
```

Options:

- `--secret` is the secret you want to use to verify the webhook requests. For security reasons, it is recommended to use a different secret than the one you use in production (you can use something simple like "abc123" for local development).
- `--forward` is the URL that Dispatched will send the webhook requests to.
- `--port` is the port you want the server to listen on. It defaults to 3100.
- `--scheduledDelay` is the number of seconds to add to the current time when a job is created before dispatching it. Defaults to 30 seconds. This means jobs will be dispatched at (current time + delay), which mocks future webhook delivery for development purposes.

NOTE: Scheduled jobs will be processed with the configured delay when using the local server.

## License

MIT
