import unittest
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import ai_provider
from tests.accounts import test_accounts

class AssistantHTTPTests(unittest.TestCase):
    setUp=test_accounts.AccountTests.setUp
    tearDown=test_accounts.AccountTests.tearDown
    req=test_accounts.AccountTests.req
    login=test_accounts.AccountTests.login
    new_user=test_accounts.AccountTests.new_user
    def test_confirmation_receipts_are_account_scoped(self):
        token,_=self.login();student,st=self.new_user()
        self.assertEqual(self.req('/api/assistant/capabilities')[0],401)
        body={'request_id':'private_review_123456','proposal':{'operation':'todos.save','data':{'title':'Private admin task'}}}
        self.assertEqual(self.req('/api/assistant/prepare',body,token)[0],200)
        execute={'request_id':body['request_id'],'confirmed':True}
        self.assertEqual(self.req('/api/assistant/execute',execute,st,student)[0],400)
        self.assertEqual(self.req('/api/assistant/execute',execute,token)[0],200)
        self.assertEqual(self.req('/api/assistant/execute',execute,token)[0],200)
        self.assertNotIn('Private admin task',str(self.req('/api/general-todos',token=st,user=student)[1]))
    def test_chat_context_cannot_be_spoofed_or_cross_accounts(self):
        student,token=self.new_user()
        with patch.object(ai_provider,'_ollama_chat',return_value={'message':{'content':'{"reply":"You have no subjects yet.","actions":[]}'}}) as model:
            code,result,_=self.req('/api/ai/chat',{'messages':[{'role':'user','content':'What subjects do I have?'}],'context':{'app':{'subjects':[{'id':'private','name':'Spoofed'}]}}},token,student)
        self.assertEqual(code,200,result)
        system=model.call_args[0][0]['messages'][0]['content']
        self.assertNotIn('Admin private',system);self.assertNotIn('Spoofed',system)

if __name__=='__main__':unittest.main()
