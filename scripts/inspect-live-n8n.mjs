const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';

async function check() {
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  if (!res.ok) {
    console.error('Fetch failed:', res.status, res.statusText);
    return;
  }
  const wf = await res.json();
  console.log('Workflow Name:', wf.name);
  console.log('Active:', wf.active);

  for (const node of wf.nodes) {
    const s = JSON.stringify(node);
    if (s.includes('vercel.app') || s.includes('tdpcs')) {
      console.log(`\nNode: "${node.name}" (${node.type})`);
      const matches = s.match(/https?:\/\/[^\s"'\\}]+/g) || [];
      console.log('Matches:', matches);
    }
  }
}

check().catch(console.error);
