import base64,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server,ctf_store

IMPORT='''Challenge: Return address offset
Category: pwn
Difficulty: easy
Flag: FLAG{72}
Flag format: FLAG{...}
Hint: Count the buffer first.
Hint: Then add the saved frame pointer.
Description:
How many bytes reach the saved return address?
```c
void vuln(){ char buf[64]; gets(buf); }
Hint: this line is code, not a hint
```
    Points: indented lines stay in the description
Solution:
64 bytes of buffer + 8 bytes of saved RBP = 72.

Challenge: Spot the format string bug
Category: rev
Difficulty: medium
Points: 250
Description: Which call is unsafe? printf(name) or puts(name)?
'''

class CtfTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name)
        self.patches=[patch.object(server,'ROOT',root),patch.object(server,'DB_PATH',root/'test.db')]
        for p in self.patches:p.start()
        server.init_db()
        self.s={'subjects':{'sec':{'name':'COMP6447','topics':['Overflows','Formats']},'other':{'name':'Mandarin','topics':['Tones']}},'topics':{'Overflows':[],'Formats':[],'Tones':[]}}
        server.import_state(self.s)
    def tearDown(self):
        for p in self.patches:p.stop()
        self.tmp.cleanup()
    def w(self,action,data=None,key=None):
        with server.connect() as c:return ctf_store.write(c,{'action':action,'data':data or {},'id':key})
    def state(self):
        with server.connect() as c:return ctf_store.state(c)
    def add(self,**extra):
        data={'topic_name':'Overflows','title':'ret2win','category':'pwn','difficulty':'easy','description':'Jump to win().','flag':'FLAG{win}','flag_format':'FLAG{...}','hints':['Find win()','Overwrite RIP'],'solution':'Send 72 bytes then the address of win.'}
        data.update(extra);return self.w('save',data)['id']

    def test_subjects_opt_in(self):
        self.w('subject',{'subject_id':'sec','enabled':True});self.assertEqual(self.state()['subjects'],['sec'])
        with self.assertRaisesRegex(ValueError,'existing subject'):self.w('subject',{'subject_id':'missing','enabled':True})
        self.w('subject',{'subject_id':'sec','enabled':False});self.assertEqual(self.state()['subjects'],[])

    def test_flag_is_checked_but_never_shown(self):
        key=self.add();raw=json.dumps(self.state())
        for secret in ('FLAG{win}','flag_hash','flag_salt','Send 72 bytes','Overwrite RIP','Find win()'):self.assertNotIn(secret,raw)
        self.assertEqual(self.state()['challenges'][0]['points'],100)
        wrong=self.w('submit',{'flag':'flag{win}'},key)
        self.assertEqual((wrong['correct'],wrong['message'],wrong['challenge']['progress']['attempts']),(False,'Flags for this challenge look like FLAG{...}.',1))
        wrong=self.w('submit',{'flag':'FLAG{lose}'},key);self.assertEqual(wrong['message'],'Not quite. Keep going.')
        right=self.w('submit',{'flag':'  FLAG{win}  '},key)
        self.assertTrue(right['correct']);p=right['challenge']['progress']
        self.assertEqual((p['solved'],p['attempts'],p['found_flag']),(True,3,'FLAG{win}'))
        self.assertEqual(right['challenge']['solution'],'Send 72 bytes then the address of win.')
        self.assertEqual([h['correct'] for h in p['history']],[1,0,0])

    def test_hints_one_at_a_time_and_solution_on_request(self):
        key=self.add()
        self.assertEqual(self.w('hint',{},key)['challenge']['hints'],['Find win()'])
        self.assertEqual(self.state()['challenges'][0]['hints'],['Find win()'])
        self.assertEqual(self.w('hint',{},key)['challenge']['hints'],['Find win()','Overwrite RIP'])
        with self.assertRaisesRegex(ValueError,'no more hints'):self.w('hint',{},key)
        self.assertIsNone(self.state()['challenges'][0]['solution'])
        c=self.w('reveal',{},key)['challenge'];self.assertTrue(c['progress']['revealed']);self.assertIn('72 bytes',c['solution'])
        self.w('notes',{'notes':'Used pwntools cyclic.'},key)
        c=self.w('reset',{},key)['challenge']['progress']
        self.assertEqual((c['solved'],c['attempts'],c['hints_used'],c['revealed'],c['notes']),(False,0,0,False,'Used pwntools cyclic.'))

    def test_challenges_without_a_flag_are_marked_solved_by_hand(self):
        key=self.add(flag='',title='Course wargame: blind')
        with self.assertRaisesRegex(ValueError,'no stored flag'):self.w('submit',{'flag':'x'},key)
        p=self.w('solve',{'found_flag':'COMP6447{xyz}'},key)['challenge']['progress'];self.assertEqual((p['solved'],p['found_flag']),(True,'COMP6447{xyz}'))
        self.assertFalse(self.w('solve',{'solved':False},key)['challenge']['progress']['solved'])
        flagged=self.add()
        with self.assertRaisesRegex(ValueError,'Submit the flag'):self.w('solve',{},flagged)

    def test_editing_keeps_or_replaces_the_flag(self):
        key=self.add();c=self.state()['challenges'][0]
        self.w('save',{**c,'topic_name':'Formats','title':'ret2win v2','hints':['Only hint'],'flag':'','updated_at':c['updated_at']},key)
        c=self.state()['challenges'][0];self.assertEqual((c['topic'],c['title'],c['hints_total']),('Formats','ret2win v2',1))
        self.assertTrue(self.w('submit',{'flag':'FLAG{win}'},key)['correct'],'a blank flag field keeps the stored flag')
        with self.assertRaisesRegex(ValueError,'changed on another device'):self.w('save',{**c,'topic_name':'Formats','updated_at':'old'},key)
        c=self.state()['challenges'][0];self.w('save',{**c,'topic_name':'Formats','remove_flag':True,'updated_at':c['updated_at']},key)
        self.assertFalse(self.state()['challenges'][0]['has_flag'])
        with self.assertRaisesRegex(ValueError,'Choose a topic'):self.add(topic_name='Nowhere')
        hidden=self.add(title='Hidden extras');c=next(x for x in self.state()['challenges'] if x['id']==hidden)
        self.w('save',{**c,'topic_name':'Overflows','title':'Renamed','hints':None,'solution':None,'updated_at':c['updated_at']},hidden)
        c=self.w('reveal',{},hidden)['challenge']
        self.assertEqual((c['title'],c['hints_total'],c['solution']),('Renamed',2,'Send 72 bytes then the address of win.'),'hidden hints and solution are kept')

    def test_paste_import_with_preview_and_clear_errors(self):
        preview=self.w('preview',{'topic_name':'Overflows','text':IMPORT})
        self.assertEqual(preview['errors'],[])
        self.assertEqual([(c['title'],c['category'],c['points'],c['has_flag'],c['hints']) for c in preview['challenges']],[('Return address offset','pwn',100,True,2),('Spot the format string bug','rev',250,False,0)])
        self.assertEqual(self.state()['challenges'],[],'preview saves nothing')
        ids=self.w('import',{'topic_name':'Overflows','text':IMPORT})['ids'];first=self.state()['challenges'][0]
        self.assertEqual(len(ids),2);self.assertIn('Hint: this line is code',first['description']);self.assertIn('    Points: indented',first['description'])
        self.assertTrue(self.w('submit',{'flag':'FLAG{72}'},ids[0])['correct'])
        broken='Intro text\nChallenge: Bad\nCategory: networking\nTopic: Overflows\nDescription: x\nChallenge: No description\n'
        errors=self.w('preview',{'topic_name':'Overflows','text':broken})['errors']
        self.assertEqual([(e['challenge'],e['line']) for e in errors],[(0,1),(1,4),(1,2),(2,6)])
        self.assertIn('Category must be',errors[2]['problem']);self.assertIn('description',errors[3]['problem'])
        self.assertFalse(self.w('import',{'topic_name':'Overflows','text':broken})['ok'])
        self.assertEqual(len(self.state()['challenges']),2)

    def test_typical_ai_formatting_is_understood(self):
        # The whole answer in a code block, bold labels, numbered challenges and everyday category names.
        messy='''```text
**Challenge 1:** Leaky printf
**Category:** Binary Exploitation
**Difficulty**: Beginner
**Points:** 150 pts
**Flag:** `FLAG{6}`
**Description:**
Which argument holds your input?
**Note:** assume x86-64.
**Solution:**
The sixth: five registers first, then the stack.

Challenge 2: Caesar warm-up
Category: Cryptography
Difficulty: Intermediate
Description: Decode GUR SYNT.
```'''
        ready,errors=ctf_store.parse(messy)
        self.assertEqual(errors,[])
        self.assertEqual([(c['title'],c['category'],c['difficulty'],c['points']) for c in ready],[('Leaky printf','pwn','easy',150),('Caesar warm-up','crypto','medium',200)])
        self.assertEqual(ready[0]['flag'],'FLAG{6}');self.assertIn('**Note:** assume x86-64.',ready[0]['description']);self.assertNotIn('```',ready[1]['description'])

    def test_files_are_stored_for_download_only(self):
        key=self.add();payload=b'\x7fELF fake binary'
        c=self.w('file',{'name':'../../vuln','base64':base64.b64encode(payload).decode()},key)['challenge']
        self.assertEqual(c['files'][0]['name'],'vuln');self.assertEqual(c['files'][0]['size'],len(payload))
        with server.connect() as con:self.assertEqual(ctf_store.download(con,c['files'][0]['id']),(payload,'vuln'))
        with patch.object(ctf_store,'MAX_FILE',4),self.assertRaisesRegex(ValueError,'10 MB'):self.w('file',{'name':'big','base64':base64.b64encode(b'12345').decode()},key)
        self.w('file_delete',{'file_id':c['files'][0]['id']});self.assertEqual(self.state()['challenges'][0]['files'],[])

    def test_deleting_a_topic_or_subject_removes_its_ctf_data(self):
        self.w('subject',{'subject_id':'sec','enabled':True});self.add();self.add(topic_name='Formats')
        del self.s['topics']['Overflows'];self.s['subjects']['sec']['topics'].remove('Overflows');server.import_state(self.s)
        self.assertEqual([c['topic'] for c in self.state()['challenges']],['Formats'])
        del self.s['subjects']['sec'];server.import_state(self.s);self.assertEqual(self.state()['subjects'],[])
        with server.connect() as con:self.assertEqual(con.execute('PRAGMA foreign_key_check').fetchall(),[])

if __name__=='__main__':unittest.main()
