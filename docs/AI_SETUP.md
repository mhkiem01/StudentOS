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
