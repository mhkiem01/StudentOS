#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil

import os
root = Path(__file__).resolve().parents[1]
data = Path(os.environ.get("STUDENTOS_DATA") or root / "data")   # STUDENTOS_DATA: a hosted server's data folder
src = data / "quizprep.db"
dst_dir = data / "backups" if os.environ.get("STUDENTOS_DATA") else root / "backups"
dst_dir.mkdir(exist_ok=True)

if not src.exists():
    print("No database exists yet. Start QuizPrep once first.")
else:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = dst_dir / f"quizprep-{stamp}.db"
    shutil.copy2(src, dst)
    print(f"Backup created: {dst}")
input("Press Enter to close...")
