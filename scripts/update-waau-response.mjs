const apiKey = process.env.N8N_API_KEY || '';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';
const appBaseUrl = 'https://tdpcs-booking-systems.vercel.app';

async function update() {
  console.log('1. Fetching workflow from n8n API...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const wf = await res.json();

  // Configure responseMode = 'responseNode' or 'lastNode' on WhatsApp Entry (WAAU)
  const hook = wf.nodes.find(n => n.name === 'WhatsApp Entry (WAAU)');
  if (hook) {
    hook.parameters.responseMode = 'lastNode';
    hook.parameters.responseData = 'firstEntryJson';
  }

  // Update Parse WA Message to parse WAAU variables (whatsapp_number, name, phone, etc.)
  const parseNode = wf.nodes.find(n => n.name === 'Parse WA Message');
  if (parseNode) {
    parseNode.parameters.jsCode = `
const body = $input.first().json.body || $input.first().json;
const from = body.whatsapp_number || body.phone || body.mobile || body.from || body.wa_id || body.sender || body.contact || '';
const name = body.name || body.customer_name || body.user_name || '';
const text = (body.text || body.message || body.body || '').toString().toLowerCase().trim();
const msgId = body.id || body.message_id || body.wamid || '';
return [{ json: { from: String(from).replace(/\\D/g,''), name, text, msgId, raw: body } }];
`;
  }

  // Update Build Link Message
  const linkNode = wf.nodes.find(n => n.name === 'Build Link Message');
  if (linkNode) {
    linkNode.parameters.assignments = {
      assignments: [
        { id: '1', name: 'to', value: "={{ $('Parse WA Message').item.json.from }}", type: 'string' },
        { id: '2', name: 'link', value: `={{ '${appBaseUrl}/b/' + $json.id }}`, type: 'string' },
        { id: '3', name: 'customerText', value: `={{ 'Tap the link below to book your slot (valid 2 hours):\\n${appBaseUrl}/b/' + $json.id }}`, type: 'string' },
        { id: '4', name: 'message', value: `={{ 'Welcome to Thrissur District Police Co-operative Society.\\n\\nTap the link below to book your appointment slot (valid 2 hours):\\n${appBaseUrl}/b/' + $json.id }}`, type: 'string' }
      ]
    };
  }

  // If Send WA Link node is connected, bypass it for lastNode response so WAAU gets the JSON immediately
  // Let's connect Build Link Message to respond back cleanly
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
  console.log('Update status:', putRes.status, 'Nodes:', putData.nodes?.length);
}

update().catch(console.error);
