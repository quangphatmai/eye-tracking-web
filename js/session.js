// Session: calibration, the tasks one by one, then the recordings are processed
// 1. Opens from the consent page: session.html?study=ID&participant=ID
// 2. Connects to the Python helper (js/bridge-client.js) and opens a session for this participant
// 3. Calibration: "Start calibration" asks the helper, its progress ("point 5 of 9") fills the bar
// 4. Familiarization: the participant explores the first website for 60 seconds (no tracking, no recording), then
//    reads the intro on their own screen and presses Next
// 5. Tasks: the participant reads the task, presses Start Task, and closes the browser window when finished (or the time
//    runs out). The timer counts down to the task's maximum time. The helper decides when a task really ends and tells us
//    ("task_finished")
// 5b. Review: right after a task the helper makes its heatmap and scanpath videos (some seconds, "task_processing", then
//    "task_processed"). The observer watches them with the participant (retrospective think-aloud) and writes comments,
//    the same comments as on the Results page. "Next task" goes on when the observer is ready
// 6. After the last review: the helper saves the recordings and closes the session. Videos that are not ready yet can be
//    made later from the Results page ("Process videos")
// 7. While the participant explores the website and does tasks, the helper shows their head on the observer's second screen
//    (a small Titta window, same picture as in the calibration)
// If the helper is not running the page says so, and Retry tries again.

const params = new URLSearchParams(window.location.search);
const study = getStudy(params.get("study"));
const participant = study?.participants.find((item) => item.id === Number(params.get("participant")));

const DEFAULT_DURATION = 60; // seconds, for a task saved before durations existed
const FAMILIARIZATION_SECONDS = 60; // the participant explores the first website before the tasks

const statusText = document.getElementById("bridge-status");
const retryButton = document.getElementById("bridge-retry");
const bridgeBar = document.querySelector(".bridge-bar");
const whoText = document.getElementById("session-who");
const messageBox = document.getElementById("session-message");
const retryStepButton = document.getElementById("retry-step");

const stages = {
  calibration: document.getElementById("stage-calibration"),
  familiarize: document.getElementById("stage-familiarize"),
  task: document.getElementById("stage-task"),
  review: document.getElementById("stage-review"),
  finish: document.getElementById("stage-finish"),
};

const calibrationText = document.getElementById("calibration-text");
const calibrationBar = document.getElementById("calibration-bar");
const calibrationFill = document.getElementById("calibration-fill");
const startCalibrationButton = document.getElementById("start-calibration");
const calibrationContinueButton = document.getElementById("calibration-continue");

const familiarizeTimer = document.getElementById("familiarize-timer");
const familiarizeHint = document.getElementById("familiarize-hint");
const skipFamiliarizeButton = document.getElementById("skip-familiarize");

const taskHeading = document.getElementById("task-heading");
const taskText = document.getElementById("task-text");
const taskUrl = document.getElementById("task-url");
const taskTimer = document.getElementById("task-timer");
const taskHint = document.getElementById("task-hint");

const sessionCard = document.getElementById("session-card");
const reviewHeading = document.getElementById("review-heading");
const reviewTaskText = document.getElementById("review-task-text");
const reviewReason = document.getElementById("review-reason");
const reviewSwitch = document.getElementById("review-switch");
const reviewScreen = document.getElementById("review-screen");
const reviewProgressBlock = document.getElementById("review-progress-block");
const reviewProgressText = document.getElementById("review-progress-text");
const reviewBar = document.getElementById("review-bar");
const reviewFill = document.getElementById("review-fill");
const reviewComments = document.getElementById("review-comments");
const reviewStampButton = document.getElementById("review-stamp");
const reviewNextButton = document.getElementById("review-next");

const finishHeading = document.getElementById("finish-heading");
const finishText = document.getElementById("finish-text");
const goHomeLink = document.getElementById("go-home");
const viewResultsLink = document.getElementById("view-results");

let sessionReady = false; // the helper confirmed the session ("session_started")
let wasConnected = false; // tells "helper not detected" from "connection lost"
let taskIndex = 0; // 0 = Task 1
let timerId = null;
let currentStep = null; // "familiarize", "task" or "end": what "Try again" repeats after an error
let finished = false; // the recordings are saved: the session is over
let reviewIndex = 0; // the task being reviewed
let reviewKind = "heatmap"; // "heatmap" or "scanpath": the tab of the review
const taskVideos = {}; // task index -> { status: "making" | "ready" | "none" | "failed", percent, heatmap, scanpath, message }

