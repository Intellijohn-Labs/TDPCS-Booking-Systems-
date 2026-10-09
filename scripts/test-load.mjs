async function test() {
  console.log('Testing localhost...');
  const res = await fetch('http://localhost:3002/login');
  console.log('Local status:', res.status);
  const html = await res.text();
  const cssMatches = [...html.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map(m => m[1]);
  console.log('Found CSS files:', cssMatches);
  for (const cssUrl of cssMatches) {
    const cssRes = await fetch('http://localhost:3002' + cssUrl);
    console.log('CSS:', cssUrl, 'Status:', cssRes.status, 'Bytes:', (await cssRes.text()).length);
  }

  console.log('\nTesting ngrok tunnel...');
  const ngrokRes = await fetch('https://chatting-specked-cassette.ngrok-free.dev/login', {
    headers: { 'ngrok-skip-browser-warning': 'true' }
  });
  console.log('Ngrok status:', ngrokRes.status);
  const ngrokHtml = await ngrokRes.text();
  const ngrokCss = [...ngrokHtml.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map(m => m[1]);
  for (const cssUrl of ngrokCss) {
    const cssRes = await fetch('https://chatting-specked-cassette.ngrok-free.dev' + cssUrl, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    console.log('Ngrok CSS:', cssUrl, 'Status:', cssRes.status, 'Bytes:', (await cssRes.text()).length);
  }
}

test().catch(console.error);
