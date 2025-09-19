# Manual Tests

This directory contains manual test scripts to verify the Dispatched CLI functionality.

## Prerequisites

1. Build the CLI first:
   ```bash
   npm run build
   ```

2. Start the webhook server:
   ```bash
   node dist/index.js listen --secret "test123" --forward "http://httpbin.org/post" --scheduledDelay 5
   ```

## Test Scripts

### `test-scheduling.js`

Tests the job scheduling functionality including:
- Immediate job dispatch
- Future job scheduling with delays
- Job updates and rescheduling

**Usage:**
```bash
node tests/manual/test-scheduling.js
```

**What it tests:**
- Creates immediate jobs (dispatched right away)
- Creates future jobs (dispatched after scheduledDelay)
- Updates jobs to new scheduled times
- Verifies scheduler behavior

### `test-error.js`

Tests error handling for non-existent jobs.

**Usage:**
```bash
node tests/manual/test-error.js
```

**What it tests:**
- Attempts to update a non-existent job
- Verifies proper error response format
- Shows the error message that would be displayed to users

## Expected Behavior

### Scheduling Test
- Immediate jobs should dispatch within 5 seconds (due to scheduledDelay)
- Future jobs should dispatch at their scheduled time + 5 seconds
- Updated jobs should dispatch at their new time + 5 seconds

### Error Test
Should return:
```json
{
  "error": "Job not found",
  "message": "Job with id 'non-existent-job-id' does not exist",
  "code": "JOB_NOT_FOUND"
}
```

## Notes

- These tests require a running server to work
- Use `http://httpbin.org/post` as a test webhook endpoint
- Monitor server logs to see job dispatch timing
- The scheduler checks every 1 second for ready jobs