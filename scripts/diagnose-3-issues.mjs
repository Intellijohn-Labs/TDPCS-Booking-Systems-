import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.jktoipmsdvcnljogitos:YFf%264i-rjefWa%23%25@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';

async function diagnose() {
  await client.connect();

  console.log('=== 1. CHECKING BOOKINGS COLUMNS IN SUPABASE ===');
  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings' ORDER BY ordinal_position");
  console.log('Columns:', cols.rows.map(c => `${c.column_name} (${c.data_type})`));
  const hasReminderSent = cols.rows.some(c => c.column_name === 'reminder_sent');
  console.log('Does reminder_sent exist in bookings?', hasReminderSent);

  console.log('\n=== 2. CHECKING SETTINGS FOR ADMIN NUMBER ===');
  const settings = await client.query("SELECT * FROM settings");
  console.log('Settings:', settings.rows);

  console.log('\n=== 3. FETCHING LIVE N8N WORKFLOW ===');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const wf = await res.json();
  console.log('Workflow Name:', wf.name);

  // Check reminder node
  console.log('\n--- Checking Reminder Nodes ---');
  for (const n of wf.nodes) {
    if (n.name.toLowerCase().includes('reminder') || n.name.toLowerCase().includes('upcoming')) {
      console.log(`Node: "${n.name}" (${n.type})`);
      console.log('Parameters:', JSON.stringify(n.parameters, null, 2));
    }
  }

  // Check cleanup & auto-calendar nodes
  console.log('\n--- Checking Cleanup / Auto-calendar Nodes ---');
  for (const n of wf.nodes) {
    if (n.name.toLowerCase().includes('cleanup') || n.name.toLowerCase().includes('expired') || n.name.toLowerCase().includes('calendar')) {
      console.log(`Node: "${n.name}" (${n.type})`);
      console.log('Parameters:', JSON.stringify(n.parameters, null, 2));
    }
  }

  // Check connections from cleanup
  console.log('\n--- Checking Connections for Cleanup ---');
  for (const [nodeName, conn] of Object.entries(wf.connections)) {
    if (nodeName.toLowerCase().includes('cleanup') || nodeName.toLowerCase().includes('expired')) {
      console.log(`Connections from "${nodeName}":`, JSON.stringify(conn, null, 2));
    }
  }

  // Check error alert nodes
  console.log('\n--- Checking Error Alert Nodes ---');
  for (const n of wf.nodes) {
    if (n.name.toLowerCase().includes('error') || n.name.toLowerCase().includes('alert')) {
      console.log(`Node: "${n.name}" (${n.type})`);
      console.log('Parameters:', JSON.stringify(n.parameters, null, 2));
    }
  }

  await client.end();
}

diagnose().catch(console.error);