// ---------- Small helpers ----------

// 75 -> "1:15"
function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function isWebUrl(text) {
  try {
    return ["http:", "https:"].includes(new URL(text).protocol);
  } catch (error) {
    return false;
  }
}

function taskDuration(index) {
  return study.tasks[index].duration ?? DEFAULT_DURATION;
}

function setStatus(state, text) {
  statusText.dataset.state = state; // the css colors it: connecting / connected / error
  statusText.textContent = text;
}

function showMessage(text) {
  messageBox.textContent = text;
  messageBox.hidden = false;
}

function hideMessage() {
  messageBox.hidden = true;
}

function showStage(name) {
  Object.entries(stages).forEach(([stageName, element]) => {
    element.hidden = stageName !== name;
  });
  sessionCard.classList.toggle("is-wide", name === "review"); // room for the video next to the comments
}

function setProgress(bar, fill, done, total) {
  bar.setAttribute("aria-valuemax", String(total));
  bar.setAttribute("aria-valuenow", String(done));
  fill.style.width = `${total ? (done / total) * 100 : 0}%`;
}

// ---------- Calibration ----------

function resetCalibration() {
  calibrationText.textContent = "Not started";
  setProgress(calibrationBar, calibrationFill, 0, 9);
  startCalibrationButton.textContent = "Start calibration";
  startCalibrationButton.disabled = !sessionReady;
  calibrationContinueButton.hidden = true;
}

startCalibrationButton.addEventListener("click", () => {
  hideMessage();
  startCalibrationButton.disabled = true; // no second click while it runs
  calibrationContinueButton.hidden = true;
  // the real calibration sends no progress
  calibrationText.textContent =
    "Calibrating. The participant puts their head in the circle, presses Space and follows the dots. When it is done the results appear on your second screen: check them and press Accept there.";
  bridge.send("start_calibration");
});

bridge.on("calibration_progress", (message) => {
  calibrationText.textContent = `Point ${message.point} of ${message.total}`;
  setProgress(calibrationBar, calibrationFill, message.point, message.total);
});

bridge.on("calibration_done", (message) => {
  // the real calibration does not report a quality (null): then there is nothing more to say
  const details = message.quality ? ` Quality: ${message.quality}, average error ${message.avgErrorDeg}°` : "";
  calibrationText.textContent = `Calibration complete.${details}`;
  setProgress(calibrationBar, calibrationFill, 1, 1);
  startCalibrationButton.textContent = "Calibrate again"; // the observer can repeat it when the quality is poor
  startCalibrationButton.disabled = false;
  calibrationContinueButton.hidden = false;
});

calibrationContinueButton.addEventListener("click", () => {
  taskIndex = 0;
  startFamiliarization();
});

// ---------- Timer (only a display: the helper decides when something really ends) ----------

function startTimer(element, seconds) {
  clearInterval(timerId);
  const endTime = Date.now() + seconds * 1000;
  function tick() {
    const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    element.textContent = formatTime(left);
    if (left === 0) clearInterval(timerId);
  }
  tick();
  timerId = setInterval(tick, 250);
}

// ---------- Familiarization ----------

function startFamiliarization() {
  hideMessage();
  currentStep = "familiarize";
  showStage("familiarize");
  familiarizeTimer.textContent = formatTime(FAMILIARIZATION_SECONDS);
  familiarizeHint.textContent = "Starting the participant's screen...";
  skipFamiliarizeButton.disabled = true;
  bridge.send("start_familiarization", { url: study.tasks[0].url, duration: FAMILIARIZATION_SECONDS });
}

bridge.on("familiarization_started", (message) => {
  startTimer(familiarizeTimer, message.duration);
  familiarizeHint.textContent = "The participant is exploring the website. Nothing is tracked or recorded.";
  skipFamiliarizeButton.disabled = false;
});

bridge.on("intro_shown", () => {
  clearInterval(timerId);
  familiarizeTimer.textContent = formatTime(0);
  familiarizeHint.textContent = "The participant is reading the instructions and will press Next.";
});

