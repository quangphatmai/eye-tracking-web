// Session: calibration, the tasks one by one, then the recordings are processed
// 1. Opens from the consent page: session.html?study=ID&participant=ID
// 2. Connects to the Python helper (js/bridge-client.js) and opens a session for this participant
// 3. Calibration: "Start calibration" asks the helper, its progress ("point 5 of 9") fills the bar
// 4. Familiarization: the participant explores the first website for 60 seconds (no tracking, no recording), then
//    reads the intro on their own screen and presses Next
// 5. Tasks: the participant reads the task, presses Start Task, and presses X when finished (or the time runs out).
//    This page only follows along and starts the next task by itself. The timer counts down to the task's maximum time,
//    the observer's button ends the task earlier. The helper decides when a task really ends and tells us ("task_finished")
// 6. After the last task: the helper saves the recordings and closes the session. The videos (heatmap, scanpath) are made
//    later from the Results page ("Process videos"), when nobody is being recorded: it is heavy work
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
const finishTaskButton = document.getElementById("finish-task");

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
  calibrationText.textContent = "Calibrating on the participant's screen. Follow the instructions shown there."; // the real calibration sends no progress
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
  finishTaskButton.hidden = true;
  bridge.send("start_task", { index: taskIndex, text: task.text, url: task.url, duration: taskDuration(taskIndex) });
}

bridge.on("task_ready", () => {
  taskHint.textContent = "The participant is reading the task and will press Start Task. Nothing is recorded yet.";
});

bridge.on("task_started", (message) => {
  startTimer(taskTimer, message.duration);
  taskHint.textContent = "Recording. The task ends when the participant presses X, when the time is up, or when you press the button.";
  finishTaskButton.textContent = taskIndex === study.tasks.length - 1 ? "Finish" : "Next task";
  finishTaskButton.disabled = false;
  finishTaskButton.hidden = false;
});

finishTaskButton.addEventListener("click", () => {
  finishTaskButton.disabled = true; // wait for "task_finished"
  bridge.send("finish_task");
});

const FINISH_REASONS = {
  timeout: " (the time ran out)",
  done: " (the participant pressed X)",
  next: " (ended by the observer)",
};

bridge.on("task_finished", (message) => {
  clearInterval(timerId);
  const note = `Task ${taskIndex + 1} finished${FINISH_REASONS[message.reason] ?? ""}. Showing the next task on the participant's screen...`;

  if (taskIndex === study.tasks.length - 1) {
    endSession();
    return;
  }
  taskIndex += 1;
  startTask(note);
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
  finishHeading.textContent = "Session complete";
  finishText.textContent =
    "The recordings are saved. When all participants are done, open Results and press Process videos: it takes a while and needs the computer to be free.";
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
  finishTaskButton.disabled = true;
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
  if (!stages.calibration.hidden) return;
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
