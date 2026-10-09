import fs from 'fs';

const wf = JSON.parse(fs.readFileSync('scratch/workflow.json', 'utf8'));

console.log('=== Create booking_links row node ===');
const createNode = wf.nodes.find(n => n.name === 'Create booking_links row');
console.log(JSON.stringify(createNode, null, 2));

console.log('=== Build Link Message node ===');
const linkNode = wf.nodes.find(n => n.name === 'Build Link Message');
console.log(JSON.stringify(linkNode, null, 2));

console.log('=== Parse WA Message node ===');
const parseNode = wf.nodes.find(n => n.name === 'Parse WA Message');
console.log(JSON.stringify(parseNode, null, 2));

console.log('=== Send WA Link (WAAU/HTTP) ===');
const waNode = wf.nodes.find(n => n.name === 'Send WA Link (WAAU/HTTP)');
console.log(JSON.stringify(waNode, null, 2));
