#!/usr/bin/env node

// Test script to verify error handling for non-existent jobs
// Usage: node tests/manual/test-error.js

const SERVER_URL = "http://localhost:3100";

async function testNonExistentJob() {
  try {
    const response = await fetch(`${SERVER_URL}/api/jobs/non-existent-job-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledFor: new Date().toISOString() })
    });
    
    if (\!response.ok) {
      const error = await response.json();
      console.log("Error response from server:");
      console.log(JSON.stringify(error, null, 2));
      console.log("");
      console.log("Error message that would be shown to user:");
      const errorMessage = error.message || error.error || response.statusText;
      console.log(errorMessage);
    }
  } catch (error) {
    console.error("Network error:", error.message);
  }
}

console.log("Testing non-existent job error response...");
console.log("(Make sure server is running first)");
testNonExistentJob();