skipFamiliarizeButton.addEventListener("click", () => {
  skipFamiliarizeButton.disabled = true; // skipping the waiting; the participant still presses Next
  bridge.send("finish_task");
});

// the participant pressed Next: the first task starts by itself
bridge.on("familiarization_done", () => {
  clearInterval(timerId);
  taskIndex = 0;
  startTask();
});

// ---------- Tasks ----------

// shows task `taskIndex` and asks the helper to put it on the participant's screen.
// `note` is the line under the timer. The participant presses Start Task on their own screen.
function startTask(note) {
  currentStep = "task";
  hideMessage();
  showStage("task");
  const task = study.tasks[taskIndex];
  taskHeading.textContent = `Task ${taskIndex + 1} of ${study.tasks.length}`;
  taskText.textContent = task.text || "(No task text)";
  taskUrl.textContent = task.url;
  taskTimer.textContent = formatTime(taskDuration(taskIndex));
  taskHint.textContent = note ?? "Showing the task on the participant's screen...";
  bridge.send("start_task", { index: taskIndex, text: task.text, url: task.url, duration: taskDuration(taskIndex) });
}

bridge.on("task_ready", () => {
  taskHint.textContent = "The participant is reading the task and will press Start Task. Nothing is recorded yet.";
});

bridge.on("task_started", (message) => {
  startTimer(taskTimer, message.duration);
  taskHint.textContent = "Recording. The task ends when the participant closes the browser window or when the time is up.";
});

const FINISH_REASONS = {
  timeout: " (the time ran out)",
  done: " (the participant closed the browser window)",
  next: " (stopped by the helper)",
};

bridge.on("task_finished", (message) => {
  clearInterval(timerId);
  taskVideos[taskIndex] = { status: "making", percent: 0 };
  startReview(`Task ${taskIndex + 1} finished${FINISH_REASONS[message.reason] ?? ""}.`);
});

// ---------- Review (watch the videos with the participant, write comments) ----------

// the helper makes the videos in the background, right after the task
bridge.on("task_processing", (message) => {
  const videos = taskVideos[message.index];
  if (!videos || videos.status !== "making") return;
  videos.percent = message.percent;
  if (message.index === reviewIndex && currentStep === "review") renderReview();
});

bridge.on("task_processed", (message) => {
  taskVideos[message.index] = message.heatmap
    ? { status: "ready", percent: 100, heatmap: message.heatmap, scanpath: message.scanpath }
    : { status: "none", percent: 100 }; // nothing to show (mock mode, or the task was skipped)
  // keep them: the Results page shows these videos later, also after this page was closed
  if (message.heatmap) saveTaskVideos(study.id, participant.id, message.index, message.heatmap, message.scanpath);
  markReadyWhenComplete();
  if (message.index === reviewIndex && currentStep === "review") renderReview();
});

bridge.on("task_process_failed", (message) => {
  taskVideos[message.index] = { status: "failed", percent: 0, message: message.message };
  if (message.index === reviewIndex && currentStep === "review") renderReview();
});

// `reason` = how the task ended ("Task 1 finished (the time ran out).")
// the session is over and every task has its videos: the recording needs no "Process videos"
let recordedTasks = 0; // how many tasks the helper recorded (known when the session ends)
function markReadyWhenComplete() {
  if (!finished || recordedTasks === 0) return;
  for (let index = 0; index < recordedTasks; index += 1) {
    if (taskVideos[index]?.status !== "ready") return;
  }
  markRecordingReady(study.id, participant.id);
}

function startReview(reason) {
  currentStep = "review";
  reviewIndex = taskIndex;
  reviewKind = "heatmap";
  hideMessage();
  showStage("review");
  const last = taskIndex === study.tasks.length - 1;
  reviewHeading.textContent = `Task ${taskIndex + 1} of ${study.tasks.length}: review`;
  reviewReason.textContent = `${reason} Watch the videos with the participant and ask about what they did.`;
  reviewTaskText.textContent = study.tasks[taskIndex].text || "(No task text)";
  reviewComments.value = getTaskComment(study, participant, taskIndex);
  reviewNextButton.textContent = last ? "Finish session" : `Task ${taskIndex + 2} \u2192`;
  renderReview();
}

