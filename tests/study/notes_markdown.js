const assert=require('node:assert/strict');require('../../frontend/study/notes.js');
const render=global.StudentNotes.markdown;
for(const [input,output] of [['# Heading','<h2>Heading</h2>'],['**bold**','<strong>bold</strong>'],['*italic*','<em>italic</em>'],['==highlight==','<mark>highlight</mark>'],['++underline++','<u>underline</u>'],['- bullet','<ul>'],['1. item','<ol>'],['- [x] Task','checked'],['`inline`','<code>inline</code>'],['```\nconst x=1\n```','<pre><code>const x=1</code></pre>'],['> [!TAKEAWAY]\n> Remember this','note-callout'],['> quote','<blockquote>'],['---','<hr>']])assert(render(input).includes(output),input);
assert(!render('<script>alert(1)</script>').includes('<script>'));
assert(!render('![x](javascript:alert(1))').includes('<img'));
assert(render('`**not bold**`').includes('<code>**not bold**</code>'));
console.log('PASS notes Markdown: formatting, callouts, code isolation and escaped HTML');
