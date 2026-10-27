"""Isolated multi-user Marketplace acceptance and security regression tests."""
import base64
import tempfile
import unittest
from pathlib import Path
from datetime import datetime,timedelta,timezone
import backend  # adds backend/<feature> folders to the import path
import accounts
import marketplace_store as m

# A real two-page PDF: PDFium rejects fake bytes, so the preview path needs a valid file.
PDF=(b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
     b'2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>endobj\n'
     b'3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
     b'4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
     b'trailer<</Root 1 0 R>>\n%%EOF\n')

class MarketplaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'accounts.db'
        accounts.initialize(self.path,password='Test-password-123!',must_change=False)
        self.a='admin';self.b=accounts.create_user(self.path,{'username':'buyer','display_name':'Buyer','password':'Test-password-123!'})
        self.c=accounts.create_user(self.path,{'username':'outsider','display_name':'Other','password':'Test-password-123!'})
        m.migrate(self.path)
    def tearDown(self):self.tmp.cleanup()
    def w(self,u,action,data=None,key=None):return m.write(self.path,u,{'action':action,'data':data or {},'id':key})
    def note(self,price='0',**kw):
        d={'title':'My own notes','subject':'COMP1521','resource_type':'Lecture Notes','rights':True,'status':'published','price':price,'format':'markdown','content':'PRIVATE FULL CONTENT','preview':'Public excerpt'};d.update(kw)
        return self.w(self.a,'listing',d)['id']
    def tutor(self,**kw):
        d={'terms':True,'subjects':['COMP1521'],'methods':['Online'],'price':'45','timezone':'UTC','availability':[{'day':i,'start':'00:00','end':'23:59'} for i in range(7)]};d.update(kw);self.w(self.a,'tutor',d)
    def start(self):return (datetime.now(timezone.utc)+timedelta(days=3)).replace(hour=12,minute=0,second=0,microsecond=0).isoformat()
    def book(self,u=None,**kw):
        d={'start':self.start(),'subject':'COMP1521','method':'Online','duration':60};d.update(kw)
        return self.w(u or self.b,'book',d,self.a)['id']
    def test_missing_time_zone_data_is_explained(self):
        # Windows has no built-in time-zone database: without tzdata every zone fails, which is not the tutor's mistake.
        import zoneinfo
        from unittest.mock import patch
        def missing(key):raise zoneinfo.ZoneInfoNotFoundError(key)
        with patch.object(zoneinfo,'ZoneInfo',missing),patch.object(zoneinfo,'available_timezones',lambda:set()):
            with self.assertRaisesRegex(ValueError,'no time-zone data.*requirements-marketplace.txt'):self.tutor(timezone='Australia/Sydney')
        with self.assertRaisesRegex(ValueError,'valid IANA timezone'):self.tutor(timezone='Mars/Olympus')
    def test_empty_real_accounts_and_migration(self):
        state=m.state(self.path,self.b);self.assertEqual(state['listings'],[]);self.assertEqual(state['tutors'],[]);self.assertEqual(state['ledger'],[])
        m.migrate(self.path);self.assertNotIn('email',state['me']);self.assertNotIn('password',state['me'])
        self.assertEqual(len(list((self.path.parent/'backups').glob('before-marketplace-*'))),1)
    def test_paid_access_and_no_fake_payment(self):
        key=self.note('8.00');state=m.state(self.path,self.b)
        self.assertNotIn('PRIVATE FULL CONTENT',str(state));self.assertEqual(state['listings'][0]['preview'],'Public excerpt')
        with self.assertRaises(m.Forbidden):m.resource(self.path,self.b,key)
        with self.assertRaises(ValueError):self.w(self.b,'acquire',key=key)
        self.w(self.b,'cart',key=key)
        with self.assertRaises(ValueError):self.w(self.b,'checkout')
        self.assertEqual(m.state(self.path,self.b)['library'],[])
        self.assertEqual(m.state(self.path,self.a)['ledger'],[])
    def test_free_acquisition_version_and_review(self):
        key=self.note();self.w(self.b,'acquire',key=key);self.w(self.b,'acquire',key=key)
        self.assertEqual(len(m.state(self.path,self.b)['library']),1)
        self.assertEqual(m.resource(self.path,self.b,key)['content'],b'PRIVATE FULL CONTENT')
        with self.assertRaises(m.Forbidden):self.w(self.a,'review',{'kind':'note','rating':5},key)
        with self.assertRaises(m.Forbidden):self.w(self.c,'review',{'kind':'note','rating':5},key)
        self.w(self.b,'review',{'kind':'note','rating':4,'body':'Useful'},key)
        with self.assertRaises(ValueError):self.w(self.b,'review',{'kind':'note','rating':5},key)
        self.w(self.a,'listing',{'title':'Updated','subject':'COMP1521','rights':True,'status':'published','format':'markdown','content':'New private version','preview':'New preview'},key)
        self.assertEqual(m.resource(self.path,self.b,key)['content'],b'PRIVATE FULL CONTENT')
        self.assertEqual(m.resource(self.path,self.a,key)['content'],b'New private version')
        with self.assertRaises(m.Forbidden):self.w(self.b,'listing_status',{'status':'unlisted'},key)
    def test_pdf_and_rich_note_snapshot(self):
        key=self.note('3',format='pdf',base64=base64.b64encode(PDF).decode())
        with self.assertRaises(m.Forbidden):m.resource(self.path,self.b,key)
        listing=next(l for l in m.state(self.path,self.b)['listings'] if l['id']==key)
        self.assertEqual(listing['preview_pages'],[1])  # page 1 by default; the last page is never previewed
        png,fmt=m.preview_page(self.path,self.b,key,1);self.assertEqual((png[1:4],fmt),(b'PNG','pdf'))
        with self.assertRaises(m.Forbidden):m.preview_page(self.path,self.b,key,2)
        with self.assertRaisesRegex(ValueError,'Keep at least one page'):self.note('3',format='pdf',base64=base64.b64encode(PDF).decode(),preview_pages='1-2')
        with self.assertRaisesRegex(ValueError,'has 2 pages'):self.note('3',format='pdf',base64=base64.b64encode(PDF).decode(),preview_pages='5')
        self.assertEqual(listing['metadata']['pages'],2)
        with self.assertRaisesRegex(ValueError,'Could not safely read this PDF'):
            self.note(format='pdf',base64=base64.b64encode(b'%PDF-1.7\nnot really a pdf').decode())
        html=self.note(format='html',content='<script>alert(1)</script><p>Text</p><img src="/api/notes/images/'+('a'*32)+'.png">')
        self.assertEqual(m.resource(self.path,self.a,html)['content'],b'<p>Text</p>')
    def test_note_pages_and_seller_chosen_previews(self):
        # A long note is split into pages at block boundaries; the seller picks which pages are free to read.
        body='\n\n'.join(f'## Section {i}\n\n'+('Lecture detail sentence. '*40) for i in range(1,9))
        key=self.note(content=body,preview_pages='1, 3')
        listing=next(l for l in m.state(self.path,self.b)['listings'] if l['id']==key)
        self.assertEqual(listing['preview_pages'],[1,3]);self.assertGreaterEqual(listing['metadata']['pages'],5)
        first,fmt=m.preview_page(self.path,self.b,key,1);self.assertEqual(fmt,'markdown');self.assertTrue(first.decode().startswith('## Section 1'))
        with self.assertRaises(m.Forbidden):m.preview_page(self.path,self.b,key,2)
        with self.assertRaises(m.Forbidden):m.preview_page(self.path,self.b,key,'1;drop')
        # Changing the preview pages later needs no new upload; the version stays the same.
        self.w(self.a,'listing',{'title':'My own notes','subject':'COMP1521','rights':True,'status':'published','preview_pages':'2'},key)
        listing=next(l for l in m.state(self.path,self.b)['listings'] if l['id']==key)
        self.assertEqual((listing['preview_pages'],listing['version']),([2],1));self.assertGreaterEqual(listing['metadata']['pages'],5)
        self.w(self.a,'listing',{'title':'My own notes','subject':'COMP1521','rights':True,'status':'published','preview_pages':''},key)
        self.assertEqual(next(l for l in m.state(self.path,self.b)['listings'] if l['id']==key)['preview_pages'],[])
        for bad,why in (('0','like 1-3'),('2-1','like 1-3'),('1-11','at most 10'),('99','pages from 1 to')):
            with self.assertRaisesRegex(ValueError,why):self.w(self.a,'listing',{'title':'My own notes','subject':'COMP1521','rights':True,'status':'published','preview_pages':bad},key)
        # Rich notes split by their top-level blocks; a one-page note shows its excerpt only, even with the form's default "1".
        html=self.note(format='html',content=''.join(f'<h2>Part {i}</h2><p>{"Rich text &amp; detail. "*60}</p>' for i in range(4)),preview_pages='2')
        page,fmt=m.preview_page(self.path,self.b,html,2);self.assertEqual(fmt,'html');self.assertTrue(page.decode().startswith('<h2>Part'))
        for spec in (None,'1','1-3'):
            short=self.note(content='One short page.',**({} if spec is None else {'preview_pages':spec}))
            self.assertEqual(next(l for l in m.state(self.path,self.b)['listings'] if l['id']==short)['preview_pages'],[],spec)
        self.assertEqual([len(p)>0 for p in m.paginate('markdown','```\ncode\n\nstill code\n```')],[True])
    def test_money_validation(self):
        self.assertEqual(m.money('22.50'),2250)
        for amount in ('NaN','Infinity','1.999','-1'):
            with self.assertRaises(ValueError):m.money(amount)
    def test_messages_private_separate_and_receipts(self):
        key=self.note();cid=self.w(self.b,'conversation',{'kind':'note'},key)['id'];self.w(self.b,'message',{'body':'A question'},cid)
        self.assertEqual(m.state(self.path,self.a)['conversations'][0]['unread'],1)
        self.assertEqual(m.messages(self.path,self.a,cid)['messages'][0]['body'],'A question')
        self.assertEqual(m.state(self.path,self.a)['conversations'][0]['unread'],0)
        with self.assertRaises(m.Forbidden):m.messages(self.path,self.c,cid)
        with self.assertRaises(m.Forbidden):self.w(self.c,'message',{'body':'intrusion'},cid)
    def test_booking_overlap_permissions_and_safe_price(self):
        self.tutor();key=self.book(duration=90);b=m.state(self.path,self.b)['bookings'][0]
        self.assertEqual(b['data']['amount_minor'],6750);self.assertEqual(b['data']['payment_status'],'not_configured')
        with self.assertRaises(ValueError):self.book(self.c)
        with self.assertRaises(m.Forbidden):self.w(self.b,'booking_status',{'status':'confirmed'},key)
        with self.assertRaises(m.Forbidden):self.w(self.c,'booking_status',{'status':'cancelled'},key)
        self.assertEqual(m.state(self.path,self.c)['bookings'],[])
        self.w(self.a,'booking_status',{'status':'confirmed'},key)
        with self.assertRaises(m.Forbidden):self.w(self.a,'booking_status',{'status':'completed'},key)
        self.w(self.b,'booking_status',{'status':'cancelled'},key);self.book(self.c)
    def test_availability_exceptions_paused_and_duration(self):
        self.tutor(exceptions=[self.start()[:10]])
        with self.assertRaises(ValueError):self.book()
        self.tutor(status='paused')
        with self.assertRaises(ValueError):self.book()
        self.tutor()
        for values in ({'duration':45},{'subject':'OTHER'},{'method':'In-person'},{'start':'2020-01-01T12:00:00+00:00'}):
            with self.assertRaises(ValueError):self.book(**values)
    def test_completed_session_review_and_moderation(self):
        self.tutor(approval=False);key=self.book()
        with self.assertRaises(m.Forbidden):self.w(self.b,'review',{'kind':'tutor','rating':5},key)
        with accounts.db(self.path) as c:c.execute('UPDATE market_bookings SET end_at=? WHERE id=?',((datetime.now(timezone.utc)-timedelta(hours=1)).isoformat(),key))
        self.w(self.a,'booking_status',{'status':'completed'},key);self.w(self.b,'review',{'kind':'tutor','rating':5,'body':'Helpful'},key)
        self.assertEqual(len(m.state(self.path,self.c)['tutors'][0]['reviews']),1)
        note=self.note();self.w(self.b,'report',{'kind':'note','reason':'Copyright issue'},note)
        with self.assertRaises(m.Forbidden):self.w(self.b,'moderate',{'listing':note})
        self.w(self.a,'moderate',{'listing':note});self.assertEqual(m.state(self.path,self.c)['listings'],[])

if __name__=='__main__':unittest.main()