// the video (or the reason there is none) and the progress, for the task being reviewed
function renderReview() {
  const videos = taskVideos[reviewIndex] ?? { status: "none" };
  const ready = videos.status === "ready";

  reviewSwitch.querySelectorAll(".review-switch-item").forEach((item) => {
    const active = item.dataset.kind === reviewKind;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  reviewProgressBlock.hidden = videos.status !== "making";
  if (videos.status === "making") {
    reviewProgressText.textContent = `Making the videos... ${videos.percent}%. You can already talk with the participant and write comments.`;
    setProgress(reviewBar, reviewFill, videos.percent, 100);
  }

  if (!ready) {
    reviewStampButton.disabled = true;
    const notes = {
      making: "The videos are being made...",
      none: "There is no video for this task.",
      failed: `The videos could not be made${videos.message ? `: ${videos.message}` : ""}. Open the Results page with the helper running: it will make them again.`,
    };
    reviewScreen.replaceChildren();
    const note = document.createElement("p");
    note.className = "review-screen-note";
    note.textContent = notes[videos.status] ?? notes.none;
    reviewScreen.appendChild(note);
    return;
  }

  // the two videos have the same timeline: switching tab keeps the time and the play/pause state
  const old = reviewScreen.querySelector("video");
  const time = old ? old.currentTime : 0;
  const wasPlaying = old ? !old.paused : false;
  const url = videos[reviewKind];
  if (old && old.dataset.src === url) return; // nothing changed (a progress message came late)

  const video = document.createElement("video");
  video.controls = true;
  video.dataset.src = url;
  video.src = url;
  video.setAttribute("aria-label", `${reviewKind} video`);
  video.addEventListener("loadedmetadata", () => {
    if (time > 0) video.currentTime = time;
    if (wasPlaying) video.play().catch(() => {});
  });
  // the videos are played from the helper (file_server.py): without it they cannot load
  video.addEventListener("error", () => {
    reviewStampButton.disabled = true;
    reviewScreen.replaceChildren();
    const note = document.createElement("p");
    note.className = "review-screen-note";
    note.textContent = "The video could not be loaded. Is the helper running?";
    reviewScreen.appendChild(note);
  });
  reviewScreen.replaceChildren(video);
  reviewStampButton.disabled = false;
}

reviewSwitch.addEventListener("click", (event) => {
  const item = event.target.closest(".review-switch-item");
  if (!item || item.dataset.kind === reviewKind) return;
  reviewKind = item.dataset.kind;
  renderReview();
});

// "[0:42] " at the cursor: the time of the video, so the comment says which moment it is about
reviewStampButton.addEventListener("click", () => {
  const video = reviewScreen.querySelector("video");
  if (!video) return;
  const stamp = `[${formatTime(Math.floor(video.currentTime))}] `;
  const start = reviewComments.selectionStart ?? reviewComments.value.length;
  const end = reviewComments.selectionEnd ?? start;
  const text = reviewComments.value;
  const before = text.slice(0, start);
  const lead = before && !before.endsWith("\n") ? "\n" : ""; // each note on its own line
  reviewComments.value = before + lead + stamp + text.slice(end);
  const cursor = (before + lead + stamp).length;
  reviewComments.setSelectionRange(cursor, cursor);
  reviewComments.focus();
  setTaskComment(study.id, participant.id, reviewIndex, reviewComments.value);
});

// saved while you type (the same comment is on the Results page)
reviewComments.addEventListener("input", () => {
  setTaskComment(study.id, participant.id, reviewIndex, reviewComments.value);
});

reviewNextButton.addEventListener("click", () => {
  const video = reviewScreen.querySelector("video");
  if (video) video.pause();
  reviewScreen.replaceChildren();
  if (taskIndex === study.tasks.length - 1) {
    endSession();
    return;
  }
  taskIndex += 1;
  startTask(`Task ${taskIndex} reviewed. Showing the next task on the participant's screen...`);
});

// ---------- End of the session ----------

// The helper saves the recordings and closes Chrome and the eye tracker. It does NOT make the videos now:
// that is heavy, and the next participant may be recorded on this computer in a minute.
function endSession() {
  currentStep = "end";
  hideMessage();
  showStage("finish");
  finishHeading.textContent = "Saving the recordings...";
  finishText.textContent = "Keep this page open for a moment.";
  goHomeLink.hidden = true;
  viewResultsLink.hidden = true;
  bridge.send("end_session");
}

bridge.on("session_ended", (message) => {
  finished = true;
  currentStep = null;
  saveParticipantRecording(study.id, participant.id, message.sessionId, message.tasks);
  recordedTasks = message.tasks;
  markReadyWhenComplete(); // the videos of the last task may still be in the making: then they mark it when they are done
  finishHeading.textContent = "Session complete";
  finishText.textContent =
    "The recordings are saved. The videos of the tasks are made right after each task; if one is missing, open Results with the helper running and it is made there.";
  viewResultsLink.href = `results.html?study=${study.id}`;
  goHomeLink.hidden = false;
  viewResultsLink.hidden = false;
});

// ---------- The connection to the helper ----------

bridge.on("open", () => {
  wasConnected = true;
  retryButton.hidden = true;
});

// the helper says hello as soon as we connect, then we open a session for this participant
bridge.on("ready", (message) => {
  setStatus("connected", `Eye tracker helper connected (${message.mode} mode)`);
  bridge.send("start_session", { studyId: study.id, participantId: participant.id });
});

bridge.on("session_started", () => {
  sessionReady = true;
  startCalibrationButton.disabled = false;
});

bridge.on("close", () => {
  clearInterval(timerId);
  sessionReady = false;
  startCalibrationButton.disabled = true;
  skipFamiliarizeButton.disabled = true;
  retryStepButton.hidden = true;

  if (finished) {
    setStatus("error", "Helper disconnected");
  } else if (wasConnected) {
    setStatus("error", "Connection to the helper was lost");
    showMessage("The recording stopped. Press Retry, then start again from the calibration.");
  } else {
    setStatus("error", "Helper not detected");
    showMessage("Start the helper on this computer (python bridge_server.py), then press Retry.");
  }
  wasConnected = false;
  retryButton.hidden = false;
});

// the helper refused something or the hardware failed: show why. In the calibration the observer presses the
// calibration button again, in the familiarization / a task "Try again" repeats that step
bridge.on("error", (message) => {
  clearInterval(timerId);
  showMessage(message.message);
  if (!sessionReady) return;
  startCalibrationButton.disabled = false;
  if (!stages.calibration.hidden || currentStep === "review") return;
  retryStepButton.hidden = false;
});

retryStepButton.addEventListener("click", () => {
  retryStepButton.hidden = true;
  if (currentStep === "familiarize") startFamiliarization();
  else if (currentStep === "end") endSession();
  else startTask();
});

retryButton.addEventListener("click", () => {
  hideMessage();
  retryButton.hidden = true;
  retryStepButton.hidden = true;
  currentStep = null;
  setStatus("connecting", "Connecting to the eye tracker helper...");
  // a new connection is a new session on the helper, so everything starts again from the calibration
  taskIndex = 0;
  finished = false;
  Object.keys(taskVideos).forEach((key) => delete taskVideos[key]);
  viewResultsLink.hidden = true;
  goHomeLink.hidden = true;
  showStage("calibration");
  resetCalibration();
  bridge.connect();
});

// ---------- Start ----------

// something that makes a session impossible: say what, and do not connect
function problemWithStudy() {
  if (!study) return "Study not found. Go back to the home page and start from a study card.";
  if (!participant) return "Participant not found. Add the participant again from the study card.";
  if (study.tasks.length === 0) return "This study has no tasks yet. Edit the study and add a task first.";
  const badTask = study.tasks.findIndex((task) => !isWebUrl(task.url));
  if (badTask !== -1) {
    return `Task ${badTask + 1} has no valid URL (it must start with http:// or https://). Edit the study first.`;
  }
  return null;
}

const problem = problemWithStudy();
if (problem) {
  bridgeBar.hidden = true;
  showStage("none"); // no stage matches: all hidden
  showMessage(problem);
} else {
  whoText.textContent = `${study.name} · Participant ${participant.id}: ${participant.firstName} ${participant.lastName}`;
  resetCalibration();
  bridge.connect();
}
