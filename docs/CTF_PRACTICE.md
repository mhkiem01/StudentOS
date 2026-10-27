# CTF practice

Capture-the-flag challenges for cybersecurity subjects, kept next to each topic's quizzes.

## Turning it on

Open the subject's **Edit subject** window (or its **•••** menu) and tick **🚩 CTF practice**. The subject then gets a **CTF** tab, each of its topics gets a **CTF challenges** card and a **CTF** tab, and nothing else changes: quizzes, flashcards and notes work as before. Turning it off hides CTF practice without deleting any challenges.

## Practising with AI (like the quiz import)

**✨ Generate with AI** on the CTF tab, or on a topic's CTF card, opens three steps:

1. **Choose what to practise**: topic, number of challenges, difficulty (mixed, easy, medium or hard) and an optional focus such as "format strings, ROP".
2. **Copy the prompt** shown in the window into ChatGPT, DeepSeek, Gemini or another AI tool. It updates as you change step 1 and asks for self-contained challenges in the portal's format, each with a flag, hints and a step-by-step solution.
3. **Paste the AI's answer**. It is checked as you paste, and **Start practising →** saves the challenges and opens the first one. **Next challenge →** moves to the next unsolved challenge.

The reader accepts the usual AI formatting: the whole answer inside a code block, **bold** labels, "Challenge 1:" numbering, flags in backticks, and everyday names such as "Binary Exploitation", "Reverse Engineering", "Cryptography", "Beginner" or "Intermediate". AI tools make mistakes: if a flag does not follow from its challenge, edit the challenge or read its solution.

## Adding your own

**＋ Add your own** takes a title, topic, category (pwn, rev, web, crypto, forensics, misc, osint), difficulty, points, description (put code in ``` fences), an optional `nc` address, flag, flag format, hints (one per line), solution and source. Step 3 of the AI window also accepts challenges you write yourself in the same format; open "See the format" there for an example.
- **Files** (binaries, source, captures) can be attached to a challenge: up to 10 MB each and 100 MB per topic. They are only ever downloaded, never run or shown inline by the portal.

## Solving

You solve challenges on your own computer or VM (pwntools, gdb, Ghidra and so on): the portal does not run vulnerable programs or servers. Then:

- **Submit the flag**. It is checked against a salted SHA-256 hash: the portal never shows a stored flag, even when you edit the challenge. A wrong answer in the wrong shape tells you the expected format (for example `FLAG{...}`).
- **Hints** are revealed one at a time and counted.
- **Show solution** reveals the writeup, but the challenge then gives no points, even if you solve it afterwards.
- **Your notes & writeup** save automatically.
- **Your solution & AI mentor review** (see below) save automatically too.
- **Start over** clears tries, hints, solved status and submissions, but keeps your notes.
- Challenges with no stored flag (for example course wargames, whose flags you only learn by solving) are marked solved by hand, optionally with the flag you found.

The CTF tab shows solved challenges and points, with filters by topic, category and status.

## Binary challenges and Binary Ninja

A browser chat AI outputs text, not files, so it cannot hand you a working ELF. For `pwn`/`rev` challenges the generation prompt now asks the AI for the full **C source plus a one-line build command** (and the exact `checksec`). You compile it yourself — on Windows that means WSL or Docker `gcc` — and open the resulting binary in Binary Ninja. Attach the source and/or the compiled binary to the challenge with **Attach file** (downloads only, up to 10 MB each; the portal never runs them).

## AI mentor review of your solve code

Each challenge has a **Your solution** editor. Write or paste your `solve.py` there (it autosaves), then press **✨ Check my code**. The server sends the challenge (its C source, disassembly, protections, I/O and hints) and your code to an AI that returns a verdict — *Looks correct*, *Almost — small fixes*, or *Not there yet* — with concrete, line-level feedback (wrong offset, missing `ret` alignment, a `recvuntil` that will not match, and so on).

Two deliberate limits:

- The reviewer **never sees the flag or the written solution**, so it cannot leak them (`review_context` withholds both). It judges whether the *exploit logic* fits the challenge, not against a known answer.
- It **reads** your code; it does not run it, so it cannot *prove* an exploit works. The authoritative check stays the hash-verified flag you get by running your exploit locally and submitting it. The AI is a mentor, not the gate to the flag.

The reviewer uses a `ctf_review` role in `ai_models.json`, routed like the Voice Tutor: Groq `openai/gpt-oss-120b`, then OpenRouter, then local Ollama **`qwen2.5-coder:7b`** (pull it with `ollama pull qwen2.5-coder:7b`; the *coder* variant reads pwntools and offsets better than plain `qwen2.5`). Model strength matters for this, so feedback is sharper when a cloud key is set (see `docs/AI_SETUP.md`). The call runs outside the database transaction; if no model is reachable you get a clear message and can still solve and submit normally. Your code and the last review are stored per challenge in `ctf_progress` (`solution_code`, `review_json`) and never leave your workspace.

## Storage

Challenges live in your own workspace database (`ctf_*` tables, created automatically when the server starts). They are included in the workspace backup, belong to their topic, and are deleted with it. The server only sends the browser hints you have revealed, and the solution once you have solved or revealed it.

## Tests

```powershell
python -m unittest tests.study.test_ctf tests.study.test_ctf_review -v
python tests/support/run_browser_check.py --ctf
```
