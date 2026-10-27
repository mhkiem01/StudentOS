const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),adminFetch=require('../support/authenticated_fetch.js');
// Two real accounts in one browser (separate browser contexts): rooms, instant chat, YouTube cards,
// a group call with microphone, camera and screen sharing, Watch together and a ringing direct call.
// Run with: python tests/support/run_browser_check.py --calls  (uses Chrome/Edge fake camera and microphone).
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug='http://127.0.0.1:'+process.argv[3];
 const connect=async url=>{const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map(),errors=[],logs=[];
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&['warning','error'].includes(m.params.type))logs.push(m.params.args.map(a=>a.value??a.description).join(' '))};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
  const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,600));return r.result.value};
  const wait=async(q,ms=15000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await js(q))return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error(['Timeout: '+q,await js('JSON.stringify(window.portalSocialCalls?.debug?.())').catch(()=>''),'traffic: '+await js('window.portalSocialCalls?.traffic?.().then(JSON.stringify)').catch(()=>''),'console: '+logs.slice(-8).join(' | ')].join('\n'))};
  return {ws,call,js,wait,errors,logs}};
 const shots=path.join(os.tmpdir(),'portal-social-calls');fs.mkdirSync(shots,{recursive:true});
 const shot=async(page,name)=>{const s=await page.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(shots,name+'.png'),Buffer.from(s.data,'base64'))};

 // Accounts: the fixture admin and a second student who changes the temporary password.
 const json=(r)=>r.json().then(j=>{if(!r.ok)throw Error(JSON.stringify(j));return j});
 const post=(f,url,body)=>f(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(json);
 await post(adminFetch,'/api/admin/users',{username:'callfriend',display_name:'Casey Friend',password:'Temporary-pass-123!'});
 const login=async password=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Portal-Request':'1'},body:JSON.stringify({username:'callfriend',password})});const j=await json(r);return {cookie:r.headers.get('set-cookie').split(';')[0],id:j.user.id,must:j.user.must_change}};
 let friend=await login('Temporary-pass-123!');
 if(friend.must){await fetch(base+'/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json','X-Portal-Request':'1','X-Portal-Account':friend.id,Cookie:friend.cookie},body:JSON.stringify({current_password:'Temporary-pass-123!',new_password:'Fixture-password-456!'})});friend=await login('Fixture-password-456!')}
 const friendFetch=(url,o={})=>fetch(url,{...o,headers:{...o.headers,Cookie:friend.cookie,'X-Portal-Request':'1','X-Portal-Account':friend.id}});
 const social=(f,action,data={},id)=>post(f,'/api/social',{action,data,id});
 await social(adminFetch,'profile',{enabled:true,discoverable:true});await social(friendFetch,'profile',{enabled:true,discoverable:true});
 await social(adminFetch,'friend',{user_id:friend.id,operation:'request'});await social(friendFetch,'friend',{user_id:'admin',operation:'accept'});
 const group=(await social(adminFetch,'space',{kind:'study',name:'Calculus crew',description:'Weekly study calls'})).id;
 await social(adminFetch,'membership',{operation:'invite',user_id:friend.id},group);await social(friendFetch,'membership',{operation:'accept_invite'},group);
 const dm=(await social(adminFetch,'dm',{user_id:friend.id})).id;

 // Two pages: A = admin (default context), B = Casey (a separate browser context with its own cookies).
 const version=await fetch(debug+'/json/version').then(r=>r.json()),browser=await connect(version.webSocketDebuggerUrl);
 const {browserContextId}=await browser.call('Target.createBrowserContext');const {targetId}=await browser.call('Target.createTarget',{url:'about:blank',browserContextId});
 const list=await fetch(debug+'/json/list').then(r=>r.json());
 const A=await connect(list.find(p=>p.type==='page'&&p.id!==targetId).webSocketDebuggerUrl),B=await connect(list.find(p=>p.id===targetId).webSocketDebuggerUrl);
 for(const page of [A,B]){await page.call('Runtime.enable');await page.call('Page.enable');await page.call('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false})}
 await adminFetch.browser(base,A.call);await B.call('Network.setCookie',{name:'portal_session',value:friend.cookie.slice('portal_session='.length),url:base,path:'/',httpOnly:true,sameSite:'Strict'});
 // A stand-in YouTube player records what Watch together asks it to do (the real one needs the internet).
 const stub=`window.__yt=[];window.YT={Player:class{constructor(el,o){this.o=o;this.state=-1;this.time=0;window.__ytPlayer=this;setTimeout(()=>o.events.onReady({target:this}),30)}loadVideoById(v){this.video=v.videoId;this.time=v.startSeconds||0;this.state=1;__yt.push('load:'+v.videoId)}cueVideoById(v){this.video=v.videoId;this.time=v.startSeconds||0;this.state=5;__yt.push('cue:'+v.videoId)}playVideo(){this.state=1;__yt.push('play')}pauseVideo(){this.state=2;__yt.push('pause')}seekTo(t){this.time=t;__yt.push('seek:'+Math.round(t))}stopVideo(){this.state=5;__yt.push('stop')}getCurrentTime(){return this.time}getPlayerState(){return this.state}getVideoData(){return {title:'Stub video '+this.video}}destroy(){}}};`;
 for(const page of [A,B]){await page.call('Page.addScriptToEvaluateOnNewDocument',{source:stub});await page.call('Page.navigate',{url:base});await page.wait("typeof showView==='function'&&!!window.portalSocialCalls&&!document.querySelector('#socialNav')?.hidden")}
 const open=async(page,space)=>{await page.js("showView('social-messages')");await page.wait(`!!document.querySelector('.social-view.active [data-social=chat][data-id="${space}"]')`);await page.js(`document.querySelector('.social-view.active [data-social=chat][data-id="${space}"]').click()`);await page.wait("!!document.querySelector('#socialMessageForm')")};
 const rooms=page=>page.js("[...document.querySelectorAll('#socialRooms .soc-room-label')].map(e=>e.textContent).join()");

 // Rooms: every group starts with # general and the Lounge call room; only the owner can add rooms.
 await open(A,group);await open(B,group);
 assert.equal(await rooms(A),'general,Lounge');
 assert.equal(await B.js("document.querySelectorAll('#socialRooms [data-social=room-new]').length"),0);
 await A.js("document.querySelector('#socialRooms [data-social=room-new][data-id=text]').click()");await A.wait("document.querySelector('.soc-dialog').open");
 await A.js("{const f=document.querySelector('.soc-dialog form');f.elements.name.value='homework';f.requestSubmit()}");
 await A.wait("document.querySelector('#socialRooms')?.textContent.includes('homework')");
 await B.wait("document.querySelector('#socialRooms')?.textContent.includes('homework')",8000);
 const homework=await A.js("[...document.querySelectorAll('#socialRooms [data-social=room]')].find(b=>b.textContent.includes('homework')).dataset.id");
 for(const page of [A,B]){await page.js(`document.querySelector('#socialRooms [data-social=room][data-id="${homework}"]').click()`);await page.wait(`document.querySelector('.soc-chat-title h3')?.textContent==='# homework'&&document.querySelector('#socialMessages')?.dataset.key?.endsWith('${homework}')`)}

 // Instant chat: Enter sends; the other person sees it without waiting for the six-second refresh.
 const say=async(page,text)=>page.js(`{const box=document.querySelector('#socialMessageForm textarea');box.value=${JSON.stringify(text)};box.dispatchEvent(new Event('input'));box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))}`);
 let started=Date.now();await say(A,'Who has question 4?');
 await B.wait("document.querySelector('#socialMessages').textContent.includes('Who has question 4?')",6000);
 assert(Date.now()-started<3000,'messages arrive instantly ('+(Date.now()-started)+' ms)');
 await say(A,'Revision video https://youtu.be/dQw4w9WgXcQ');
 await B.wait("!!document.querySelector('#socialMessages [data-yt-play=dQw4w9WgXcQ]')");
 await B.js("document.querySelector('[data-yt-play=dQw4w9WgXcQ]').click()");
 assert.deepEqual(await B.js("(()=>{const f=document.querySelector('#socialMessages iframe');return [f.src.split('?')[0],f.referrerPolicy]})()"),['https://www.youtube.com/embed/dQw4w9WgXcQ','strict-origin-when-cross-origin']);
 await say(A,'Thanks!');await B.wait("document.querySelector('#socialMessages').textContent.includes('Thanks!')");
 assert.equal(await B.js("document.querySelectorAll('#socialMessages iframe').length"),1,'an opened video keeps playing when new messages arrive');
 await shot(B,'rooms-desktop');
 await B.js("document.querySelector('#socialRooms [data-social=room]').click()");await B.wait("document.querySelector('.soc-chat-title h3')?.textContent==='# general'");
 await B.wait("document.querySelector('#socialMessages .soc-empty')");
 assert(!(await B.js("document.querySelector('#socialMessages').textContent.includes('question 4')")),'each text room keeps its own messages');

 // Group call in the Lounge: microphone, then camera, mute, screen sharing and the speaking light.
 const peers=page=>page.js('JSON.stringify(portalSocialCalls.debug()?.peers||[])').then(JSON.parse);
 await A.js("document.querySelector('#socialRooms [data-social=call-room]').click()");
 await A.wait("document.querySelector('#socialCall')?.dataset.mode==='stage'");
 await A.wait("document.querySelector('.soc-call-waiting')?.textContent.includes('Waiting for others')");
 await B.wait("document.querySelector('#socialRooms .soc-room.voice')?.textContent.includes('Test Student')",8000);
 await B.js("document.querySelector('#socialRooms [data-social=call-room]').click()");
 // Both directions carry sound: packets arrive and the other person's tile lights up when they speak.
 const hears=page=>page.wait("portalSocialCalls.debug().peers.some(p=>p.state==='connected')&&portalSocialCalls.traffic().then(t=>t.some(x=>x['inbound-rtp:audio']>50&&x.energy>0))",20000);
 await hears(A);await hears(B);
 for(const page of [A,B])await page.wait("[...document.querySelectorAll('#socialCall .soc-tile.speaking')].some(t=>t.dataset.speak!=='me')",15000);
 await A.js("document.querySelector('#socialCall [data-call=camera]').click()");
 await B.wait("[...document.querySelectorAll('#socialCall .soc-tile.has-video:not(.mirror) video')].some(v=>v.videoWidth>0)",20000);
 await A.js("document.querySelector('#socialCall .soc-call-controls [data-call=mute]').click()");
 await B.wait("[...document.querySelectorAll('#socialCall .soc-tile-flags')].some(f=>f.textContent.includes('🔇'))");
 await A.js("document.querySelector('#socialCall .soc-call-controls [data-call=mute]').click()");
 await B.wait("![...document.querySelectorAll('#socialCall .soc-tile-flags')].some(f=>f.textContent.includes('🔇'))");
 await A.js("document.querySelector('#socialCall [data-call=screen]').click()");
 await B.wait("[...document.querySelectorAll('#socialCall .soc-tile.screen.has-video video')].some(v=>v.videoWidth>0)",20000);
 assert(await B.js("document.querySelector('#socialCall .soc-call-grid').classList.contains('has-screen')"));
 await shot(B,'call-screen-share');
 await A.js("document.querySelector('#socialCall [data-call=screen]').click()");
 await B.wait("!document.querySelector('#socialCall .soc-tile.screen')",15000);

 // Watch together: one queue for the call; play, pause and skip are shared.
 await A.js("document.querySelector('#socialCall [data-call=watch]').click()");
 await A.js("{const f=document.querySelector('.soc-watch-add');f.elements.url.value='https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30';f.requestSubmit()}");
 await A.wait("__yt.includes('load:dQw4w9WgXcQ')");await B.wait("__yt.includes('load:dQw4w9WgXcQ')&&!document.querySelector('.soc-watch').hidden");
 const start=await B.js("__ytPlayer.time");assert(start>=30&&start<33,'joins the shared video where it is now ('+start+'s), not from the start');
 await new Promise(r=>setTimeout(r,3300));
 await B.js("__ytPlayer.state=2;__ytPlayer.o.events.onStateChange({data:2})");
 await A.wait("__yt.includes('pause')");
 await B.js("{const f=document.querySelector('.soc-watch-add');f.elements.url.value='youtu.be/9bZkp7q19f0';f.requestSubmit()}");
 await A.wait("document.querySelectorAll('.soc-watch-queue li').length===2");
 await A.js("document.querySelector('[data-watch=next]').click()");
 await B.wait("__yt.some(x=>x.endsWith(':9bZkp7q19f0'))");
 assert.equal(await A.js("document.querySelectorAll('.soc-watch-queue li').length"),1);
 await shot(A,'call-watch-together');

 // Minimise to a dock while using the portal; Leave frees the seat for everyone.
 await A.js("document.querySelector('#socialCall [data-call=minimise]').click()");
 assert.equal(await A.js("document.querySelector('#socialCall').dataset.mode"),'dock');
 await A.wait("document.querySelector('#socialRooms .soc-room-people')?.textContent.includes('Casey Friend')",8000);await shot(A,'rooms-in-call');
 assert(await A.js("getComputedStyle(document.querySelector('.soc-call-dock')).display!=='none'&&getComputedStyle(document.querySelector('.soc-call-stage')).display==='none'"));
 await A.js("document.querySelector('.soc-call-dock [data-call=open]').click()");assert.equal(await A.js("document.querySelector('#socialCall').dataset.mode"),'stage');
 await B.js("document.querySelector('#socialCall .soc-call-controls [data-call=leave]').click()");
 await A.wait("portalSocialCalls.debug().peers.length===0&&!!document.querySelector('.soc-call-waiting')",10000);
 await A.js("document.querySelector('#socialCall .soc-call-controls [data-call=leave]').click()");
 await B.wait("!document.querySelector('#socialRooms .soc-room-people')",8000);

 // Direct call: it rings; Decline ends it for the caller; Accept connects.
 await open(A,dm);await open(B,dm);
 await A.js("document.querySelector('#socialChatActions [data-social=call-dm]').click()");
 await B.wait("!!document.querySelector('#socialRings .soc-ring')",10000);
 assert.match(await B.js("document.querySelector('#socialRings .soc-ring').textContent"),/Test Student.*Incoming call/);
 await shot(B,'incoming-call');
 await B.js("document.querySelector('#socialRings [data-ring=decline]').click()");
 await A.wait("!portalSocialCalls.current()&&document.querySelector('#socialCallToast')?.textContent.includes('declined')",10000);
 await A.js("document.querySelector('#socialChatActions [data-social=video-dm]').click()");
 await B.wait("!!document.querySelector('#socialRings [data-ring=video]')",10000);
 await B.js("document.querySelector('#socialRings [data-ring=video]').click()");
 await B.wait("portalSocialCalls.debug()?.peers.some(p=>p.state==='connected')",20000);await hears(A);await hears(B);
 await A.wait("[...document.querySelectorAll('#socialCall .soc-tile.has-video:not(.mirror) video')].some(v=>v.videoWidth>0)",20000);
 await B.wait("document.querySelector('#socialChatActions')?.textContent.includes('Open call')");

 // Phone width in dark mode: the call screen and rooms fit without sideways scrolling.
 await B.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await B.js("document.body.classList.add('dark')");
 assert(await B.js("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.soc-call-stage').scrollWidth<=innerWidth"));
 await shot(B,'call-mobile-dark');
 await B.js("document.querySelector('#socialCall [data-call=minimise]').click()");await B.js(`document.querySelector('.social-view.active [data-social=conversations]')?.click()`);
 await B.js(`document.querySelector('.social-view.active [data-social=chat][data-id="${group}"]').click()`);await B.wait("!!document.querySelector('#socialRooms')");
 assert(await B.js("document.documentElement.scrollWidth<=innerWidth"));await shot(B,'rooms-mobile-dark');
 await A.js("portalSocialCalls.leave()");await B.wait("!portalSocialCalls.debug()?.peers.length",10000);
 for(const [name,page] of [['admin',A],['friend',B]])assert.deepEqual(page.errors,[],name+' page had script errors');
 console.log('PASS social calls: rooms (owner-managed, live for members), instant chat, YouTube cards, group call with microphone, camera, mute, speaking light and screen sharing, Watch together sync, dock, direct call ringing with decline and video accept, phone layout. Screenshots: '+shots);
 for(const c of [A,B,browser])c.ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
