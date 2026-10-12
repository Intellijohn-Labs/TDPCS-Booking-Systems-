const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';
const vercelBaseUrl = 'https://tdpcs-booking-systems.vercel.app';

async function update() {
  console.log('Fetching workflow from n8n...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workflow: ${res.statusText}`);
  }
  const wf = await res.json();

  const linkNode = wf.nodes.find(n => n.name === 'Build Link Message');
  if (!linkNode) {
    throw new Error('Build Link Message node not found');
  }

  console.log('Current link node parameters:', JSON.stringify(linkNode.parameters, null, 2));

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
        value: `={{ '${vercelBaseUrl}/b/' + $json.id }}`,
        type: 'string'
      },
      {
        id: '3',
        name: 'customerText',
        value: `={{ 'Tap the link below to book your slot (valid 2 hours):\\n${vercelBaseUrl}/b/' + $json.id }}`,
        type: 'string'
      },
      {
        id: '4',
        name: 'message',
        value: `={{ 'Welcome to Thrissur District Police Co-operative Society.\\n\\nTap the link below to book your appointment slot (valid 2 hours):\\n${vercelBaseUrl}/b/' + $json.id }}`,
        type: 'string'
      }
    ]
  };

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
  console.log('Successfully updated n8n workflow with Vercel URL!');
}

update().catch(console.error);
