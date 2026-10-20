const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';

async function update() {
  console.log('Fetching workflow from n8n...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const wf = await res.json();

  const nodeName = 'Purge 4-Month Old Records (Daily)';
  let purgeNode = wf.nodes.find(n => n.name === nodeName);

  if (!purgeNode) {
    purgeNode = {
      parameters: {
        method: 'POST',
        url: 'https://jktoipmsdvcnljogitos.supabase.co/rest/v1/rpc/purge_old_records_4months',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'apikey', value: 'sb_publishable_7PCJ9vSzaa8ZvH9hSYCkEg_ZH2PAi51' },
            { name: 'Authorization', value: 'Bearer sb_publishable_7PCJ9vSzaa8ZvH9hSYCkEg_ZH2PAi51' },
            { name: 'Content-Type', value: 'application/json' }
          ]
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '{}',
        options: {
          timeout: 15000
        }
      },
      id: 'purge-4months-node',
      name: nodeName,
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [960, 1040],
      continueOnFail: true
    };
    wf.nodes.push(purgeNode);
    console.log('Added new node:', nodeName);
  }

  // Connect Auto-generate Calendar Days (Daily) -> Purge 4-Month Old Records (Daily)
  wf.connections['Auto-generate Calendar Days (Daily)'] = {
    main: [
      [
        { node: nodeName, type: 'main', index: 0 }
      ]
    ]
  };

  console.log('Sending PUT update to n8n...');
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
      settings: { executionOrder: 'v1' }
    })
  });

  const updated = await putRes.json();
  if (!putRes.ok) {
    throw new Error(`Failed to update workflow: ${JSON.stringify(updated)}`);
  }

  console.log('n8n workflow successfully updated with daily 4-month retention purge!');
}

update().catch(console.error);
