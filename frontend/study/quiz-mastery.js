/* Pure mastery rules, shared by the UI and regression tests. */
(function(root){
 'use strict';
 function signature(q){return JSON.stringify([q.question,Object.entries(q.choices||{}).sort(),q.answer])}
 function count(q){return q.mastery?.signature===signature(q)?Math.max(0,Number(q.mastery.correct)||0):0}
 function record(q,correct){if(correct)q.mastery={signature:signature(q),correct:count(q)+1}}
 function settings(value){return {mode:value?.mode==='mastery'?'mastery':'normal',target:Math.max(1,Math.min(100,Math.floor(Number(value?.target)||3)))}}
 const api={signature,count,record,settings};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.QuizMastery=api;
})(typeof window==='undefined'?globalThis:window);
