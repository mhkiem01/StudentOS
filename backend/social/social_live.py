"""Live Socialise channel: instant chat updates, call rooms, call set-up messages, ringing and Watch together.

Everything here lives in memory on the host and is ephemeral: a server restart ends every call
and clears Watch together queues. Chat messages and rooms are saved by social_store, which also
checks membership before calling in here with an authorised user id.

Calls are peer-to-peer WebRTC between the browsers in the call. This hub never sees audio or
video; it only relays the small set-up messages (offers, answers, network candidates) and keeps
track of who is in which call.
"""
import json,re,threading,time,uuid
from urllib.parse import urlparse,parse_qs

WAIT=20          # seconds a live request waits for news before answering empty
KEEP=400         # events kept per account for clients that are catching up
STALE=45         # seconds without a live request before a call participant is dropped
RING=45          # seconds a direct call rings before it counts as missed
MAX_PEERS=12     # every browser connects to every other one, so calls stay small
MAX_SIGNAL=100_000
QUEUE=50
HEX=re.compile(r'[a-f0-9]{32}')
VIDEO=re.compile(r'[A-Za-z0-9_-]{11}')

class Ended(ValueError):
    """The call connection is unknown: it was left, dropped or the server restarted."""

def youtube(url):
    """Return (video id, start seconds) for a YouTube link, or raise ValueError."""
    raw=str(url or '').strip()
    if VIDEO.fullmatch(raw):return raw,0
    parsed=urlparse(raw if '://' in raw else 'https://'+raw)
    host=(parsed.hostname or '').lower().removeprefix('www.').removeprefix('m.').removeprefix('music.')
    query=parse_qs(parsed.query);parts=[p for p in parsed.path.split('/') if p]
    video=None
    if host=='youtu.be' and parts:video=parts[0]
    elif host in ('youtube.com','youtube-nocookie.com'):
        if parsed.path=='/watch':video=(query.get('v') or [''])[0]
        elif len(parts)>=2 and parts[0] in ('shorts','embed','live','v'):video=parts[1]
    if not video or not VIDEO.fullmatch(video):raise ValueError('Paste a YouTube video link, such as youtube.com/watch?v=… or youtu.be/….')
    start=(query.get('t') or query.get('start') or ['0'])[0]
    match=re.fullmatch(r'(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?',start)
    seconds=sum(int(n or 0)*m for n,m in zip(match.groups(),(3600,60,1))) if match else 0
    return video,min(seconds,86400)

def blank():return {'items':[],'current':None,'playing':False,'position':0.0,'at':0.0,'version':0}

