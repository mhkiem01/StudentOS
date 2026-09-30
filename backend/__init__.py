"""Backend modules, grouped by feature.

Modules import each other by plain name (e.g. ``import calendar_store``), so
importing this package adds every feature folder to ``sys.path``.
Run ``import backend`` before importing any backend module.
"""
import sys
from pathlib import Path

for folder in sorted(Path(__file__).resolve().parent.iterdir()):
    if folder.is_dir() and not folder.name.startswith(('_', '.')) and str(folder) not in sys.path:
        sys.path.insert(0, str(folder))
