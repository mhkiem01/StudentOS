/* Socialise live layer: instant updates, call rooms (voice, camera, screen sharing), ringing and Watch together.
   Audio and video travel directly between the browsers in a call (WebRTC). The portal server only passes on
   the short set-up messages and remembers who is in which call (see backend/social/social_live.py). */
(function(g){'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CAMERA={width:{ideal:640},height:{ideal:360},frameRate:{ideal:24}};
const LINK=/(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})[^\s]*/g;
const youtubeLinks=text=>[...String(text||'').matchAll(LINK)].map(m=>({url:m[0],id:m[1]}));
const canTalk=()=>!!(g.isSecureContext&&navigator.mediaDevices?.getUserMedia);
const canShare=()=>!!(g.isSecureContext&&navigator.mediaDevices?.getDisplayMedia);
const insecure=()=>`This page was opened over plain http, so your browser blocks the microphone, camera and screen sharing. You can still listen, watch and use Watch together. To talk, open the portal over https (for example with Tailscale) or on the host computer at http://localhost:${location.port||80}/.`;
const ENDED={moved:'You joined this call from another tab or device.',removed:'You are no longer a member, so you left the call.',deleted:'This call room was deleted.',blocked:'The call ended.',timeout:'You were disconnected from the call. Join again to continue.'};
let youtubeApi=null;
function loadYouTube(){
 if(g.YT?.Player)return Promise.resolve(g.YT);
 return youtubeApi??=new Promise((resolve,reject)=>{const previous=g.onYouTubeIframeAPIReady;g.onYouTubeIframeAPIReady=()=>{previous?.();resolve(g.YT)};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{youtubeApi=null;reject(Error('YouTube could not be reached. Check this device’s internet connection.'))};document.head.append(script)});
}
function youtubeFrame(id,params=''){const frame=document.createElement('iframe');frame.title='YouTube video';frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
 // The portal sends no referrer by default; YouTube refuses to play embeds without one.
 frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=`https://www.youtube.com/embed/${id}?playsinline=1&rel=0${params}`;return frame}

function create(o){
 let cursor=null,epoch=null,running=false,clockOffset=0,call=null,presence={},ringTimer=null,joining=false,early=[];
 const rings=new Map(),serverNow=()=>(Date.now()+clockOffset)/1000;
 async function post(payload){const r=await fetch('/api/social/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'The call could not be updated.');return j}

 /* Instant updates: one long-poll per tab. */
 function start(){if(!running&&o.enabled())loop()}
 async function loop(){
  running=true;let delay=1000;
  while(o.enabled()){
   try{
    const asked=call?.peer,q=new URLSearchParams();
    if(cursor!==null){q.set('cursor',cursor);q.set('epoch',epoch)}
    if(asked)q.set('peer',asked);
    const r=await fetch('/api/social/live?'+q),j=await r.json();
    if(!r.ok)throw Error(j.error||'Live updates paused.');
    clockOffset=j.now*1000-Date.now();
    const fresh=cursor===null||j.epoch!==epoch;
    if(fresh){
     if(cursor!==null){o.onEvent({type:'reset'});if(call)await end('The portal server restarted, so the call ended. Join again to continue.')}
     presence={};for(const [id,v] of Object.entries(j.calls||{}))if(v.peers.length)presence[id]=v.peers;
     o.onEvent({type:'presence'});for(const id of [...rings.keys()])if(!(j.rings||[]).some(r=>r.call===id))hideRing(id);(j.rings||[]).forEach(showRing);
    }else if(j.reset)o.onEvent({type:'reset'});
    epoch=j.epoch;cursor=j.cursor;
    if(call&&asked&&call.peer===asked&&j.peer_ok===false)await end(ENDED.timeout);
    for(const e of j.events)await handle(e);
    delay=1000;
   }catch(err){await sleep(delay);delay=Math.min(delay*2,15000)}
  }
  running=false;cursor=null;
 }
 async function handle(e){
  if(e.type==='signal')return signal(e);
  if(e.type==='call'){if(e.peers.length)presence[e.call]=e.peers;else delete presence[e.call];if(call&&e.call===call.id)syncPeers(e.peers);o.onEvent({type:'presence',call:e.call});return}
  if(e.type==='call_end'){if(call&&e.call===call.id&&e.peer===call.peer)await end(ENDED[e.reason]||'The call ended.');return}
  if(e.type==='ring')return showRing(e);
  if(e.type==='ring_end'){hideRing(e.call);if(call&&e.call===call.id&&!call.peers.size&&(e.reason==='declined'||e.reason==='missed'))await end(e.reason==='declined'?`${call.title} declined the call.`:`${call.title} didn’t answer.`);return}
  if(e.type==='watch'){if(call&&e.call===call.id)watch.apply(e.state);return}
  o.onEvent(e);
 }

 /* Calls. Every browser connects to every other browser in the call. */
 async function join(info,{video=false,ring=false}={}){
  const id=info.kind==='dm'?info.space:info.room;
  if(call){if(call.id===id){ui.show('stage');return}if(!confirm(`Leave “${call.title}” and join “${info.title}”?`))return;await end()}
  const local=new MediaStream();let notice='';
  if(canTalk()){
   try{(await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:video&&CAMERA})).getTracks().forEach(t=>local.addTrack(t))}
   catch(err){
    if(video)try{(await navigator.mediaDevices.getUserMedia({audio:true})).getTracks().forEach(t=>local.addTrack(t))}catch{}
    notice=local.getAudioTracks().length?'Your camera could not start, so you joined with your microphone only.':`Your microphone could not start (${err.name==='NotAllowedError'?'permission was blocked':'no microphone was found'}). You can still listen and watch.`;
   }
  }else notice=insecure();
  let joined;joining=true;early=[];
  try{joined=await post({op:'join',space:info.space,room:info.room,ring,video})}catch(err){joining=false;local.getTracks().forEach(t=>t.stop());throw err}
  call={...info,id:joined.call,peer:joined.peer,peers:new Map(),local,screen:null,muted:false,notice,ringing:ring,outbox:[],sending:false};
  ui.mount();audio.start();
  // Live updates may already carry a newer list of people than the join reply.
  const latest=presence[joined.call];syncPeers(latest?.some(p=>p.peer===joined.peer)?latest:joined.peers);
  joining=false;for(const e of early.splice(0))await signal(e);
  sendMedia();watch.apply(joined.watch);
  if(ring)ringTimer=setTimeout(()=>{if(call?.id===id&&!call.peers.size)end(`${info.title} didn’t answer.`)},50000);
  o.onEvent({type:'presence',call:call.id});start();
 }
 function syncPeers(list){
  if(!call)return;const seen=new Set();
  for(const p of list){if(p.peer===call.peer)continue;seen.add(p.peer);const entry=call.peers.get(p.peer)||connect(p.peer,p.user);entry.user=p.user;entry.media=p.media||{}}
  for(const id of [...call.peers.keys()])if(!seen.has(id))disconnect(id);
  if(call.peers.size)call.ringing=false;
  ui.render();
 }
 function connect(id,user){
  const pc=new RTCPeerConnection({iceServers:[]}),entry={id,user,media:{},pc,polite:call.peer>id,makingOffer:false,ignoreOffer:false,streams:new Map(),senders:new Map(),audio:new Map(),stats:{sent:0,got:0,added:0,failed:0,offers:0,ignored:0}};
  call.peers.set(id,entry);
  for(const t of call.local.getTracks())entry.senders.set(t,pc.addTrack(t,call.local));
  for(const t of call.screen?.getTracks()||[])entry.senders.set(t,pc.addTrack(t,call.screen));
  if(!entry.polite)pc.createDataChannel('call');
  pc.onnegotiationneeded=async()=>{try{entry.makingOffer=true;await pc.setLocalDescription();send(id,{description:pc.localDescription.toJSON()})}catch(err){console.warn('Call negotiation',err)}finally{entry.makingOffer=false}};
  pc.onicecandidate=e=>{if(e.candidate){entry.stats.sent++;send(id,{candidate:e.candidate.toJSON()})}};
  pc.ontrack=e=>{
   const stream=e.streams[0]||new MediaStream([e.track]);
   if(!entry.streams.has(stream.id)){entry.streams.set(stream.id,stream);stream.onremovetrack=()=>ui.render();stream.onaddtrack=()=>ui.render()}
   e.track.onunmute=e.track.onmute=e.track.onended=()=>ui.render();
   audio.attach(entry,stream);ui.render();
  };
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')pc.restartIce();ui.render()};
  return entry;
 }
 function disconnect(id){const entry=call.peers.get(id);if(!entry)return;try{entry.pc.close()}catch{}audio.detach(entry);call.peers.delete(id)}
 async function signal(e){
  if(!call){if(joining)early.push(e);return}
  if(e.call!==call.id||e.to!==call.peer)return;
  const entry=call.peers.get(e.from)||connect(e.from,(presence[e.call]||[]).find(p=>p.peer===e.from)?.user),{pc}=entry,{description,candidate}=e.data||{};
  try{
   if(description){
    // "Perfect negotiation": if both sides offer at once, the polite side gives way.
    const collision=description.type==='offer'&&(entry.makingOffer||pc.signalingState!=='stable');
    entry.ignoreOffer=!entry.polite&&collision;if(entry.ignoreOffer){entry.stats.ignored++;return}
    await pc.setRemoteDescription(description);
    if(description.type==='offer'){await pc.setLocalDescription();send(e.from,{description:pc.localDescription.toJSON()})}
   }else if(candidate){entry.stats.got++;try{await pc.addIceCandidate(candidate);entry.stats.added++}catch(err){entry.stats.failed++;if(!entry.ignoreOffer)console.warn('Call candidate',err)}}
  }catch(err){console.warn('Call signalling',err)}
 }
 function send(to,data){if(!call)return;call.outbox.push({to,data});flush()}
 async function flush(){
  const c=call;if(!c||c.sending)return;c.sending=true;
  // One request at a time keeps set-up messages in order.
  try{while(c.outbox.length&&call===c){const batch=c.outbox.splice(0,50);try{await post({op:'signal',peer:c.peer,messages:batch})}catch(err){console.warn('Call signal',err)}}}finally{c.sending=false}
 }
 function sendMedia(){
  const c=call;if(!c)return;
  post({op:'media',peer:c.peer,media:{muted:c.muted||!c.local.getAudioTracks().length,video:c.local.getVideoTracks().some(t=>t.readyState==='live'),screen:!!c.screen,streams:{main:c.local.id,...(c.screen?{screen:c.screen.id}:{})}}}).catch(()=>{});
  ui.render();
 }
 function addTrack(t,stream){for(const e of call.peers.values())e.senders.set(t,e.pc.addTrack(t,stream))}
 function removeTrack(t){for(const e of call.peers.values()){const sender=e.senders.get(t);if(sender){try{e.pc.removeTrack(sender)}catch{}e.senders.delete(t)}}}
 function toggleMute(){if(!call)return;if(!call.local.getAudioTracks().length)return ui.notice(call.notice||'No microphone is connected.');call.muted=!call.muted;call.local.getAudioTracks().forEach(t=>t.enabled=!call.muted);sendMedia()}
 async function toggleCamera(){
  const c=call;if(!c)return;const on=c.local.getVideoTracks();
  if(on.length){for(const t of on){removeTrack(t);t.stop();c.local.removeTrack(t)}sendMedia();return}
  if(!canTalk())return ui.notice(insecure());
  try{
   const t=(await navigator.mediaDevices.getUserMedia({video:CAMERA})).getVideoTracks()[0];
   if(call!==c){t.stop();return}
   c.local.addTrack(t);addTrack(t,c.local);t.onended=()=>{if(call===c&&c.local.getTrackById(t.id)){removeTrack(t);c.local.removeTrack(t);sendMedia()}};sendMedia();
  }catch(err){ui.notice('Your camera could not start: '+(err.name==='NotAllowedError'?'permission was blocked.':err.message))}
 }
 async function toggleScreen(){
  const c=call;if(!c)return;if(c.screen)return stopScreen();
  if(!canShare())return ui.notice(g.isSecureContext?'This browser cannot share its screen. Try Chrome, Edge or Firefox on a computer.':insecure());
  try{
   const s=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:30}},audio:true});
   if(call!==c){s.getTracks().forEach(t=>t.stop());return}
   c.screen=s;for(const t of s.getTracks()){addTrack(t,s);t.onended=()=>{if(call===c&&c.screen===s)stopScreen()}}sendMedia();
  }catch(err){if(err.name!=='NotAllowedError'&&err.name!=='AbortError')ui.notice('Screen sharing could not start: '+err.message)}
 }
 function stopScreen(){const c=call;if(!c?.screen)return;for(const t of c.screen.getTracks()){removeTrack(t);t.stop()}c.screen=null;sendMedia()}
 async function end(message){
  const c=call;if(!c)return;call=null;clearTimeout(ringTimer);
  for(const e of c.peers.values()){try{e.pc.close()}catch{}audio.detach(e)}
  c.local.getTracks().forEach(t=>t.stop());c.screen?.getTracks().forEach(t=>t.stop());
  audio.stop();watch.reset();ui.unmount();
  post({op:'leave',peer:c.peer}).catch(()=>{});
  o.onEvent({type:'presence',call:c.id});if(message)toast(message);
 }
 g.addEventListener('pagehide',()=>{if(call)fetch('/api/social/call',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'leave',peer:call.peer})}).catch(()=>{})});

 /* Sound: remote voices play through hidden audio elements; a level meter lights up whoever is speaking. */
 const audio={ctx:null,meters:new Map(),timer:null,sink:null,
  start(){
   if(!this.sink){this.sink=document.createElement('div');this.sink.hidden=true;this.sink.className='soc-call-audio';document.body.append(this.sink)}
   try{this.ctx??=new AudioContext();this.ctx.resume?.()}catch{}
   this.meter('me',call.local);this.timer??=setInterval(()=>this.tick(),180);
  },
  attach(entry,stream){
   if(!entry.audio.has(stream.id)){const el=document.createElement('audio');el.autoplay=true;el.srcObject=stream;this.sink.append(el);entry.audio.set(stream.id,el);el.play().catch(()=>ui.notice('Your browser paused the call sound. Click anywhere in the call to hear everyone.'))}
   if(stream.id===entry.media?.streams?.main||!entry.media?.streams?.main)this.meter(entry.id,stream);
  },
  detach(entry){for(const el of entry.audio.values()){el.srcObject=null;el.remove()}entry.audio.clear();this.meters.delete(entry.id)},
  meter(key,stream){
   if(!this.ctx||this.meters.has(key)||!stream.getAudioTracks().length)return;
   try{const analyser=this.ctx.createAnalyser();analyser.fftSize=512;this.ctx.createMediaStreamSource(stream).connect(analyser);this.meters.set(key,{analyser,data:new Uint8Array(analyser.fftSize)})}catch{}
  },
  tick(){
   for(const [key,m] of this.meters){m.analyser.getByteTimeDomainData(m.data);let sum=0;for(const v of m.data)sum+=(v-128)**2;const loud=Math.sqrt(sum/m.data.length)>6&&!(key==='me'&&call?.muted);ui.root?.querySelectorAll(`[data-speak="${key}"]`).forEach(t=>t.classList.toggle('speaking',loud))}
  },
  replay(){this.ctx?.resume?.();this.sink?.querySelectorAll('audio').forEach(a=>a.play().catch(()=>{}))},
  stop(){clearInterval(this.timer);this.timer=null;this.meters.clear();this.sink?.replaceChildren();try{this.ctx?.close()}catch{}this.ctx=null},
 };

 /* Watch together: one shared YouTube queue per call, kept in step through the portal server. */
 const watch={state:null,player:null,ready:false,creating:false,loaded:null,until:0,timer:null,opened:false,titles:{},
  reset(){clearInterval(this.timer);this.timer=null;try{this.player?.destroy?.()}catch{}Object.assign(this,{state:null,player:null,ready:false,creating:false,loaded:null,opened:false})},
  item(){return this.state?.items.find(i=>i.id===this.state.current)},
  expected(){const w=this.state;return w?w.position+(w.playing?Math.max(0,serverNow()-w.at):0):0},
  apply(state){if(!call||!state)return;const started=state.current&&!this.state?.current;this.state=state;if(started&&!this.opened)ui.toggleWatch(true);ui.renderWatch();this.sync()},
  async create(item){
   if(this.creating)return;this.creating=true;
   try{
    const YT=await loadYouTube();if(!call||this.player)return;
    const host=ui.root.querySelector('.soc-watch-player'),frame=youtubeFrame(item.video,'&enablejsapi=1&origin='+encodeURIComponent(location.origin));
    host.replaceChildren(frame);this.loaded=null;
    this.player=new YT.Player(frame,{events:{onReady:()=>{this.ready=true;this.sync()},onStateChange:ev=>this.changed(ev.data)}});
    this.timer=setInterval(()=>this.check(),1000);
   }catch(err){ui.watchError(err.message)}finally{this.creating=false}
  },
  hold(ms=1500){this.until=Date.now()+ms},
  sync(){
   const w=this.state,item=this.item(),p=this.player;
   if(!item){if(this.ready){this.hold();try{p.stopVideo()}catch{}}this.loaded=null;return}
   if(!p)return this.create(item);if(!this.ready)return;
   const exp=this.expected();
   if(this.loaded!==item.id){this.loaded=item.id;this.hold(3000);if(w.playing)p.loadVideoById({videoId:item.video,startSeconds:exp});else p.cueVideoById({videoId:item.video,startSeconds:w.position});return}
   const t=p.getCurrentTime?.()||0,s=p.getPlayerState?.();
   if(w.playing){if(s!==1&&s!==3){this.hold();p.playVideo()}if(Math.abs(t-exp)>2){this.hold();p.seekTo(exp,true)}}
   else{if(s===1||s===3){this.hold();p.pauseVideo()}if(Math.abs(t-w.position)>1){this.hold();p.seekTo(w.position,true)}}
  },
  // Play, pause and end on the YouTube controls are shared with everyone in the call.
  changed(s){
   const w=this.state,item=this.item();if(!item||!this.ready)return;
   const title=this.player.getVideoData?.()?.title;if(title&&this.titles[item.video]!==title){this.titles[item.video]=title;ui.renderWatch()}
   if(s===0)return quiet('ended',{item:item.id});
   if(Date.now()<this.until)return;const t=this.player.getCurrentTime();
   if(s===1&&!w.playing)quiet('play',{position:t});else if(s===2&&w.playing)quiet('pause',{position:t});
  },
  check(){
   if(!this.ready||Date.now()<this.until||!this.state?.current)return;
   const p=this.player,s=p.getPlayerState(),t=p.getCurrentTime(),w=this.state;
   if(w.playing&&s===1&&Math.abs(t-this.expected())>3)quiet('seek',{position:t});
   else if(!w.playing&&s===2&&Math.abs(t-w.position)>1.5)quiet('seek',{position:t});
  },
 };
 async function act(action,data={}){const c=call;if(!c)throw Error('Join a call first.');try{const r=await post({op:'watch',peer:c.peer,action,...data});if(call===c)watch.apply(r.watch)}catch(err){ui.watchError(err.message);throw err}}
 const quiet=(action,data)=>act(action,data).catch(()=>{});
 async function addToWatch(url,spaceId){
  if(!call)throw Error('Join a call room first, then use Watch together to play this video for everyone.');
  if(spaceId&&call.space!==spaceId)throw Error('Watch together plays in your current call. Join a call in this conversation first.');
  await act('add',{url});ui.show('stage');ui.toggleWatch(true);
 }

 /* Call window: a full-screen stage, or a small dock while you keep using the portal. */
 const ui={root:null,mode:'stage',noticeText:'',
  mount(){
   this.root?.remove();const root=this.root=document.createElement('section');root.className='soc-call';root.id='socialCall';
   root.innerHTML=`<div class="soc-call-stage" role="region" aria-label="Call: ${E(call.title)}"><header class="soc-call-head"><div class="soc-call-name"><b>${call.kind==='dm'?'📞':'🔊'} ${E(call.title)}</b><small>${E(call.detail||'')}</small></div><button type="button" class="soc-button" data-call="minimise">Minimise</button></header><p class="soc-call-notice" role="status" hidden></p><div class="soc-call-body"><div class="soc-call-grid"></div><aside class="soc-watch" hidden aria-label="Watch together"><header><b>▶ Watch together</b><small>Everyone in this call sees the same video. Play, pause and skipping are shared.</small></header><div class="soc-watch-player"><p class="soc-watch-empty">Paste a YouTube link to start.</p></div><form class="soc-watch-add"><input name="url" placeholder="Paste a YouTube link…" aria-label="YouTube link" autocomplete="off"><button class="soc-button soc-primary" type="submit">Add</button></form><p class="soc-watch-error" role="alert"></p><ol class="soc-watch-queue"></ol><div class="soc-watch-actions"><button type="button" class="soc-button" data-watch="next">Skip ⏭</button><button type="button" class="soc-button" data-watch="stop">Stop video</button></div></aside></div><footer class="soc-call-controls"><button type="button" class="soc-button" data-call="mute"></button><button type="button" class="soc-button" data-call="camera"></button><button type="button" class="soc-button" data-call="screen"></button><button type="button" class="soc-button" data-call="watch" aria-pressed="false">▶ Watch together</button><button type="button" class="soc-button soc-call-leave" data-call="leave">Leave call</button></footer></div><div class="soc-call-dock" role="region" aria-label="Current call"><button type="button" class="soc-call-dock-open" data-call="open"><span class="soc-call-live" aria-hidden="true"></span><span><b>${E(call.title)}</b><small></small></span></button><button type="button" class="soc-button" data-call="mute"></button><button type="button" class="soc-button soc-call-leave" data-call="leave" aria-label="Leave call">✕</button></div>`;
   root.addEventListener('click',ev=>{audio.replay();const b=ev.target.closest('[data-call],[data-watch]');if(!b)return;const a=b.dataset.call;
    if(a==='minimise')this.show('dock');else if(a==='open')this.show('stage');else if(a==='mute')toggleMute();else if(a==='camera')toggleCamera();else if(a==='screen')toggleScreen();else if(a==='watch')this.toggleWatch();else if(a==='leave')end();else if(a==='full')b.closest('.soc-tile')?.requestFullscreen?.().catch(()=>{});
    else if(b.dataset.watch)quiet(b.dataset.watch,{item:b.dataset.item})});
   root.querySelector('.soc-watch-add').onsubmit=async ev=>{ev.preventDefault();const input=ev.target.elements.url;try{await act('add',{url:input.value});input.value=''}catch{}};
   root.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&this.mode==='stage'&&!document.fullscreenElement)this.show('dock')});
   document.body.append(root);this.show('stage');this.notice(call.notice);
  },
  unmount(){this.root?.remove();this.root=null;document.body.classList.remove('soc-call-stage-open','soc-call-docked')},
  show(mode){if(!this.root)return;this.mode=mode;this.root.dataset.mode=mode;document.body.classList.toggle('soc-call-stage-open',mode==='stage');document.body.classList.toggle('soc-call-docked',mode==='dock');if(mode==='stage')this.root.querySelector('[data-call=minimise]')?.focus({preventScroll:true});this.render()},
  notice(text){this.noticeText=text||'';const el=this.root?.querySelector('.soc-call-notice');if(el){el.textContent=this.noticeText;el.hidden=!this.noticeText}},
  toggleWatch(force){if(!this.root)return;const panel=this.root.querySelector('.soc-watch'),open=force??panel.hidden;panel.hidden=!open;watch.opened=open;this.root.querySelector('[data-call=watch]').setAttribute('aria-pressed',String(open));this.root.querySelector('.soc-call-body').classList.toggle('watching',open);if(open)this.root.querySelector('.soc-watch-add input')?.focus({preventScroll:true})},
  watchError(text){const el=this.root?.querySelector('.soc-watch-error');if(el){el.textContent=text;clearTimeout(this.watchTimer);this.watchTimer=setTimeout(()=>el.textContent='',6000)}},
  renderWatch(){
   if(!this.root)return;const w=watch.state||{items:[]},queue=this.root.querySelector('.soc-watch-queue');
   queue.innerHTML=w.items.map(i=>{const playing=i.id===w.current;return `<li class="${playing?'current':''}"><img src="https://i.ytimg.com/vi/${E(i.video)}/default.jpg" alt="" loading="lazy"><span><b>${playing?(w.playing?'▶ Now playing':'⏸ Paused'):'Up next'}</b><small>${E(watch.titles[i.video]||'youtu.be/'+i.video)} · added by ${E(o.user(i.by).name)}</small></span>${playing?'':`<button type="button" class="soc-button" data-watch="select" data-item="${i.id}">Play now</button>`}<button type="button" class="soc-button" data-watch="remove" data-item="${i.id}" aria-label="Remove from queue">✕</button></li>`}).join('')||'<li class="soc-watch-none">The queue is empty.</li>';
   this.root.querySelector('.soc-watch-actions').hidden=!w.current;
   if(!w.current&&!watch.player)this.root.querySelector('.soc-watch-player').innerHTML='<p class="soc-watch-empty">Paste a YouTube link to start.</p>';
   this.root.querySelector('.soc-watch-player').classList.toggle('idle',!w.current);
  },
  tiles(){
   const live=s=>!!s&&s.getVideoTracks().some(t=>t.readyState==='live'),me=o.me(),list=[];
   list.push({key:'me:main',user:me,label:'You',stream:call.local,video:call.local.getVideoTracks().some(t=>t.readyState==='live'),muted:call.muted||!call.local.getAudioTracks().length,mirror:true,speak:'me'});
   if(call.screen)list.push({key:'me:screen',user:me,label:'Your screen',stream:call.screen,video:true,screen:true});
   for(const e of call.peers.values()){
    const m=e.media||{},ids=m.streams||{},main=e.streams.get(ids.main)||[...e.streams.values()].find(s=>s.id!==ids.screen),screen=ids.screen&&e.streams.get(ids.screen),state=e.pc.connectionState;
    list.push({key:e.id+':main',user:e.user,label:o.user(e.user).name,stream:main,video:!!m.video&&live(main),muted:!!m.muted,speak:e.id,status:state==='connected'?'':state==='failed'?'Connection lost':'Connecting…'});
    if(m.screen&&screen)list.push({key:e.id+':screen',user:e.user,label:o.user(e.user).name+'’s screen',stream:screen,video:live(screen),screen:true});
   }
   return list;
  },
  render(){
   if(!call||!this.root)return;
   const grid=this.root.querySelector('.soc-call-grid'),tiles=this.tiles(),keys=new Set(tiles.map(t=>t.key));
   grid.querySelectorAll('[data-tile]').forEach(el=>{if(!keys.has(el.dataset.tile))el.remove()});
   let previous=null;
   for(const t of tiles){
    let el=grid.querySelector(`[data-tile="${t.key}"]`);
    if(!el){el=document.createElement('figure');el.dataset.tile=t.key;el.innerHTML=`<video autoplay playsinline muted></video><div class="soc-tile-avatar">${o.avatar(o.user(t.user))}</div><figcaption><span class="soc-tile-name"></span><span class="soc-tile-flags"></span></figcaption>${t.screen?'<button type="button" class="soc-tile-full" data-call="full" aria-label="Show full screen">⛶</button>':''}`}
    el.className=`soc-tile${t.screen?' screen':''}${t.video?' has-video':''}${t.mirror?' mirror':''}`;if(t.speak)el.dataset.speak=t.speak;
    el.querySelector('.soc-tile-name').textContent=t.label+(t.status?' · '+t.status:'');
    el.querySelector('.soc-tile-flags').textContent=t.muted?'🔇':'';
    if(el.previousElementSibling!==previous||el.parentNode!==grid)previous?previous.after(el):grid.prepend(el);previous=el;
    const v=el.querySelector('video');if(v.srcObject!==(t.stream||null))v.srcObject=t.stream||null;if(t.video&&v.paused)v.play().catch(()=>{});
   }
   grid.classList.toggle('has-screen',tiles.some(t=>t.screen));grid.dataset.count=String(tiles.filter(t=>!t.screen).length);
   const waiting=call.ringing&&!call.peers.size?`Calling ${call.title}…`:!call.peers.size?'Waiting for others to join…':'';
   let wait=grid.querySelector('.soc-call-waiting');if(waiting){if(!wait){wait=document.createElement('p');wait.className='soc-call-waiting';grid.append(wait)}wait.textContent=waiting}else wait?.remove();
   const micOn=!call.muted&&call.local.getAudioTracks().length,camOn=call.local.getVideoTracks().length>0;
   this.root.querySelectorAll('[data-call=mute]').forEach(b=>{b.textContent=micOn?'🎙 Mute':'🔇 Unmute';b.setAttribute('aria-pressed',String(!micOn));b.classList.toggle('off',!micOn)});
   const cam=this.root.querySelector('[data-call=camera]');cam.textContent=camOn?'🎥 Turn camera off':'🎥 Turn camera on';cam.setAttribute('aria-pressed',String(camOn));cam.classList.toggle('on',camOn);
   const share=this.root.querySelector('[data-call=screen]');share.textContent=call.screen?'🖥 Stop sharing':'🖥 Share screen';share.setAttribute('aria-pressed',String(!!call.screen));share.classList.toggle('on',!!call.screen);
   this.root.querySelector('.soc-call-dock small').textContent=waiting||`${call.peers.size+1} in call${call.detail?' · '+call.detail:''}`;
  },
 };

 /* Incoming direct calls. */
 const ring={ctx:null,timer:null,
  start(){if(this.timer)return;const beep=()=>{try{this.ctx??=new AudioContext();const t=this.ctx.currentTime;for(const [f,d] of [[660,0],[880,.25]]){const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.frequency.value=f;gain.gain.setValueAtTime(.08,t+d);gain.gain.exponentialRampToValueAtTime(.001,t+d+.22);osc.connect(gain).connect(this.ctx.destination);osc.start(t+d);osc.stop(t+d+.24)}}catch{}};beep();this.timer=setInterval(beep,2200)},
  stop(){clearInterval(this.timer);this.timer=null;try{this.ctx?.close()}catch{}this.ctx=null},
 };
 function showRing(r){if(rings.has(r.call)||call?.id===r.call)return;rings.set(r.call,r);renderRings();ring.start()}
 function hideRing(id){if(!rings.delete(id))return;renderRings();if(!rings.size)ring.stop()}
 function renderRings(){
  let host=document.getElementById('socialRings');
  if(!host){host=document.createElement('div');host.id='socialRings';host.className='soc-rings';document.body.append(host);host.onclick=async ev=>{const b=ev.target.closest('[data-ring]');if(!b)return;const r=rings.get(b.dataset.call);if(!r)return;hideRing(r.call);if(b.dataset.ring==='decline'){post({op:'decline',call:r.call}).catch(()=>{});return}try{await join({space:r.space,kind:'dm',title:o.user(r.from).name,detail:'Direct call'},{video:r.video&&b.dataset.ring==='video'})}catch(err){toast(err.message)}}}
  host.innerHTML=[...rings.values()].map(r=>{const u=o.user(r.from);return `<div class="soc-ring" role="alertdialog" aria-label="Incoming call from ${E(u.name)}">${o.avatar(u)}<div><b>${E(u.name)}</b><small>${r.video?'Incoming video call':'Incoming call'}</small></div><button type="button" class="soc-button soc-ring-accept" data-ring="audio" data-call="${r.call}">📞 Accept</button>${r.video?`<button type="button" class="soc-button soc-ring-accept" data-ring="video" data-call="${r.call}">🎥 With video</button>`:''}<button type="button" class="soc-button soc-call-leave" data-ring="decline" data-call="${r.call}">Decline</button></div>`}).join('');
  host.hidden=!rings.size;host.querySelector('.soc-ring-accept')?.focus({preventScroll:true});
 }
 function toast(text){let el=document.getElementById('socialCallToast');if(!el){el=document.createElement('p');el.id='socialCallToast';el.className='soc-call-toast';el.setAttribute('role','status');document.body.append(el)}el.textContent=text;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,6000)}

 return {start,join,leave:()=>end(),open:()=>ui.show('stage'),current:()=>call&&{id:call.id,space:call.space,room:call.room,kind:call.kind,title:call.title},presence:()=>presence,addToWatch,
  // Read-only views used by the browser tests.
  traffic:async()=>call?Promise.all([...call.peers.values()].map(async e=>{const out={};(await e.pc.getStats()).forEach(r=>{if(r.type==='inbound-rtp'||r.type==='outbound-rtp')out[r.type+':'+r.kind]=(r.packetsReceived??r.packetsSent);if(r.type==='inbound-rtp'&&r.kind==='audio')out.energy=r.totalAudioEnergy||0});return out})):[],
  debug:()=>call&&{id:call.id,peer:call.peer,muted:call.muted,local:call.local.getTracks().map(t=>t.kind+':'+t.readyState+(t.muted?':muted':'')+(t.enabled?'':':off')),watch:watch.state,peers:[...call.peers.values()].map(e=>({id:e.id,user:e.user,state:e.pc.connectionState,signaling:e.pc.signalingState,ice:e.pc.iceConnectionState+'/'+e.pc.iceGatheringState,stats:e.stats,polite:e.polite,transceivers:e.pc.getTransceivers().map(t=>[t.mid,t.direction,t.currentDirection,t.sender.track?.kind||'-',t.receiver.track?.kind].join(':')),media:e.media,tracks:[...e.streams.values()].flatMap(s=>s.getTracks().filter(t=>t.readyState==='live').map(t=>t.kind+(t.muted?':muted':'')))}))}};
}
g.StudentSocialCalls={create,youtubeLinks,youtubeFrame};
})(window);
