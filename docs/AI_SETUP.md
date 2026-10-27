# AI setup

The portal supports a provider layer. It never stores API keys in SQLite or
browser storage.

## Recommended: free and private Ollama

1. Install Ollama from https://ollama.com/download.
2. In PowerShell, run `ollama pull qwen3-vl:8b`.
3. Leave Ollama running, then start `START_WINDOWS.bat`.
4. Open **AI Tutor**, attach your timetable screenshot, and ask it to fill your
   timetable. Review the proposed entries before confirming import.

### Connection status and slow replies

The green **connected** badge checks the local API and exact installed model.
**Response tested** means a real chat response has completed since the portal
server started. Neither is a guarantee that every image will finish quickly.
Click the badge to recheck; it also refreshes while AI Tutor is open.

Chat shows elapsed time and live generation activity. The model may need several
minutes to load or read an image when it runs partly on the CPU. Requests allow
up to ten minutes, and incomplete responses are never offered for import.
Failed messages and attachments remain in the composer so you can retry.

After editing backend files, restart the portal server. Refreshing the browser
alone does not reload Python. A missing streaming endpoint means an older
server is still running.

For a slower or lower-memory PC, use `ollama pull qwen3-vl:4b`, then set this
permanent Windows user environment variable and restart the server:

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_MODEL', 'qwen3-vl:4b', 'User')
```

## Voice Tutor models (answer + checker)

The Voice Tutor uses two AI roles, set in `ai_models.json`:

- **voice_answer** writes the reply from your note excerpts.
- **voice_check** reviews that reply against the same excerpts. A rejected reply
  is rewritten once; if it still fails, the tutor warns you it is unverified.

Each role tries its models top to bottom. A cloud model is skipped until its
key is set, and any model that errors or runs out of free quota falls through to
the next, so the local `qwen2.5:7b` (`ollama pull qwen2.5:7b`) is always the
last resort. Edit the file to reorder models or change names; restarting is not
needed for model changes.

To add free cloud models, create a file named `.env` in the project folder
(it is git-ignored) with any of these lines, then restart the server:

```
GROQ_API_KEY=paste-key-here
GEMINI_API_KEY=paste-key-here
OPENROUTER_API_KEY=paste-key-here
```

Free keys: Groq at https://console.groq.com/keys, Gemini at
https://aistudio.google.com/apikey, OpenRouter at https://openrouter.ai/keys
(its free models end in `:free`). Cloud models receive the note excerpts for
each question, and free tiers may use that data to improve their services, so
keep sensitive notes on local models. Free model names and limits change; if
one stops working, check the provider's model list and update `ai_models.json`.

Check every model and key without opening the app:

```powershell
python tools/check_ai_models.py
```

## Optional Gemini free tier

Create an API key in Google AI Studio, then set these values in PowerShell.
The image will be sent to Google and its free quota can change.

```powershell
[Environment]::SetEnvironmentVariable('AI_PROVIDER', 'gemini', 'User')
[Environment]::SetEnvironmentVariable('GEMINI_API_KEY', 'paste-key-here', 'User')
[Environment]::SetEnvironmentVariable('GEMINI_MODEL', 'gemini-2.5-flash', 'User')
```

## Optional OpenAI API

ChatGPT Plus does not include API usage. If you separately enable API billing:

```powershell
[Environment]::SetEnvironmentVariable('AI_PROVIDER', 'openai', 'User')
[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'paste-key-here', 'User')
```

Close and reopen the terminal after changing variables. To return to the free
local default, set `AI_PROVIDER` to `ollama` or delete it.
