import fs from 'fs';

const apiKey = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';
const adminNumbers = ['919497800711', '919846834778'];

async function patch() {
  console.log('1. Fetching live workflow from n8n...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workflow: ${res.status} ${res.statusText}`);
  }
  const wf = await res.json();
  console.log(`Fetched workflow: "${wf.name}" (Active: ${wf.active}, Nodes: ${wf.nodes.length})`);

  // 2. Define the new Code node: "Build Admin Booking Template"
  const buildAdminCode = `
const booking = $input.first().json.booking || {};
const adminNumbers = ['919497800711', '919846834778'];

const productMap = {
  1: 'Simple Loan',
  2: 'Emergency Loan',
  3: 'Education Loan',
  4: 'Professional Edu. Loan',
  5: 'Vehicle Loan',
  6: 'Hire Purchase Loan',
  7: 'Chitty Prized Withdrawal'
};

const customerName = String(booking.customer_name || 'Member').trim() || 'Member';
const mobile = String(booking.mobile || '').replace(/\\D/g, '').trim() || '-';
const tokenNo = String(booking.token_no || '').trim() || '-';
const counter = String(booking.counter || '1').trim() || '1';
const day = String(booking.day || '').trim() || '-';
const slotStart = String(booking.slot_start || '').slice(11, 16);
const slotEnd = String(booking.slot_end || '').slice(11, 16);
const timeSlot = (slotStart && slotEnd) ? (slotStart + ' - ' + slotEnd) : 'Standard Slot';

const pids = Array.isArray(booking.product_ids) ? booking.product_ids.map(Number) : [];
const serviceType = pids.length > 0 
  ? pids.map(id => productMap[id] || ('Service #' + id)).join(', ') 
  : 'General Service';

return adminNumbers.map(adminPhone => ({
  json: {
    to: adminPhone,
    payload: {
      to: adminPhone,
      recipient_type: 'individual',
      type: 'template',
      template: {
        language: {
          policy: 'deterministic',
          code: 'en'
        },
        name: 'member_booking_notification',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName },
              { type: 'text', text: mobile },
              { type: 'text', text: tokenNo },
              { type: 'text', text: counter },
              { type: 'text', text: day },
              { type: 'text', text: timeSlot },
              { type: 'text', text: serviceType }
            ]
          }
        ]
      }
    }
  }
}));
`.trim();

  // Remove existing nodes if previously added
  wf.nodes = wf.nodes.filter(n => n.name !== 'Build Admin Booking Template' && n.name !== 'Send Admin Booking Template (WAAU)');

  // Add Build Admin Booking Template node
  const buildNode = {
    parameters: {
      jsCode: buildAdminCode
    },
    id: 'c7b3d109-2b11-471a-8e4a-00b8c1223701',
    name: 'Build Admin Booking Template',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1232, 384]
  };
  wf.nodes.push(buildNode);

  // Add Send Admin Booking Template (WAAU) node
  const sendNode = {
    parameters: {
      method: 'POST',
      url: 'https://crmapi.waau.in/api/meta/v19.0/850061654849967/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: {
        timeout: 15000
      }
    },
    id: 'd8f4e21a-4c22-482a-9f5b-11c9d2334801',
    name: 'Send Admin Booking Template (WAAU)',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [1472, 384],
    credentials: {
      httpBearerAuth: {
        id: 'CJdTnedIcRymQxfo',
        name: 'Bearer Auth account Thrissur District Police Coop'
      }
    },
    continueOnFail: true
  };
  wf.nodes.push(sendNode);

  // 3. Update Connections:
  // "Msgs: booked" -> should connect to "Send Customer WA" AND "Build Admin Booking Template"
  // (Remove old Send Branch WA from Msgs: booked)
  wf.connections['Msgs: booked'] = {
    main: [
      [
        { node: 'Send Customer WA', type: 'main', index: 0 },
        { node: 'Build Admin Booking Template', type: 'main', index: 0 }
      ]
    ]
  };

  // "Build Admin Booking Template" -> connects to "Send Admin Booking Template (WAAU)"
  wf.connections['Build Admin Booking Template'] = {
    main: [
      [
        { node: 'Send Admin Booking Template (WAAU)', type: 'main', index: 0 }
      ]
    ]
  };

  console.log('Connections configured:');
  console.log('Msgs: booked ->', wf.connections['Msgs: booked']);
  console.log('Build Admin Booking Template ->', wf.connections['Build Admin Booking Template']);

  // Clean settings for n8n API
  const cleanSettings = {
    executionOrder: wf.settings?.executionOrder || 'v1',
    saveManualExecutions: wf.settings?.saveManualExecutions,
    callerPolicy: wf.settings?.callerPolicy,
    timezone: wf.settings?.timezone || 'Asia/Kolkata'
  };
  Object.keys(cleanSettings).forEach(k => cleanSettings[k] === undefined && delete cleanSettings[k]);

  // 4. PUT updated workflow to n8n
  console.log('\n4. Uploading updated workflow to n8n...');
  const putPayload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: cleanSettings
  };

  const putRes = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(putPayload)
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Failed to update workflow: ${putRes.status} ${errText}`);
  }

  const updatedWf = await putRes.json();
  console.log(`Successfully updated n8n workflow "${updatedWf.name}"!`);
  console.log(`Active status: ${updatedWf.active}, Nodes count: ${updatedWf.nodes.length}`);

  // Also update local scratch/workflow.json
  fs.writeFileSync('scratch/workflow.json', JSON.stringify(updatedWf, null, 2), 'utf8');
  console.log('Saved updated workflow copy to scratch/workflow.json');
}

patch().catch(console.error);
