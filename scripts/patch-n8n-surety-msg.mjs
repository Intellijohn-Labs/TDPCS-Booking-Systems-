const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';

async function update() {
  console.log('Fetching workflow from n8n...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const wf = await res.json();

  const msgNode = wf.nodes.find(n => n.name === 'Msgs: booked');
  if (msgNode && msgNode.parameters?.assignments?.assignments) {
    const custAssignment = msgNode.parameters.assignments.assignments.find(a => a.name === 'customerMsg');
    if (custAssignment) {
      custAssignment.value = "={{ '✅ Booking confirmed\\nName: ' + $json.booking.customer_name + '\\nToken: ' + $json.booking.token_no + '\\nDate: ' + $json.booking.day + '\\nSlot: ' + String($json.booking.slot_start).slice(11,16) + ' – ' + String($json.booking.slot_end).slice(11,16) + '\\nReport by: ' + String($json.booking.report_time).slice(11,16) + ' (please arrive 10 minutes early)\\nCounter: ' + $json.booking.counter + '\\n\\n⚠️ Note: For loans requiring sureties’ signatures, the sureties must sign the documents before the allotted token time.\\n\\nArriving after your slot time cancels the booking; you may then take a manual token at another counter.' }}";
      console.log('Updated customerMsg with surety notice!');
    }
  }

  const putPayload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings,
  };

  const putRes = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(putPayload)
  });

  const updated = await putRes.json();
  console.log('n8n workflow updated successfully!', updated.name);
}

update().catch(console.error);
