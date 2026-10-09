const apiKey = process.env.N8N_API_KEY || '';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';

async function update() {
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const wf = await res.json();

  // 1. Set responseMode = 'responseNode' on WhatsApp Entry (WAAU)
  const hook = wf.nodes.find(n => n.name === 'WhatsApp Entry (WAAU)');
  hook.parameters.responseMode = 'responseNode';

  // 2. Add Respond to Webhook node if not present
  let respondNode = wf.nodes.find(n => n.name === 'Respond to WAAU');
  if (!respondNode) {
    respondNode = {
      parameters: {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ status: "success", link: $json.link, message: $json.message, customerText: $json.customerText, to: $json.to }) }}',
        options: {}
      },
      id: 'respond-to-waau-node',
      name: 'Respond to WAAU',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [ 1200, 144 ]
    };
    wf.nodes.push(respondNode);
  } else {
    respondNode.parameters.responseBody = '={{ JSON.stringify({ status: "success", link: $json.link, message: $json.message, customerText: $json.customerText, to: $json.to }) }}';
  }

  // 3. Connect Build Link Message -> Respond to WAAU
  if (!wf.connections['Build Link Message']) {
    wf.connections['Build Link Message'] = { main: [[]] };
  }
  
  // Connect Build Link Message to both Respond to WAAU and Send WA Link (WAAU/HTTP)
  wf.connections['Build Link Message'].main = [
    [
      { node: 'Respond to WAAU', type: 'main', index: 0 },
      { node: 'Send WA Link (WAAU/HTTP)', type: 'main', index: 0 }
    ]
  ];

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

  const putData = await putRes.json();
  console.log('Update status:', putRes.status, 'Total nodes:', putData.nodes?.length);
}

update().catch(console.error);
