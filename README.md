# UVU Eye Tracking – Web App

The web app for running and reviewing eye-tracking usability studies at UVU.
A researcher creates a study (tasks + web addresses), adds participants, runs
the session with a Tobii Pro Nano eye tracker, and then reviews the heatmap and
scanpath videos with comments.

The app is plain HTML, CSS and JavaScript (no build step). It works together
with the Python helper in the **eye-tracking-integration** repository, which
talks to the eye tracker, Chrome and the screen recorder.

> New computer? Follow `SETUP-NEW-COMPUTER.txt` in the eye-tracking-integration
> repository. It covers Python, the venv, Tobii, Chrome and the first run.

---

## What it does

- **Studies:** create, edit and delete studies. Each study has a name, team
  members, and tasks. Every task has a web address (URL), a prompt, and a
  maximum duration (30 s to 3 min, default 1 min).
- **Home page:** study cards with a screenshot thumbnail of the first task's
  URL, status (Draft / In progress / Completed), filter tabs, Add Participant,
  Results, Edit, Delete.
- **Participants:** first name, last name, gender, age, then a consent page.
- **Session:** calibration, a short familiarization, then each task in its own
  Chrome window with a countdown. The participant's gaze, scroll, navigation
  and screen are recorded.
- **Review after each task:** the heatmap and scanpath videos are made in the
  background (about 720p, fast) and can be watched right after the task, with
  timestamped comments (retrospective think-aloud).
- **Results page:** one tab per participant, a line with the participant's name,
  gender and age, the Heatmap / Scanpath viewer, the task text, comments with an
  "Insert video time" button, and "Mark as complete".

## How the pieces fit together

```
Browser (this app) --WebSocket ws://127.0.0.1:8766--> Helper (bridge_server.py)
        |                                                 |-- Tobii Pro Nano (gaze)
        |                                                 |-- Chrome via Selenium (task window)
        |                                                 |-- screen recording + video processing
        +--HTTP http://127.0.0.1:8767--> videos (heatmap.mp4, scanpath.mp4)
```

A web page cannot control the eye tracker or record the screen, so the helper
does it and the page only sends commands and listens to events. The helper must
be running to calibrate, run tasks, take thumbnails and watch the videos.
Studies, participants and comments are saved in the browser (see **Data**).

## Quick start

On a computer where everything is already installed (see
`SETUP-NEW-COMPUTER.txt`):

1. Double-click `start-helper.bat` (in the eye-tracking-integration folder).
   It starts the helper and a small web server, then opens Chrome at
   `http://127.0.0.1:5500/index.html`.
2. Use the app. When you are done, press **Ctrl+C** in the "Eye Tracking
   Helper" window, then close Chrome.

Always open the app at the same address. Saved studies belong to that address
and that browser.

**Without the eye tracker** (UI testing only, no real gaze and no videos):

```
start-helper.bat --mode mock
```

**By hand**, instead of the .bat file:

```
# terminal 1: the helper
C:\pyenvs\eye-tracking-integration\venv\Scripts\activate.bat
cd eye-tracking-integration\bridge
python bridge_server.py --mode tobii

# terminal 2: the web app (or use VS Code Live Server on port 5500)
python -m http.server 5500 --bind 127.0.0.1 --directory eye-tracking-app
```

The helper only accepts pages from `localhost` / `127.0.0.1` on ports 5500,
3000, 5173 and 8000. To allow another address (for example a hosted site) start
it with `--origin https://your-site.example`.

## Pages and flow

| Page | Purpose |
|---|---|
| `index.html` | Home: study cards, filter tabs, thumbnails, Add Participant popup |
| `new-study.html` | Create or edit a study (`?study=ID` to edit) |
| `add-participant.html` | Participant information form |
| `consent.html` | Consent text and "Take Study" |
| `session.html` | Live session: calibration, tasks, review, finish |
| `results.html` | Results for a study (`?study=ID`) |

```
index -> (+ New Study) -> new-study -> (Save) -> index
index -> (Add Participant) -> participant form -> consent -> (Take Study) -> session
session -> (finished) -> index / results
index -> (Results) -> results
```

## Folder structure

```
eye-tracking-app/
  index.html, new-study.html, add-participant.html,
  consent.html, session.html, results.html
  css/
    variables.css      colors, fonts, spacing (the only place for these values)
    base.css           reset and page defaults
    components.css     shared pieces: header, buttons, cards, tabs, modals
    <page>.css         one file per page
  js/
    data/studies.js        sample data for the first start
    data/study-store.js    all reading and writing of studies (see Data)
    bridge-client.js       WebSocket connection to the helper
    tab-bar.js             shared tab bar with scroll arrows
    thumbnails.js          asks the helper for study card thumbnails
    <page>.js              one file per page
  assets/  fonts (Rajdhani), icons, images
```

## Data

Everything is saved in the browser's `localStorage` for the current address
(`http://127.0.0.1:5500`), through `js/data/study-store.js`. No other file reads
or writes it directly, so the storage can be replaced later without touching
the pages.

| Key | Content |
|---|---|
| `uvu-eye-tracking:studies` | all studies, with their tasks and participants |
| `uvu-eye-tracking:deleted-ids` | ids of deleted studies |
| `uvu-eye-tracking:comments:<studyId>` | comments per participant and task |
| `uvu-eye-tracking:thumbnails` | thumbnail picture per study |

A study looks like this:

```
{ id, name, siteTested, teamMembers: [...], status: "draft" | "in-progress" | "completed",
  createdAt,
  tasks: [{ text, url, duration }],
  participants: [{ id, firstName, lastName, gender, age,
                   recording: { sessionId, taskCount, status },
                   results: { <taskIndex>: { heatmap, scanpath } } }] }
```

Videos and raw recordings are not in the browser. They are files on the
computer that runs the helper, in
`eye-tracking-integration/recordings/study_<id>/participant_<n>_<code>/task_<n>/`.
The page only stores the links to the videos.

## Code rules

- Colors, fonts and spacing live in `css/variables.css` only. Use the CSS
  variables, and spacing in multiples of 4 / 8.
- Reusable pieces (header, buttons, study card, tabs, popups) live in
  `css/components.css`.
- Each page has its own CSS and JS file. No inline `onclick`; use
  `addEventListener`.
- Pages draw the UI from the data. Do not hardcode study content in the HTML.
- Do not change the original files of the Python repository for web-app
  features. The helper's own files (`bridge_server.py`, `worker_backend.py`,
  `hardware_tobii.py`, ...) are the place for those changes.

## Known limitations and next steps

- **Data is per browser and per computer.** A study created on one computer is
  not visible on another one, and clearing the browser data removes it. There
  is no Export / Import yet.
- **One computer at a time.** The app is meant to run on the lab PC with the
  eye tracker attached.
- **Shared storage (planned).** To share studies and results between devices a
  database and file storage are needed. The options are written down, and the
  place for the participant data must be approved by the lab first.
- **The helper has no auto-stop.** Close it with Ctrl+C when finished.
- **Hosting.** The pages are static and can be hosted (Netlify, Vercel), but the
  helper and the videos stay on the lab computer, and a hosted page is a new
  address with its own empty storage.

## Participant data

Names, ages and screen recordings are confidential research data. Do not commit
the `recordings` folder or participant data to Git, and do not share them
without permission.