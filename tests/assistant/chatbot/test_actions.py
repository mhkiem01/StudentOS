import json
import unittest
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import ai_provider as ai


class ChatActionTests(unittest.TestCase):
    def answer(self, prompt, actions, context=None, image=None):
        with patch.object(ai, '_ollama_chat', return_value={'message':{'content':json.dumps({'reply':'Prepared','actions':actions})}}) as model:
            result=ai.chat([{'role':'user','content':prompt}],image,context or {'current_date':'2026-09-20'})
        return result,model

    def test_weekly_reminder_resolves_next_monday(self):
        result,_=self.answer('Add a reminder every Monday', [{'type':'reminders_create','reminders':[{'title':'COMP1521 lab','day':0,'due_time':'','recurrence':'weekly','repeat_until':'2026-11-16'}]}])
        self.assertEqual(result['actions'][0]['reminders'][0]['due_date'],'2026-09-21')
        self.assertIn('Nothing has been saved',result['reply'])

    def test_deadline_schema_requires_reviewable_action(self):
        _,model=self.answer('Add a deadline tomorrow at 5 PM',[])
        self.assertEqual(model.call_args.args[0]['format']['properties']['actions']['minItems'],1)

    def test_how_to_question_does_not_force_creation(self):
        _,model=self.answer('How do I add a reminder?',[])
        self.assertNotIn('minItems',model.call_args.args[0]['format']['properties']['actions'])

    def test_mixed_request_keeps_multiple_action_types(self):
        _,model=self.answer('Add a reminder and a calendar event',[])
        self.assertIn('anyOf',model.call_args.args[0]['format']['properties']['actions']['items'])

    def test_dated_event_preserves_date_time(self):
        draft={'title':'Study','day':0,'event_date':'2026-10-05','start_time':'09:30','end_time':'10:30','recurrence':'none','location':''}
        result,_=self.answer('Schedule a study session on 5 October',[{'type':'timetable_import','events':[draft]}])
        self.assertEqual(result['actions'][0]['events'][0],draft)

    def test_note_is_only_a_proposal(self):
        result,_=self.answer('Create a note about TCP',[{'type':'notes_create','notes':[{'title':'TCP','content':'Reliable ordered transport.'}]}])
        self.assertEqual(result['actions'][0]['type'],'notes_create')
        self.assertIn('confirm to save',result['reply'])

    def test_unrecognised_actions_cannot_escape_allowlist(self):
        result,_=self.answer('Hello',[{'type':'delete_everything'}])
        self.assertEqual(result['actions'],[])

    def test_invalid_proposals_are_rejected(self):
        for action in [{'type':'notes_create','notes':[{'title':'Missing content'}]}, {'type':'timetable_import','events':[None]}, {'type':'reminders_create','reminders':[None]}]:
            with self.subTest(action=action), self.assertRaises(RuntimeError):self.answer('Create something',[action])

    def test_image_validation_runs_before_model(self):
        for image in ['data:image/svg+xml;base64,QQ==','data:image/png;base64,%%%']:
            with patch.object(ai,'_ollama_chat') as model:
                with self.assertRaises(ValueError):ai.chat([{'role':'user','content':'Read image'}],image)
                model.assert_not_called()

    def test_context_and_image_are_passed_to_model(self):
        _,model=self.answer('Read this',[],{'current_date':'2026-09-20','agenda':[{'title':'Lecture','date':'2026-09-21'}]},'data:image/png;base64,QQ==')
        payload=model.call_args.args[0]
        self.assertIn('Lecture',payload['messages'][0]['content'])
        self.assertEqual(payload['messages'][-1]['images'],['QQ=='])


if __name__=='__main__':unittest.main()