class Hub:
    def __init__(self,clock=time.time):
        self.clock=clock;self.cond=threading.Condition();self.epoch=uuid.uuid4().hex
        self.seq=0;self.events={};self.floor={};self.calls={};self.peers={}

    # Event queues ---------------------------------------------------------------
    def _post(self,users,event):
        self.seq+=1
        for user in set(users):
            queue=self.events.setdefault(user,[]);queue.append((self.seq,event))
            if len(queue)>KEEP:self.floor[user]=queue[-KEEP-1][0];del queue[:-KEEP]
        self.cond.notify_all()
    def post(self,users,event):
        with self.cond:self._post(users,event)

    def snapshot(self,user):
        """Starting point for a client: current cursor, calls it can see and calls ringing for it."""
        with self.cond:
            self._prune()
            calls={k:self._view(k) for k,c in self.calls.items() if user in c['audience']}
            rings=[{'call':k,'space':c['space'],'from':c['ring']['from'],'video':c['ring']['video']} for k,c in self.calls.items() if c['ring'] and c['ring']['to']==user]
            return {'epoch':self.epoch,'cursor':self.seq,'events':[],'reset':False,'calls':calls,'rings':rings,'now':self.clock()}

    def wait(self,user,cursor,timeout=WAIT,peer=None):
        end=time.monotonic()+timeout
        with self.cond:
            while True:
                if peer:self._touch(user,peer)
                self._prune()
                reset=cursor<self.floor.get(user,0) or cursor>self.seq
                events=[e for s,e in self.events.get(user,[]) if s>cursor]
                left=end-time.monotonic()
                if events or reset or left<=0:
                    result={'epoch':self.epoch,'cursor':self.seq,'events':[] if reset else events,'reset':reset,'now':self.clock()}
                    if peer:result['peer_ok']=self._owner(peer)==user
                    return result
                self.cond.wait(min(left,5))

    # Calls ----------------------------------------------------------------------
    def _owner(self,peer):
        call=self.calls.get(self.peers.get(peer))
        return call['peers'][peer]['user'] if call and peer in call['peers'] else None
    def _own(self,user,peer):
        if not isinstance(peer,str) or self._owner(peer)!=user:raise Ended('This call has ended. Join it again.')
        return self.peers[peer]
    def _touch(self,user,peer):
        if self._owner(peer)==user:self.calls[self.peers[peer]]['peers'][peer]['seen']=self.clock()
    def _view(self,call_id):
        call=self.calls.get(call_id)
        if not call:return {'space':None,'room':None,'peers':[],'ringing':None}
        ring=call['ring']
        return {'space':call['space'],'room':call['room'],'kind':call['kind'],'peers':[{'peer':p,'user':v['user'],'media':v['media']} for p,v in call['peers'].items()],'ringing':{'from':ring['from'],'to':ring['to'],'video':ring['video']} if ring else None}
    def _announce(self,call_id,audience=None):
        call=self.calls.get(call_id)
        self._post(audience if audience is not None else call['audience'],{'type':'call','call':call_id,**self._view(call_id)})
    def _drop(self,peer,reason=None):
        call_id=self.peers.pop(peer,None);call=self.calls.get(call_id)
        if not call:return
        gone=call['peers'].pop(peer)
        if reason:self._post([gone['user']],{'type':'call_end','call':call_id,'peer':peer,'reason':reason})
        ring=call['ring']
        if ring and not any(v['user']==ring['from'] for v in call['peers'].values()):self._end_ring(call_id,'cancelled')
        audience=call['audience']
        if not call['peers']:del self.calls[call_id]
        self._announce_or_close(call_id,audience)
    def _announce_or_close(self,call_id,audience):
        if call_id in self.calls:self._announce(call_id)
        else:self._post(audience,{'type':'call','call':call_id,'space':None,'room':None,'peers':[],'ringing':None})
    def _prune(self):
        now=self.clock()
        for peer,call_id in list(self.peers.items()):
            call=self.calls.get(call_id)
            if call and now-call['peers'][peer]['seen']>STALE:self._drop(peer,'timeout')
        for call_id,call in list(self.calls.items()):
            if call['ring'] and now-call['ring']['at']>RING:self._end_ring(call_id,'missed')

    def join(self,call_id,user,space,room,kind,audience):
        with self.cond:
            self._prune()
            call=self.calls.get(call_id)
            if call:call['audience']=set(audience)
            else:call=self.calls[call_id]={'space':space,'room':room,'kind':kind,'audience':set(audience),'peers':{},'watch':blank(),'ring':None}
            # One seat per account: joining again (another tab or device) moves you there.
            for peer,v in list(call['peers'].items()):
                if v['user']==user:self._drop(peer,'moved')
            call=self.calls.setdefault(call_id,call)
            if len(call['peers'])>=MAX_PEERS:raise ValueError(f'This call is full ({MAX_PEERS} people).')
            peer=uuid.uuid4().hex
            call['peers'][peer]={'user':user,'media':{'muted':False,'video':False,'screen':False,'streams':{}},'seen':self.clock()}
            self.peers[peer]=call_id
            if call['ring'] and call['ring']['to']==user:self._end_ring(call_id,'answered')
            self._announce(call_id)
            return {'call':call_id,'peer':peer,'peers':self._view(call_id)['peers'],'watch':call['watch'],'epoch':self.epoch,'now':self.clock()}

    def leave(self,user,peer):
        with self.cond:
            if self._owner(peer)==user:self._drop(peer)

    def info(self,user,peer):
        with self.cond:
            call_id=self._own(user,peer);call=self.calls[call_id]
            return {'call':call_id,'space':call['space'],'room':call['room'],'kind':call['kind']}

    def signal(self,user,peer,messages):
        if not isinstance(messages,list) or not 1<=len(messages)<=50:raise ValueError('Send 1–50 call messages at a time.')
        if len(json.dumps(messages))>MAX_SIGNAL:raise ValueError('Call message is too large.')
        with self.cond:
            call_id=self._own(user,peer);call=self.calls[call_id]
            if any(not isinstance(m,dict) or not isinstance(m.get('data'),dict) for m in messages):raise ValueError('Invalid call message.')
            delivered=0
            for m in messages:
                # Someone may leave while messages to them are on the way; those are skipped.
                if m.get('to') in call['peers'] and m.get('to')!=peer:
                    self._post([call['peers'][m['to']]['user']],{'type':'signal','call':call_id,'from':peer,'to':m['to'],'data':m['data']});delivered+=1
            return delivered

    def media(self,user,peer,media):
        if not isinstance(media,dict):raise ValueError('Invalid call state.')
        streams=media.get('streams') or {}
        if not isinstance(streams,dict) or any(k not in ('main','screen') or not isinstance(v,str) or len(v)>100 for k,v in streams.items()):raise ValueError('Invalid call state.')
        with self.cond:
            call_id=self._own(user,peer)
            self.calls[call_id]['peers'][peer]['media']={'muted':bool(media.get('muted')),'video':bool(media.get('video')),'screen':bool(media.get('screen')),'streams':streams}
            self._announce(call_id)

    # Direct calls ring the other person -------------------------------------------
    def ring(self,user,peer,to,video=False):
        with self.cond:
            call_id=self._own(user,peer);call=self.calls[call_id]
            if call['kind']!='dm' or to==user or to not in call['audience']:raise ValueError('Only direct conversations can ring someone.')
            if any(v['user']==to for v in call['peers'].values()):return False
            call['ring']={'from':user,'to':to,'video':bool(video),'at':self.clock()}
            self._post([to],{'type':'ring','call':call_id,'space':call['space'],'from':user,'video':bool(video)})
            self._announce(call_id)
            return True
    def decline(self,user,call_id):
        with self.cond:
            call=self.calls.get(call_id)
            if call and call['ring'] and call['ring']['to']==user:self._end_ring(call_id,'declined')
    def _end_ring(self,call_id,reason):
        call=self.calls[call_id];ring=call['ring'];call['ring']=None
        self._post([ring['from'],ring['to']],{'type':'ring_end','call':call_id,'reason':reason})
        self._announce(call_id)

    # Moderation hooks used by social_store after membership changes ------------------
    def end(self,call_id,reason):
        with self.cond:
            call=self.calls.get(call_id)
            if not call:return
            for peer in list(call['peers']):self._drop(peer,reason)
            if call_id in self.calls:
                if call['ring']:self._end_ring(call_id,reason)
                del self.calls[call_id];self._announce_or_close(call_id,call['audience'])
    def kick(self,space,user):
        with self.cond:
            for call_id,call in list(self.calls.items()):
                if call['space']==space:
                    call['audience'].discard(user)
                    for peer,v in list(call['peers'].items()):
                        if v['user']==user:self._drop(peer,'removed')

    def presence(self,call_ids):
        with self.cond:
            self._prune()
            return {k:self._view(k)['peers'] for k in call_ids if k in self.calls}

    # Watch together ---------------------------------------------------------------
    def watch(self,user,peer,action,data):
        with self.cond:
            call_id=self._own(user,peer);call=self.calls[call_id];w=call['watch'];now=self.clock()
            def play(item,start=0.0):w.update(current=item['id'] if item else None,playing=bool(item),position=float(start),at=now)
            def advance():
                ids=[i['id'] for i in w['items']]
                index=ids.index(w['current']) if w['current'] in ids else -1
                following=w['items'][index+1] if index+1<len(w['items']) else None
                w['items']=[i for i in w['items'] if i['id']!=w['current']]
                play(following,following['start'] if following else 0)
            item=next((i for i in w['items'] if i['id']==data.get('item')),None)
            if action=='add':
                if len(w['items'])>=QUEUE:raise ValueError(f'The Watch together queue holds {QUEUE} videos.')
                video,start=youtube(data.get('url'))
                added={'id':uuid.uuid4().hex,'video':video,'start':start,'by':user}
                w['items'].append(added)
                if not w['current']:play(added,start)
            elif action in ('play','pause','seek'):
                if not w['current']:raise ValueError('Nothing is playing yet. Add a YouTube link first.')
                try:at=float(data.get('position'))
                except (TypeError,ValueError):raise ValueError('Invalid video position.')
                if not 0<=at<=86400:raise ValueError('Invalid video position.')
                w.update(position=at,at=now,playing=w['playing'] if action=='seek' else action=='play')
            elif action=='select':
                if not item:raise ValueError('That video is no longer in the queue.')
                play(item,item['start'])
            elif action=='remove':
                if not item:raise ValueError('That video is no longer in the queue.')
                if item['id']==w['current']:advance()
                else:w['items']=[i for i in w['items'] if i['id']!=item['id']]
            elif action in ('next','ended'):
                # Every browser reports the end of a video; only the first report advances.
                if action=='ended' and data.get('item')!=w['current']:return w
                if w['current']:advance()
            elif action=='stop':w.update(current=None,playing=False,position=0.0,at=now)
            else:raise ValueError('Unknown Watch together action.')
            w['version']+=1
            self._post({v['user'] for v in call['peers'].values()},{'type':'watch','call':call_id,'state':w,'now':now})
            return w
