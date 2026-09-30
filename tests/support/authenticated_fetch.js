// Test-only credentials. This helper is never served by the application.
const jars=new Map();
async function getJar(origin){if(!jars.has(origin))jars.set(origin,(async()=>{const r=await global.fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Portal-Request':'1'},body:JSON.stringify({username:'admin',password:'Fixture-password-123!'})});if(!r.ok)throw Error('Fixture login failed: '+await r.text());const data=await r.json();return {cookie:r.headers.get('set-cookie').split(';')[0],id:data.user.id}})());return jars.get(origin)}
async function authenticatedFetch(url,options={}){const parsed=new URL(url);if(parsed.pathname.startsWith('/api/')){const jar=await getJar(parsed.origin);options={...options,headers:{...options.headers,Cookie:jar.cookie,'X-Portal-Request':'1','X-Portal-Account':jar.id}}}return global.fetch(url,options)}
authenticatedFetch.browser=async(base,call)=>{const jar=await getJar(base);await call('Network.setCookie',{name:'portal_session',value:jar.cookie.slice('portal_session='.length),url:base,path:'/',httpOnly:true,sameSite:'Strict'})};
module.exports=authenticatedFetch;
