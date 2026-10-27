"""Demo Marketplace/Socialise content: visible to real accounts, usable, and fully removable."""
import sys,tempfile,unittest
from datetime import date,timedelta
from pathlib import Path
import backend  # adds backend/<feature> folders to the import path
import accounts,marketplace_store as m,social_store as s
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import demo_data

class DemoDataTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'accounts.db'
        accounts.initialize(self.path,admin_name='Hakiem',password='Test-password-123!',must_change=False)
        m.migrate(self.path);s.migrate(self.path)
        s.write(self.path,'admin',{'action':'profile','data':{'enabled':True}})
        s.write(self.path,'admin',{'action':'post','data':{'body':'My own post','audience':'public'}})
        self.own_listing=m.write(self.path,'admin',{'action':'listing','data':{'title':'My notes','subject':'COMP1521','resource_type':'Lecture Notes','rights':True,'status':'published','price':'0','format':'markdown','content':'Body','preview':'Excerpt'}})['id']
    def tearDown(self):self.tmp.cleanup()
    def sw(self,action,data=None,key=None):return s.write(self.path,'admin',{'action':action,'data':data or {},'id':key})
    def mw(self,action,data=None,key=None):return m.write(self.path,'admin',{'action':action,'data':data or {},'id':key})
    def counts(self):
        with accounts.db(self.path) as c:return {t:c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'market_%' OR name LIKE 'social_%' OR name='users')")]}

    def test_demo_listings_have_seller_chosen_preview_pages(self):
        demo_data.add(self.path)
        listings={l['id']:l for l in m.state(self.path,'admin')['listings']}
        for slug,spec in demo_data.PREVIEWS.items():
            l=listings[demo_data.lid(slug)]
            self.assertEqual(l['preview_pages'],m.page_numbers(spec),slug)
            self.assertLess(len(l['preview_pages']),l['metadata']['pages'],slug+' keeps pages for buyers')
        lecture=listings[demo_data.lid('ds-notes')];self.assertEqual(lecture['format'],'pdf')
        png,fmt=m.preview_page(self.path,'admin',lecture['id'],3);self.assertEqual((png[1:4],fmt),(b'PNG','pdf'))
        with self.assertRaises(m.Forbidden):m.preview_page(self.path,'admin',lecture['id'],2)
        text,fmt=m.preview_page(self.path,'admin',demo_data.lid('contract'),4);self.assertEqual(fmt,'markdown');self.assertIn('Exam checklist',text.decode())
        # Older demo listings (without previews) are brought up to date in place.
        with accounts.db(self.path) as c:c.execute('DELETE FROM market_previews')
        self.assertEqual(demo_data.refresh_listings(self.path),len(demo_data.LISTINGS))
        self.assertEqual(next(l for l in m.state(self.path,'admin')['listings'] if l['id']==demo_data.lid('stats'))['preview_pages'],[1,2,3])

    def test_demo_content_is_visible_usable_and_removable(self):
        before=self.counts()
        self.assertEqual(demo_data.add(self.path),['admin'])
        market=m.state(self.path,'admin');social=s.state(self.path,'admin')
        self.assertEqual(len([l for l in market['listings'] if l['seller']!='admin']),len(demo_data.LISTINGS))
        self.assertTrue(all(l['reviews'] for l in market['listings'] if l['id'] in {demo_data.lid(r[1]) for r in demo_data.NOTE_REVIEWS}))
        self.assertEqual(len(market['tutors']),len(demo_data.TUTORS));self.assertTrue(all(t['profile']['name'] for t in market['tutors']))
        self.assertEqual(sorted(b['status'] for b in market['bookings']),['completed','confirmed','pending'])
        self.assertEqual([o['listing'] for o in market['library']],[demo_data.lid('bigo')]);self.assertEqual(len(market['cart']),1);self.assertEqual(len(market['conversations']),2)
        self.assertEqual(len(market['reports']),1);self.assertGreaterEqual(len(market['notifications']),5)
        self.assertEqual(len(social['people']),len(demo_data.PEOPLE))
        kinds=[x['kind'] for x in social['spaces']];self.assertEqual((kinds.count('club'),kinds.count('study'),kinds.count('project'),kinds.count('dm')),(5,3,2,2))
        project=next(x for x in social['spaces'] if x['id']==demo_data.sid('seproject'));self.assertEqual(len(project['tasks']),6);self.assertEqual(len(project['files']),1)
        self.assertTrue(any('admin' in t['data']['assigned'] for t in project['tasks']))
        self.assertGreaterEqual(len(social['posts']),8);self.assertGreaterEqual(len(social['events']),6)
        self.assertEqual(sum(1 for l in social['links'] if l['state']=='pending' and l['recipient']=='admin'),2)
        self.assertEqual(next(x for x in social['spaces'] if x['id']==demo_data.sid('photo'))['membership']['state'],'invited')
        self.assertEqual(len(s.messages(self.path,'admin',demo_data.sid('coding'))['messages']),5)
        with self.assertRaises(ValueError):accounts.login(self.path,'demo.aisha',demo_data.NO_LOGIN,'127.0.0.1','test')

        # Everything a student would try works against demo content.
        self.mw('acquire',key=demo_data.lid('cellbio'))
        self.mw('review',{'kind':'note','rating':5,'body':'Great'},demo_data.lid('bigo'))
        done=next(b for b in market['bookings'] if b['status']=='completed');self.mw('review',{'kind':'tutor','rating':4,'body':'Helpful'},done['id'])
        day=next(date.today()+timedelta(days=n) for n in range(2,9) if (date.today()+timedelta(days=n)).weekday() in (1,3))
        slot=m.slots(self.path,'admin',demo_data.uid('noah'),day.isoformat(),60,'Physics','Online')['slots'][0]['start']
        self.mw('book',{'start':slot,'duration':60,'subject':'Physics','method':'Online'},demo_data.uid('noah'))
        self.mw('message',{'body':'Thanks!'},market['conversations'][0]['id'])
        self.sw('friend',{'user_id':demo_data.uid('liam'),'operation':'accept'});self.sw('friend',{'user_id':demo_data.uid('mia'),'operation':'request'})
        self.sw('membership',{'operation':'join'},demo_data.sid('hiking'));self.sw('membership',{'operation':'accept_invite'},demo_data.sid('photo'))
        self.sw('message',{'body':'Count me in for the hackathon'},demo_data.sid('coding'))
        post=next(p for p in social['posts'] if p['author']==demo_data.uid('ethan'));self.sw('like',key=post['id']);self.sw('comment',{'body':'Congrats!'},post['id'])
        event=next(e for e in social['events'] if e['space_id']==demo_data.sid('coding'));self.sw('attend',key=event['id'])
        task=next(t for t in project['tasks'] if t['data']['status']=='review');self.sw('task',{**task['data'],'title':task['title'],'status':'done','space_id':project['id'],'updated_at':task['updated_at']},task['id'])
        self.sw('dm',{'user_id':demo_data.uid('ethan')})

        # Re-adding replaces demo content instead of duplicating it.
        demo_data.add(self.path);again=self.counts()
        self.assertEqual(again['users'],1+len(demo_data.PEOPLE));self.assertEqual(again['market_listings'],1+len(demo_data.LISTINGS));self.assertEqual(again['market_tutors'],len(demo_data.TUTORS))

        self.assertEqual(demo_data.remove(self.path),len(demo_data.PEOPLE));self.assertEqual(demo_data.remove(self.path),0)
        self.assertEqual(self.counts(),before)
        with accounts.db(self.path) as c:self.assertEqual(c.execute('PRAGMA foreign_key_check').fetchall(),[])
        self.assertEqual([p['body'] for p in s.state(self.path,'admin')['posts']],['My own post'])
        self.assertEqual([l['id'] for l in m.state(self.path,'admin')['listings']],[self.own_listing])

    def test_real_account_activity_on_demo_content_is_removed_cleanly(self):
        demo_data.add(self.path)
        self.mw('acquire',key=demo_data.lid('pandas'))
        self.sw('space',{'kind':'club','name':'My club'})
        mine=next(x['id'] for x in s.state(self.path,'admin')['spaces'] if x['name']=='My club')
        self.sw('friend',{'user_id':demo_data.uid('sofia'),'operation':'accept'});self.sw('membership',{'operation':'invite','user_id':demo_data.uid('aisha')},mine)
        demo_data.remove(self.path)
        state=s.state(self.path,'admin');self.assertEqual([x['name'] for x in state['spaces']],['My club']);self.assertEqual([x['user_id'] for x in state['spaces'][0]['members']],['admin'])
        self.assertEqual(m.state(self.path,'admin')['library'],[])

if __name__=='__main__':unittest.main()
