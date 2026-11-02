const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';
const vpsBaseUrl = 'https://apt.tdpcs.in';

async function updateToVps() {
  console.log('1. Fetching current workflow from n8n API...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workflow: ${res.status} ${res.statusText}`);
  }
  const wf = await res.json();
  console.log(`Workflow fetched: "${wf.name}" (active: ${wf.active})`);

  let modifiedNodesCount = 0;

  for (const node of wf.nodes) {
    let nodeStr = JSON.stringify(node);
    if (nodeStr.includes('tdpcs-booking-systems.vercel.app')) {
      console.log(`Found vercel URL in node: "${node.name}"`);
      // Replace all occurrences of vercel domain with vpsBaseUrl
      const replacedStr = nodeStr.replaceAll('https://tdpcs-booking-systems.vercel.app', vpsBaseUrl);
      const updatedNode = JSON.parse(replacedStr);
      Object.assign(node, updatedNode);
      modifiedNodesCount++;
    }
  }

  console.log(`Total nodes updated: ${modifiedNodesCount}`);

  // Specifically verify Build Link Message assignments
  const linkNode = wf.nodes.find(n => n.name === 'Build Link Message');
  if (linkNode) {
    console.log('Updated assignments in Build Link Message:');
    console.log(JSON.stringify(linkNode.parameters.assignments, null, 2));
  }

  // Sanitize settings to allowed keys in n8n PUT API
  const cleanSettings = {
    executionOrder: wf.settings?.executionOrder || 'v1',
    saveManualExecutions: wf.settings?.saveManualExecutions,
    callerPolicy: wf.settings?.callerPolicy,
    timezone: wf.settings?.timezone || 'Asia/Kolkata'
  };
  Object.keys(cleanSettings).forEach(k => cleanSettings[k] === undefined && delete cleanSettings[k]);

  console.log('2. Saving updated workflow to n8n...');
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
  console.log(`Workflow successfully updated! ID: ${updatedWf.id}, Active: ${updatedWf.active}`);
}

updateToVps().catch(console.error);
