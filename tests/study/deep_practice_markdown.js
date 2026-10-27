// Deep Practice renders imported Markdown with every character escaped; only a small set of formatting is added back.
const assert=require('node:assert/strict');
require('../../frontend/study/deep-practice.js');
const md=globalThis.StudentDeepPractice.markdown;

const evil=md('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1)) [mail](mailto:a@b.c)\n\n**bold** `a<b>` [ok](https://example.com/x?a=1&b=2)');
assert(!/<script|<img|href="javascript/i.test(evil),'No raw HTML or script links: '+evil);
assert(evil.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert(evil.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert(evil.includes('[click](javascript:alert(1))'),'Unsafe links stay as plain text');
assert(evil.includes('<a href="mailto:a@b.c" target="_blank" rel="noopener noreferrer">mail</a>'));
assert(evil.includes('<a href="https://example.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">ok</a>'));
assert(evil.includes('<strong>bold</strong>')&&evil.includes('<code>a&lt;b&gt;</code>'));

// Code keeps spaces, indentation and newlines exactly, escaped, with a language label.
const code=md('```c\nint x;\n    if (a<b) { y=1; }\n\tz--;\n```');
assert(code.includes('<pre tabindex="0"><code>int x;\n    if (a&lt;b) { y=1; }\n\tz--;</code></pre>'),code);
assert(code.includes('<span class="dp-code-lang">C</span>'));

// Tables (as produced from the workbook's tab-separated coverage map), including an escaped pipe.
const table=md('Intro line\n| Part | Status |\n| --- | --- |\n| 1 | Done \\| ok |\n| 2 | Planned |');
assert(table.startsWith('<p>Intro line</p><div class="dp-table"'));
assert(table.includes('<th scope="col">Part</th>')&&table.includes('<td>Done | ok</td>')&&(table.match(/<tr>/g)||[]).length===3);

// Fill-in blanks become labelled inputs; typed values are escaped.
const blanks=md('```mips\nli  $t0, ___\nb   ___\n```',{blanks:['1','"><b>x']});
assert.equal((blanks.match(/class="dp-blank"/g)||[]).length,2);
assert(blanks.includes('aria-label="Blank 2"')&&blanks.includes('value="&quot;&gt;&lt;b&gt;x"')&&!blanks.includes('<b>x'));

// C pointers and underscores in prose are not mistaken for emphasis.
const prose=md('Trace int x=6; int *p=&x; int y=*p; *p=19; and render_impacts__y_off_step.');
assert(!/<em>|<strong>/.test(prose)&&prose.includes('int *p=&amp;x; int y=*p; *p=19;'));
assert.equal(md('- [ ] Explain loads\n- [x] Count bytes'),'<ul><li><span class="dp-task" aria-hidden="true">☐</span> Explain loads</li><li><span class="dp-task" aria-hidden="true">☑</span> Count bytes</li></ul>');
console.log('PASS Deep Practice Markdown: escaped HTML, safe links only, exact code whitespace, tables, labelled blanks, no accidental emphasis.');
