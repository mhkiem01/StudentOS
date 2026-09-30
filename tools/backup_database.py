#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil

root = Path(__file__).resolve().parents[1]
src = root / "data" / "quizprep.db"
dst_dir = root / "backups"
dst_dir.mkdir(exist_ok=True)

if not src.exists():
    print("No database exists yet. Start QuizPrep once first.")
else:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = dst_dir / f"quizprep-{stamp}.db"
    shutil.copy2(src, dst)
    print(f"Backup created: {dst}")
input("Press Enter to close...")
