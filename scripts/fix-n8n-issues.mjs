const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';
const adminPhone = '917736956474';

async function updateN8n() {
  console.log('1. Fetching live workflow from n8n...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workflow: ${res.status} ${res.statusText}`);
  }
  const wf = await res.json();
  console.log(`Fetched workflow: "${wf.name}"`);

  // --- FIX ISSUE 2: Decouple Auto-generate Calendar from Delete expired links ---
  console.log('\n2. Decoupling Auto-generate Calendar Days from Delete expired booking_links...');
  
  // Connect Cleanup Schedule (Daily 02:00 IST) directly to both nodes:
  // 1) Delete expired booking_links
  // 2) Auto-generate Calendar Days (Daily)
  wf.connections['Cleanup Schedule (Daily 02:00 IST)'] = {
    main: [
      [
        { node: 'Delete expired booking_links', type: 'main', index: 0 },
        { node: 'Auto-generate Calendar Days (Daily)', type: 'main', index: 0 }
      ]
    ]
  };

  // Remove downstream connection from Delete expired booking_links so it is completely independent
  delete wf.connections['Delete expired booking_links'];
  console.log('   Updated connections: Cleanup Schedule now triggers both independently in parallel!');

  // --- FIX ISSUE 3: Update Admin Alert Phone Number ---
  console.log('\n3. Updating Admin Error Alert Phone Number to', adminPhone, '...');
  const errorNode = wf.nodes.find(n => n.name === 'Send Error to Admin WA');
  if (errorNode) {
    console.log('   Previous jsonBody:', errorNode.parameters.jsonBody);
    errorNode.parameters.jsonBody = `={{ JSON.stringify({ to: "${adminPhone}", type: "text", text: { body: $json.alertText } }) }}`;
    console.log('   Updated jsonBody:', errorNode.parameters.jsonBody);
  } else {
    console.warn('   Send Error to Admin WA node not found!');
  }

  // Sanitize settings for n8n API
  const cleanSettings = {
    executionOrder: wf.settings?.executionOrder || 'v1',
    saveManualExecutions: wf.settings?.saveManualExecutions,
    callerPolicy: wf.settings?.callerPolicy,
    timezone: wf.settings?.timezone || 'Asia/Kolkata'
  };
  Object.keys(cleanSettings).forEach(k => cleanSettings[k] === undefined && delete cleanSettings[k]);

  console.log('\n4. Saving updated workflow to n8n...');
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
    const errBody = await putRes.text();
    throw new Error(`Failed to update workflow: ${putRes.status} ${errBody}`);
  }

  const updatedWf = await putRes.json();
  console.log(`Successfully updated n8n workflow! (Active: ${updatedWf.active})`);
}

updateN8n().catch(console.error);
