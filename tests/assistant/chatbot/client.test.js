const assert=require('node:assert/strict');
require('../../../frontend/assistant/tutor.js');
const T=globalThis.StudentTutor,encoder=new TextEncoder();
const response=text=>new Response(new ReadableStream({start(c){for(const b of encoder.encode(text))c.enqueue(new Uint8Array([b]));c.close()}}));
(async()=>{
 let count=0;
 const result=await T.readStream(response('{"type":"progress","characters":12}\n{"type":"result","reply":"Hello 👋","actions":[]}'),()=>count++);
 assert.equal(result.reply,'Hello 👋');assert.equal(count,1);
 await assert.rejects(T.readStream(response('{"type":"progress"}\n')),/connection ended/);
 await assert.rejects(T.readStream(response('{"type":"error","error":"Model busy"}\n')),/Model busy/);
 await assert.rejects(T.readStream(new Response('{"error":"Unavailable"}',{status:503})),/Unavailable/);
 for(const type of ['image/png','image/jpeg','image/webp'])T.validateImage({type,size:1024});
 assert.throws(()=>T.validateImage({type:'image/svg+xml',size:5}),/PNG/);
 assert.throws(()=>T.validateImage({type:'image/png',size:13*1024*1024}),/too large/);
 console.log('PASS chatbot client: chunked UTF-8, progress, incomplete response, server errors, image type and size checks');
})().catch(e=>{console.error(e);process.exit(1)});
