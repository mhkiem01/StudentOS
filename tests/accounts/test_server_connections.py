import threading,unittest
from unittest.mock import patch
from urllib import request,error
import backend  # adds backend/<feature> folders to the import path
import server

def burst(server_class,n=150):
    """Open n connections at the same instant, like a browser fetching every script over HTTP/2 through a proxy.
    Returns how many connections the server refused."""
    http=server_class(('0.0.0.0',0),server.Handler)
    threading.Thread(target=http.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{http.server_port}/api/health';barrier=threading.Barrier(n);refused=[]
    def hit():
        barrier.wait()
        try:
            with request.urlopen(url,timeout=20) as r:r.read()
        except error.HTTPError:pass  # any HTTP answer means the connection was accepted
        except Exception as exc:refused.append(repr(exc))
    try:
        threads=[threading.Thread(target=hit) for _ in range(n)]
        for t in threads:t.start()
        for t in threads:t.join()
    finally:http.shutdown();http.server_close()
    return refused

class ConnectionBurstTests(unittest.TestCase):
    def test_simultaneous_connections_are_accepted(self):
        # Behind Tailscale Serve, refused connections show up as "502 Bad Gateway" for scripts and styles,
        # leaving the page half-loaded. Python's default backlog (5) refuses many of these.
        with patch.object(server.Handler,'log_message',lambda *a:None):refused=burst(server.PortalServer)
        self.assertEqual(refused,[])

if __name__=='__main__':unittest.main()
