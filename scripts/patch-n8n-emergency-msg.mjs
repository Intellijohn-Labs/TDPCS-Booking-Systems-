const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YzU5YjU0MS00NTRmLTRjZTYtYjIyNS02OThlODkyZDVmZmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjU2MjFlN2QtNWM0Zi00OTMyLWIzNWEtYWE4NDA0MzU5MTk4IiwiaWF0IjoxNzkxNDgyNDAxLCJleHAiOjE3OTQwMDYwMDB9.Hfd3YAwywshynMoFOTqzdEI8CeQOsIwhOsc0EC_AGBs';
const workflowId = '86QmzTAMJ83IQznP';
const n8nHost = 'https://n8n.srv1691210.hstgr.cloud';

async function update() {
  console.log('Fetching workflow from n8n...');
  const res = await fetch(`${n8nHost}/api/v1/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': apiKey }
  });
  const wf = await res.json();

  // 1. Update Msgs: booked
  const bookedNode = wf.nodes.find(n => n.name === 'Msgs: booked');
  if (bookedNode && bookedNode.parameters?.assignments?.assignments) {
    const custAssignment = bookedNode.parameters.assignments.assignments.find(a => a.name === 'customerMsg');
    if (custAssignment) {
      custAssignment.value = "={{ '✅ Booking confirmed\\nName: ' + $json.booking.customer_name + '\\nToken: ' + $json.booking.token_no + '\\nDate: ' + $json.booking.day + '\\nSlot: ' + String($json.booking.slot_start).slice(11,16) + ' – ' + String($json.booking.slot_end).slice(11,16) + '\\nReport by: ' + String($json.booking.report_time).slice(11,16) + ' (please arrive 10 minutes early)\\nCounter: ' + $json.booking.counter + '\\n\\n⚠️ Note: For loans requiring sureties’ signatures, the sureties must sign the documents before the allotted token time.' + (($json.booking.product_ids || []).map(Number).includes(2) ? '\\n\\n📄 Note: Bring pay slip for Emergency Loan.' : '') + '\\n\\nArriving after your slot time cancels the booking; you may then take a manual token at another counter.' }}";
      console.log('Updated Msgs: booked customerMsg');
    }
    const branchAssignment = bookedNode.parameters.assignments.assignments.find(a => a.name === 'branchMsg');
    if (branchAssignment) {
      branchAssignment.value = "={{ '🆕 New booking\\nName: ' + $json.booking.customer_name + ' (' + $json.booking.mobile + ')\\nToken: ' + $json.booking.token_no + ' | Counter ' + $json.booking.counter + '\\nDate: ' + $json.booking.day + '\\nSlot: ' + String($json.booking.slot_start).slice(11,16) + ' – ' + String($json.booking.slot_end).slice(11,16) + (($json.booking.product_ids || []).map(Number).includes(2) ? '\\nNote: Emergency Loan (Pay slip required)' : '') }}";
      console.log('Updated Msgs: booked branchMsg');
    }
  }

  // 2. Update Msgs: rescheduled
  const reschedNode = wf.nodes.find(n => n.name === 'Msgs: rescheduled');
  if (reschedNode && reschedNode.parameters?.assignments?.assignments) {
    const custAssignment = reschedNode.parameters.assignments.assignments.find(a => a.name === 'customerMsg');
    if (custAssignment) {
      custAssignment.value = "={{ '🔄 Booking updated\\nNew token: ' + $json.booking.token_no + '\\nDate: ' + $json.booking.day + '\\nSlot: ' + String($json.booking.slot_start).slice(11,16) + ' – ' + String($json.booking.slot_end).slice(11,16) + '\\nReport by: ' + String($json.booking.report_time).slice(11,16) + '\\nCounter: ' + $json.booking.counter + ($json.previous ? '\\n\\nPrevious booking: ' + $json.previous.token_no + ', ' + String($json.previous.slot_start).replace('T', ' ').slice(0, 16) : '') + '\\n\\n⚠️ Note: For loans requiring sureties’ signatures, the sureties must sign the documents before the allotted token time.' + (($json.booking.product_ids || []).map(Number).includes(2) ? '\\n\\n📄 Note: Bring pay slip for Emergency Loan.' : '') }}";
      console.log('Updated Msgs: rescheduled customerMsg');
    }
    const branchAssignment = reschedNode.parameters.assignments.assignments.find(a => a.name === 'branchMsg');
    if (branchAssignment) {
      branchAssignment.value = "={{ '🔄 Booking changed\\nName: ' + $json.booking.customer_name + ' (' + $json.booking.mobile + ')\\nNow: ' + $json.booking.token_no + ', ' + $json.booking.day + ' ' + String($json.booking.slot_start).slice(11,16) + ', Counter ' + $json.booking.counter + ($json.previous ? '\\nWas: ' + $json.previous.token_no + ', ' + String($json.previous.slot_start).replace('T', ' ').slice(0, 16) + ', Counter ' + $json.previous.counter : '') + (($json.booking.product_ids || []).map(Number).includes(2) ? '\\nNote: Emergency Loan (Pay slip required)' : '') }}";
      console.log('Updated Msgs: rescheduled branchMsg');
    }
  }

  const putPayload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' },
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
  if (!putRes.ok) {
    throw new Error(`Failed to update workflow: ${JSON.stringify(updated)}`);
  }
  console.log('n8n workflow updated successfully!', updated.name);
}

update().catch(console.error);
