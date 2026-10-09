import fs from 'fs';

const wf = JSON.parse(fs.readFileSync('scratch/workflow.json', 'utf8'));

console.log('=== WORKFLOW GENERAL INFO ===');
console.log('ID:', wf.id);
console.log('Name:', wf.name);
console.log('Active:', wf.active);

console.log('\n=== NODES SUMMARY ===');
for (const node of wf.nodes) {
  console.log(`[${node.type}] "${node.name}"`);
  if (node.type.includes('webhook')) {
    console.log('   Webhook Path:', node.parameters?.path, 'HTTP Method:', node.parameters?.httpMethod);
  }
  if (node.type.includes('supabase') || node.type.includes('postgres')) {
    console.log('   Credentials:', node.credentials);
    console.log('   Operation:', node.parameters?.operation, 'Table:', node.parameters?.table);
    console.log('   Parameters:', JSON.stringify(node.parameters));
  }
  if (node.name === 'Build Link Message' || node.name === 'Parse WA Message' || node.name === 'Parse Booking Event') {
    console.log('   Code preview:', node.parameters?.jsCode?.slice(0, 200) || JSON.stringify(node.parameters).slice(0, 200));
  }
  if (node.name.startsWith('Msgs:')) {
    console.log('   Message logic:', JSON.stringify(node.parameters).slice(0, 150));
  }
}
