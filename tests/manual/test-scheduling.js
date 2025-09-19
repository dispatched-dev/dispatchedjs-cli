#!/usr/bin/env node

// Simple test script to verify the scheduling functionality
// Run this after starting the server with: node dist/index.js listen --secret "test123" --forward "http://httpbin.org/post" --scheduledDelay 5
//
// Usage: node tests/manual/test-scheduling.js

console.log("🧪 Testing Dispatched CLI Scheduling Functionality");
console.log("Make sure you have the server running with:");
console.log('node dist/index.js listen --secret "test123" --forward "http://httpbin.org/post" --scheduledDelay 5');
console.log("");

const SERVER_URL = "http://localhost:3100";

async function test() {
  console.log("📝 Test 1: Creating immediate job (should dispatch right away)");
  try {
    const response1 = await fetch(`${SERVER_URL}/api/jobs/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { message: "Immediate job test" }
      })
    });
    const job1 = await response1.json();
    console.log("✅ Immediate job created:", job1);
    console.log("");
  } catch (error) {
    console.error("❌ Error creating immediate job:", error.message);
  }

  console.log("📝 Test 2: Creating future scheduled job (should stay PENDING)");
  const futureTime = new Date(Date.now() + 15000).toISOString(); // 15 seconds from now
  try {
    const response2 = await fetch(`${SERVER_URL}/api/jobs/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledFor: futureTime,
        payload: { message: "Future job test", scheduledFor: futureTime }
      })
    });
    const job2 = await response2.json();
    console.log("✅ Future job created:", job2);
    console.log(`⏰ This job should be dispatched around: ${futureTime}`);
    console.log("🔍 Check the server logs to see it get dispatched automatically!");
    console.log("");
  } catch (error) {
    console.error("❌ Error creating future job:", error.message);
  }

  console.log("📝 Test 3: Testing job update functionality");
  try {
    // First create a future job
    const veryFutureTime = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
    const response3 = await fetch(`${SERVER_URL}/api/jobs/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledFor: veryFutureTime,
        payload: { message: "Job to be updated" }
      })
    });
    const job3 = await response3.json();
    console.log("✅ Future job created for update test:", job3);

    // Update it to run in 5 seconds
    const updateTime = new Date(Date.now() + 5000).toISOString();
    const updateResponse = await fetch(`${SERVER_URL}/api/jobs/${job3.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledFor: updateTime
      })
    });
    const updatedJob = await updateResponse.json();
    console.log("✅ Job updated:", updatedJob);
    console.log(`⏰ Updated job should be dispatched around: ${updateTime}`);
    console.log("");
  } catch (error) {
    console.error("❌ Error in update test:", error.message);
  }

  console.log("🎉 All tests completed! Monitor the server logs to see scheduled jobs being dispatched.");
  console.log("💡 The server checks for ready jobs every 1 second and adds a 5-second delay (as configured with --scheduledDelay 5)");
}

test().catch(console.error);