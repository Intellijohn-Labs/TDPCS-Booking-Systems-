import fs from 'fs';
import pg from 'pg';

const apiKey = process.env.N8N_API_KEY || '';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';
const appBaseUrl = 'https://chatting-specked-cassette.ngrok-free.dev';

async function main() {
  console.log('1. Fetching current workflow from n8n API...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const wf = await res.json();
  console.log('Fetched workflow:', wf.name, 'Active:', wf.active);

  // 2. Patch "Create booking_links row"
  const createNode = wf.nodes.find(n => n.name === 'Create booking_links row');
  if (createNode) {
    console.log('Patching "Create booking_links row" fields...');
    createNode.parameters.fieldsUi = {
      fieldValues: [
        { fieldId: 'mobile', fieldValue: "={{ $('Parse WA Message').item.json.from }}" },
        { fieldId: 'purpose', fieldValue: 'book' }
      ]
    };
  }

  // 3. Patch "Build Link Message"
  const linkNode = wf.nodes.find(n => n.name === 'Build Link Message');
  if (linkNode) {
    console.log('Patching "Build Link Message" with app domain:', appBaseUrl);
    linkNode.parameters.assignments = {
      assignments: [
        {
          id: '1',
          name: 'to',
          value: "={{ $('Parse WA Message').item.json.from }}",
          type: 'string'
        },
        {
          id: '2',
          name: 'link',
          value: `={{ '${appBaseUrl}/b/' + $json.id }}`,
          type: 'string'
        },
        {
          id: '3',
          name: 'customerText',
          value: `={{ 'Tap the link below to book your slot (valid 2 hours):\\n${appBaseUrl}/b/' + $json.id }}`,
          type: 'string'
        }
      ]
    };
  }

  // 4. Add continueOnFail to external HTTP request nodes so placeholder WhatsApp URLs do not crash the workflow
  const httpNodeNames = [
    'Send WA Link (WAAU/HTTP)',
    'Send Customer WA',
    'Send Branch WA',
    'Send Reminder WA',
    'Send Error to Admin WA'
  ];
  for (const name of httpNodeNames) {
    const node = wf.nodes.find(n => n.name === name);
    if (node) {
      console.log(`Setting continueOnFail=true on "${name}"`);
      node.continueOnFail = true;
    }
  }

  // 5. Send PUT update to n8n
  console.log('5. Updating workflow in n8n...');
  const putRes = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: {
        executionOrder: 'v1'
      }
    })
  });

  const putData = await putRes.json();
  if (!putRes.ok) {
    console.error('Failed to update n8n workflow:', putData);
    process.exit(1);
  }
  console.log('n8n Workflow updated successfully! Updated nodes count:', putData.nodes?.length);

  // 6. Update settings in Supabase to connect Supabase to n8n webhook
  console.log('6. Connecting Supabase database settings to n8n webhook...');
  const { Client } = pg;
  const client = new Client({
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.jktoipmsdvcnljogitos',
    password: process.env.PGPASSWORD || '',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const webhookUrl = `${n8nHost}/webhook/tdpcs-booking-events`;
  await client.query(`
    INSERT INTO settings (key, value)
    VALUES ('n8n_webhook_url', $1), ('client_notify_number', '919876543200')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `, [webhookUrl]);

  console.log(`Supabase settings updated! n8n_webhook_url = ${webhookUrl}`);
  await client.end();
}

main().catch(console.error);
