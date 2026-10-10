"""Focused configuration discovery and validation checks."""
import json
from pathlib import Path
import tempfile
import unittest
from application import load_application, write_adapter

class ApplicationConfigTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'main').mkdir()
        (self.root / 'main' / 'ui.c').write_text('void enter(void) {}')
        self.cfg = {'version': 1, 'sources': ['main/*.c'],
                    'pages': [{'title': 'App', 'enter': 'enter', 'exit': 'leave', 'key': 'key'}]}
    def write(self):
        (self.root / 'web-simulator.json').write_text(json.dumps(self.cfg), encoding='utf-8')
    def test_manifest_is_discovered_after_creation(self):
        self.assertIsNone(load_application(self.root))
        self.write()
        self.assertEqual(len(load_application(self.root)['sources']), 1)
    def test_new_glob_matches_are_discovered(self):
        self.write()
        (self.root / 'main' / 'extra.c').write_text('void extra(void) {}')
        self.assertEqual(len(load_application(self.root)['sources']), 2)
    def test_source_glob_cannot_escape_project(self):
        self.cfg['sources'] = ['../*.c']
        self.write()
        with self.assertRaises(ValueError): load_application(self.root)
    def test_missing_source_is_actionable(self):
        self.cfg['sources'] = ['main/missing.c']
        self.write()
        with self.assertRaisesRegex(ValueError, 'matched nothing'): load_application(self.root)
    def test_function_names_cannot_inject_generated_code(self):
        self.cfg['pages'][0]['enter'] = 'enter(); broken'
        self.write()
        with self.assertRaisesRegex(ValueError, 'hook'): load_application(self.root)
    def test_macros_cannot_inject_cmake(self):
        self.cfg['defines'] = ['X); message(FATAL_ERROR bad)']
        self.write()
        with self.assertRaisesRegex(ValueError, 'defines'): load_application(self.root)
    def test_asset_target_cannot_escape_or_replace_runtime(self):
        for target in ['../outside', 'runtime.wasm']:
            self.cfg['assets'] = [{'source': 'main/ui.c', 'target': target}]
            self.write()
            with self.assertRaises(ValueError): load_application(self.root)
    def test_root_web_override_and_optional_step(self):
        self.cfg['assets'] = [{'source': 'main', 'target': '.'}]
        self.write()
        cfg = load_application(self.root)
        config = write_adapter(cfg, self.root / 'cache')
        self.assertTrue(config.is_file())
        self.assertIn('SIM_APP_PAGE_COUNT 1', (config.parent / 'app_router.h').read_text())
    def test_multiple_pages_generate_distinct_routes(self):
        self.cfg['pages'].append({'title':'Other','enter':'other_enter','exit':'other_exit','key':'other_key','step':'other_step'})
        self.write()
        config = write_adapter(load_application(self.root), self.root / 'cache')
        header = (config.parent / 'app_router.h').read_text()
        self.assertIn('case 1: other_enter();', header)
        self.assertIn('other_key(key,event)', header)

if __name__ == '__main__':
    unittest.main()
