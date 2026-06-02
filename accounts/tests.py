import json

from django.test import SimpleTestCase

from accounts.services.llm_service import extract_json_object


class ExtractJsonObjectTests(SimpleTestCase):
    """Robust JSON extraction from LLM responses that may include prose,
    markdown fences, or both (e.g. web_search + thinking responses)."""

    def test_pure_json(self):
        self.assertEqual(extract_json_object('{"a": 1, "b": [1, 2]}'), {'a': 1, 'b': [1, 2]})

    def test_json_fence(self):
        self.assertEqual(extract_json_object('```json\n{"a": 1}\n```'), {'a': 1})

    def test_plain_fence(self):
        self.assertEqual(extract_json_object('```\n{"a": 1}\n```'), {'a': 1})

    def test_prose_before(self):
        text = 'Based on my research, here is the Brand DNA profile:\n{"a": 1, "b": "x"}'
        self.assertEqual(extract_json_object(text), {'a': 1, 'b': 'x'})

    def test_prose_after(self):
        self.assertEqual(extract_json_object('{"a": 1}\nLet me know if you need more!'), {'a': 1})

    def test_prose_and_fence(self):
        text = 'Here you go:\n```json\n{"brand_name": "Acme"}\n```\nHope that helps.'
        self.assertEqual(extract_json_object(text), {'brand_name': 'Acme'})

    def test_braces_inside_string_value(self):
        text = '{"note": "use {curly} and [brackets] here", "n": 2}'
        self.assertEqual(extract_json_object(text), {'note': 'use {curly} and [brackets] here', 'n': 2})

    def test_top_level_array(self):
        self.assertEqual(extract_json_object('Sure:\n[{"x": 1}, {"y": 2}]'), [{'x': 1}, {'y': 2}])

    def test_no_json_raises(self):
        for bad in ('', 'no json here at all', None):
            with self.assertRaises(json.JSONDecodeError):
                extract_json_object(bad)
