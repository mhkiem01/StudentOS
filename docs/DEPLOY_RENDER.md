# Putting StudentOS online with Render

Render runs `server.py` exactly as your laptop does, and a **persistent disk** keeps every database, picture and
handwriting page safe between restarts and updates. Everything is described in [`render.yaml`](../render.yaml), so
Render sets it up for you. You get an `https://…onrender.com` address that works on any device, with no Tailscale.

**Cost:** a disk needs a paid instance (the free one forgets everything). The Blueprint uses the *Starter* instance
and a 1 GB disk; check [render.com/pricing](https://render.com/pricing) for current prices.

## 1. Push the code to `main`

Render deploys the `main` branch. Merge `master` into `main` (pull request on GitHub) so it includes `render.yaml`.

## 2. Create the service

1. Sign in at [render.com](https://render.com) with your GitHub account.
2. **New +** → **Blueprint** → choose the **StudentOS** repository → branch **main**.
3. Render reads `render.yaml` and shows one web service, **studentos** (Starter), with a 1 GB disk.
   - It asks for `GROQ_API_KEY` and `OPENROUTER_API_KEY`. These are optional, for the Voice Tutor; you can leave
     them empty and add them later under the service's **Environment** tab. Keys go only into Render, never GitHub.
4. **Apply**. Render asks for a payment method for the paid instance.
5. Wait for the deploy to show **Live**. The address is at the top of the service page.

## 3. Sign in: bring your data, or start fresh

### Bring the data from your laptop (recommended)

Your accounts, notes, quizzes, uploads and handwriting are in the `data/` folder of the laptop that ran the app.

1. On that laptop, **stop the app** (close the black window, or press Ctrl+C), so the files are complete.
2. Make an SSH key, if you don't have one. In PowerShell: `ssh-keygen -t ed25519` and press Enter to accept
   the defaults. Show the public key with `type $env:USERPROFILE\.ssh\id_ed25519.pub` and copy the line.
3. Render → your avatar → **Account Settings** → **SSH Public Keys** → **Add SSH Public Key** → paste it.
4. On the service page: **Connect** → **SSH**, and copy the address, for example `srv-abc123@ssh.singapore.render.com`.
5. In PowerShell, in the project folder (use your own address):

   ```powershell
   scp -r data srv-abc123@ssh.singapore.render.com:/var/data/incoming
   ```

6. On the service page: **Shell**, then run:

   ```bash
   python tools/restore_data.py /var/data/incoming
   rm -rf /var/data/incoming
   ```

7. **Manual Deploy** → **Restart service**. Sign in with your usual username and password.

### Or start fresh

On the service page open **Shell** and run `cat /var/data/ADMIN_FIRST_LOGIN.txt`. Sign in as `admin` with that
temporary password and choose a new one. Create other accounts from Settings.

## After it's online

- **The online copy is now your real copy.** The laptop has its own separate database, so don't keep using both:
  changes don't sync between them.
- **Phones and tablets:** just open the `https://` address. The Voice Tutor's microphone works there too.
- **AI:** Ollama runs on a laptop, not on Render, so the AI Tutor chat and timetable photo scan can't answer online.
  The Voice Tutor works once `GROQ_API_KEY` or `OPENROUTER_API_KEY` is set (see [AI setup](AI_SETUP.md)).
- **Updates:** push to `main`; GitHub CI runs, and Render deploys automatically only after the checks pass.
  Your data stays on the disk through every update.
- **Backups:** Render takes automatic snapshots of the disk (service → **Disks**). You can also download your own
  workspace from Settings in the app.
- **Forgotten admin password:** Shell → `python tools/manage_accounts.py reset-admin`.
- **It's on the public internet:** use a strong admin password and only create accounts for people you trust
  (there is no open sign-up).
- **The old Vercel project** only served the page design without the server. Remove it in Vercel → project →
  **Settings** → **Advanced** → **Delete Project**.

## If something goes wrong

- **Blueprint error about `autoDeployTrigger`:** replace that line in `render.yaml` with `autoDeploy: true`.
- **Deploy stuck at the health check:** open **Logs**; the server prints its errors there.
- **Signed out straight after signing in:** use the `https://` address (sign-in cookies are HTTPS-only online).
- **Data missing after an update:** check that `STUDENTOS_DATA` is `/var/data` and the disk is mounted at `/var/data`.

## How the app knows it is online

These environment variables are set by `render.yaml`. Without them, the app behaves exactly as on a laptop.

| Variable | Meaning |
|---|---|
| `PORT` | The port to listen on (Render sets it). |
| `STUDENTOS_DATA` | Folder for all databases, uploads and backups: the disk. |
| `PORTAL_HTTPS=1` | Sign-in cookies are sent only over HTTPS. |
| `PORTAL_TRUST_PROXY=1` | Failed sign-ins are counted per visitor, using the address Render forwards. |
| `RENDER_EXTERNAL_URL` / `PORTAL_PUBLIC_URL` | The public address shown at startup (Render sets the first). |
