/**
 * ReachInbox Load & Concurrency Simulation Script
 *
 * This script tests the scheduler under load:
 * 1. Schedules a batch of emails
 * 2. Observes rate limiting and automatic rescheduling to the next hour window
 * 3. Triggers the live Slack notification
 */

const API_BASE = process.env.API_BASE || 'http://localhost:5001/api';

async function runSimulation() {
  console.log('🚀 Starting ReachInbox Load & Rate-Limiting Simulation...\n');

  // Generate 15 test recipients
  const recipients = Array.from({ length: 15 }, (_, i) => `lead_${i + 1}@sampleoutreach.io`);

  console.log(`📋 Scheduling ${recipients.length} emails with hourlyLimit=5 to demonstrate rate-limiting...`);

  try {
    const response = await fetch(`${API_BASE}/emails/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'ReachInbox Load Test Simulation',
        body: 'This is an automated test email to verify worker concurrency, provider delay, and hourly rate limits.',
        recipients,
        senderEmail: 'test.load@reachinbox.ai',
        delayBetweenEmails: 1,
        hourlyLimit: 5, // Intentionally low limit to trigger hourly threshold and Slack alert!
      }),
    });

    const data = await response.json();
    console.log(`✅ Scheduling response status: ${response.status}`);
    console.log(`📨 Scheduled count: ${data.count}`);
    console.log('\n📊 Check the dashboard at http://localhost:3000 and BullMQ Board at http://localhost:5001/admin/queues');
  } catch (err) {
    console.error('❌ Failed to run simulation:', err.message);
  }
}

runSimulation();
