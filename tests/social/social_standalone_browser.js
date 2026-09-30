// Run only through the isolated fixture runner; never use a production server.
const fetch = require('../support/authenticated_fetch.js');
const assert = require('node:assert/strict');
(async () => {
  const base = 'http://127.0.0.1:' + process.argv[2];
  const pages = await fetch('http://127.0.0.1:' + process.argv[3] + '/json/list').then(r => r.json());
  const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = ({data}) => {
    const m = JSON.parse(data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, {resolve, reject}); ws.send(JSON.stringify({id:n, method, params}));
  });
  const js = async expression => {
    const r = await call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await fetch.browser(base, call);
  await call('Runtime.enable'); await call('Page.enable');
  await call('Page.navigate', {url:base});
  let loaded = false;
  for (let i = 0; i < 150; i++) {
    if (await js("!!document.querySelector('#socialNav')")) { loaded = true; break; }
    await new Promise(r => setTimeout(r, 100));
  }
  assert(loaded, 'Portal did not initialise');
  await require('./social_browser.js')(js, call);
  assert.deepEqual(errors, []);
  ws.close();
})().catch(e => { console.error(e); process.exit(1); });
