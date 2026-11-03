// Results
// 1. Participant tabs: one tab per participant of the study, clicking a tab switches whose data is shown
// 2. Task navigation: "Task 2 →" shows the next task (and a "← Task 1" back when needed)
// 3. Mark as complete: a toggle. Click = the study becomes "completed" (home page shows it), click again = undo (back to in progress)
// 4. Viewer: heatmap and scanpath slides, scroll sideways. A <video> when there is a url, else a placeholder
// 5. Comments: one per participant per task, saved in localStorage while you type
// 6. Process videos: the recordings of a session are raw. This page asks the Python helper to make the heatmap and scanpath
//    videos, one participant after the other, and shows each participant's progress (Recorded / Processing / Ready)

const COMMENTS_KEY_PREFIX = "uvu-eye-tracking:comments:"; // + study id

const params = new URLSearchParams(window.location.search);
let study = getStudy(params.get("study"));
// opened without ?study=: show the first study that has results, handy while building
if (!study && !params.has("study")) {
  study = getStudies().find((item) => item.status !== "draft" && item.participants.length > 0);
}

const tabsScroller = document.getElementById("participant-scroller");
const participantTabs = document.getElementById("participant-tabs");
const resultsContent = document.getElementById("results-content");
const resultsMessage = document.getElementById("results-message");
const viewer = document.getElementById("results-viewer");
const viewerSwitchItems = document.querySelectorAll("#viewer-switch .viewer-switch-item");
const taskTitle = document.getElementById("task-title");
const taskText = document.getElementById("task-text");
const commentsBox = document.getElementById("task-comments");
const prevTaskButton = document.getElementById("prev-task");
const nextTaskButton = document.getElementById("next-task");
const doneButton = document.getElementById("done-btn");
const processPanel = document.getElementById("process-panel");
const processSummary = document.getElementById("process-summary");
const processButton = document.getElementById("process-btn");
const processList = document.getElementById("process-list");
const processNote = document.getElementById("process-note");

let participantIndex = 0;
let taskIndex = 0;

// ---------- Nothing to show ----------

function showMessage(text) {
  tabsScroller.hidden = true;
  resultsContent.hidden = true;
  doneButton.hidden = true; // nothing to complete
  resultsMessage.hidden = false;
  resultsMessage.textContent = text;
}

// ---------- Comments (saved per participant, per task) ----------

// { [participantId]: { [taskIndex]: "text" } }
let savedComments = {};

function loadComments() {
  try {
    const stored = localStorage.getItem(COMMENTS_KEY_PREFIX + study.id);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {}; // storage blocked or broken: start with the comments from the data
  }
}

function saveComments() {
  try {
    localStorage.setItem(COMMENTS_KEY_PREFIX + study.id, JSON.stringify(savedComments));
  } catch (error) {
    console.warn("Could not save the comments", error);
  }
}

function getComment(participant, task) {
  const edited = savedComments[participant.id]?.[task];
  if (edited !== undefined) return edited;
  return participant.comments?.[task] ?? "";
}

function setComment(participant, task, text) {
  savedComments[participant.id] = savedComments[participant.id] || {};
  savedComments[participant.id][task] = text;
}

// ---------- Viewer ----------

function renderSlide(slide, label, videoUrl, noteText = "Video placeholder, no recording yet") {
  slide.replaceChildren();

  if (videoUrl) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = videoUrl;
    video.setAttribute("aria-label", `${label} video`);
    // the videos are played from the helper (file_server.py): without it they cannot load
    video.addEventListener("error", () => renderSlide(slide, label, null, "The video could not be loaded. Is the helper running?"));
    slide.appendChild(video);
    return;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "video-placeholder";
  const title = document.createElement("strong");
  title.textContent = label;
  const note = document.createElement("span");
  note.textContent = noteText;
  placeholder.append(title, note);
  slide.appendChild(placeholder);
}

function currentSlideIndex() {
  return Math.round(viewer.scrollLeft / viewer.clientWidth);
}

function updateViewerSwitch() {
  const active = currentSlideIndex();
  viewerSwitchItems.forEach((item, index) => {
    item.classList.toggle("is-active", index === active);
    item.setAttribute("aria-pressed", String(index === active));
  });
  // only the slide you are looking at keeps playing
  viewer.querySelectorAll(".result-slide").forEach((slide, index) => {
    if (index !== active) slide.querySelector("video")?.pause();
  });
}

// ---------- Mark as complete (toggle) ----------

function renderDoneButton() {
  const done = study.status === "completed";
  doneButton.textContent = done ? "\u2713 Completed" : "Mark as complete";
  doneButton.title = done ? "Click to undo" : "";
  doneButton.setAttribute("aria-pressed", String(done));
  doneButton.classList.toggle("btn-primary", !done);
  doneButton.classList.toggle("btn-outline", done);
}

function setCompleted(done) {
  // undo goes back to in progress: a study with participants is never a draft
  study = { ...study, status: done ? "completed" : "in-progress" };
  saveStudy(study);
  renderDoneButton();
}

// ---------- Process videos ----------

// what each participant row shows while the helper works: { [participantId]: { state, done, total, percent, message } }
// states: "waiting" (in the queue), "processing", "failed". No entry = the saved status of the participant is shown
let processRows = {};
let processing = false;
let helperReady = false; // the helper said hello ("ready") on the open connection
let wasConnected = false; // tells "helper not detected" from "connection lost"
let pendingStart = null; // the participants to send as soon as the helper says hello

function participantName(participant, index) {
  return `Participant ${index + 1}: ${participant.firstName} ${participant.lastName}`;
}

function showProcessNote(text) {
  processNote.textContent = text ?? "";
  processNote.hidden = !text;
}

// one row of the list: name, status, and a small bar while it is being processed
function renderProcessRow(participant, index) {
  const row = processRows[participant.id];
  const item = document.createElement("li");
  item.className = "process-row";

  const name = document.createElement("span");
  name.className = "process-name";
  name.textContent = participantName(participant, index);

  const status = document.createElement("span");
  status.className = "process-status";
  const bar = document.createElement("div");
  bar.className = "process-bar";
  const fill = document.createElement("div");
  fill.className = "process-bar-fill";
  bar.appendChild(fill);

  let state = participant.recording.status === "ready" ? "ready" : "recorded";
  if (row) state = row.state;

  if (state === "ready") {
    status.textContent = "Ready";
  } else if (state === "waiting") {
    status.textContent = "Waiting";
  } else if (state === "processing") {
    status.textContent = `Making the videos, task ${Math.min(row.done + 1, row.total)} of ${row.total} (${row.percent}%)`;
    fill.style.width = `${row.total ? ((row.done + row.percent / 100) / row.total) * 100 : 0}%`;
  } else if (state === "failed") {
    status.textContent = `Failed: ${row.message}`;
  } else {
    status.textContent = "Recorded, not processed yet";
  }
  item.dataset.state = state;
  item.append(name, status, bar);
  return item;
}

function renderProcessPanel() {
  const recorded = study.participants.filter((participant) => participant.recording);
  const toProcess = getParticipantsToProcess(study);
  const failed = Object.values(processRows).some((row) => row.state === "failed");

  // nothing to show: no recordings, or everything is ready
  if (recorded.length === 0 || (!processing && toProcess.length === 0 && !failed)) {
    processPanel.hidden = true;
    return;
  }
  processPanel.hidden = false;

  if (processing) {
    processSummary.textContent = "Making the videos. Keep this page open, and do not record a participant on this computer meanwhile.";
  } else if (failed) {
    processSummary.textContent = "Some videos could not be made. Finished participants are kept.";
  } else {
    processSummary.textContent =
      toProcess.length === 1 ? "1 recording is not processed yet." : `${toProcess.length} recordings are not processed yet.`;
  }
  processButton.textContent = failed && !processing ? `Try again (${toProcess.length})` : `Process videos (${toProcess.length})`;
  processButton.disabled = processing || toProcess.length === 0;

  processList.replaceChildren(
    ...study.participants
      .map((participant, index) => (participant.recording ? renderProcessRow(participant, index) : null))
      .filter(Boolean),
  );
}

function startProcessing() {
  const list = getParticipantsToProcess(study);
  if (list.length === 0) return;

  const participants = list.map((participant) => ({
    participantId: participant.id,
    sessionId: participant.recording.sessionId,
    tasks: participant.recording.taskCount,
  }));
  processing = true;
  processRows = {};
  list.forEach((participant) => {
    processRows[participant.id] = { state: "waiting", done: 0, total: participant.recording.taskCount, percent: 0 };
  });
  showProcessNote("");
  renderProcessPanel();

  const message = { studyId: study.id, participants };
  if (helperReady) {
    bridge.send("process_participants", message);
  } else {
    pendingStart = message; // sent when the helper says hello
    bridge.connect();
  }
}

function stopProcessing(note) {
  processing = false;
  Object.keys(processRows).forEach((id) => {
    if (processRows[id].state !== "failed") delete processRows[id]; // back to their saved status
  });
  showProcessNote(note);
  renderProcessPanel();
}

bridge.on("open", () => {
  wasConnected = true;
});

bridge.on("ready", () => {
  helperReady = true;
  if (pendingStart) {
    bridge.send("process_participants", pendingStart);
    pendingStart = null;
  }
});

bridge.on("participant_started", (message) => {
  const row = processRows[message.participantId];
  if (row) Object.assign(row, { state: "processing", done: 0, percent: 0 });
  renderProcessPanel();
});

bridge.on("participant_progress", (message) => {
  const row = processRows[message.participantId];
  if (row) Object.assign(row, { state: "processing", done: message.done, total: message.total, percent: message.percent });
  renderProcessPanel();
});

// each participant is saved as soon as it is done: when the page is closed in the middle, the finished ones stay finished
bridge.on("participant_done", (message) => {
  saveParticipantResults(study.id, message.participantId, message.videos);
  study = getStudy(study.id);
  delete processRows[message.participantId];
  renderProcessPanel();
  if (study.participants[participantIndex]?.id === message.participantId) render(); // the one on screen gets its videos
});

bridge.on("participant_failed", (message) => {
  processRows[message.participantId] = { state: "failed", message: message.message, done: 0, total: 0, percent: 0 };
  renderProcessPanel();
});

bridge.on("processing_done", () => {
  stopProcessing("");
  study = getStudy(study.id);
  render();
});

bridge.on("error", (message) => {
  pendingStart = null;
  if (processing) stopProcessing(message.message);
});

bridge.on("close", () => {
  helperReady = false;
  pendingStart = null;
  const lost = wasConnected;
  wasConnected = false;
  if (!processing) return;
  stopProcessing(
    lost
      ? "The connection to the helper was lost. Finished participants are kept. Start the helper again and press Process videos."
      : "The helper is not running. Start it on this computer (python bridge_server.py --mode tobii), then press Process videos.",
  );
});

processButton.addEventListener("click", startProcessing);

// ---------- Page ----------

function render() {
  const participant = study.participants[participantIndex];
  const task = study.tasks[taskIndex];
  const result = participant.results?.[taskIndex];

  taskTitle.textContent = `Task ${taskIndex + 1}:`;
  taskText.textContent = task ? task.text : "This study has no tasks yet.";
  commentsBox.value = getComment(participant, taskIndex);

  // recorded but the videos are not made yet: say so, instead of "no recording"
  const notProcessed = participant.recording && participant.recording.status !== "ready";
  const note = notProcessed ? "Recorded. Press Process videos to make this video." : undefined;
  renderSlide(document.getElementById("slide-heatmap"), "Heatmap", result?.heatmap, note);
  renderSlide(document.getElementById("slide-scanpath"), "Scanpath", result?.scanpath, note);
  viewer.scrollTo({ left: 0 }); // each participant / task starts on the heatmap
  updateViewerSwitch();

  // Task buttons: back only after Task 1, next only before the last task
  prevTaskButton.hidden = taskIndex === 0;
  prevTaskButton.textContent = `← Task ${taskIndex}`;
  nextTaskButton.hidden = taskIndex >= study.tasks.length - 1;
  nextTaskButton.textContent = `Task ${taskIndex + 2} →`;
}

function startResults() {
  savedComments = loadComments();

  // one tab per participant, the first one is active
  study.participants.forEach((participant, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab-bar-item";
    tab.dataset.filter = String(index); // initTabBar passes this to the callback below
    tab.textContent = `Participant ${index + 1}`;
    tab.classList.toggle("is-active", index === 0);
    tab.setAttribute("aria-pressed", String(index === 0));
    participantTabs.appendChild(tab);
  });

  initTabBar(participantTabs, (filter) => {
    participantIndex = Number(filter);
    render();
  });
  initTabBarScroll(tabsScroller);

  // Viewer buttons scroll to their slide; scrolling by hand updates the buttons
  viewerSwitchItems.forEach((item, index) => {
    item.addEventListener("click", () => {
      viewer.scrollTo({ left: index * viewer.clientWidth, behavior: "smooth" });
    });
  });
  viewer.addEventListener("scroll", updateViewerSwitch);

  // Comments: saved while you type, so leaving with Back never loses them
  commentsBox.addEventListener("input", () => {
    setComment(study.participants[participantIndex], taskIndex, commentsBox.value);
    saveComments();
  });

  prevTaskButton.addEventListener("click", () => {
    taskIndex = Math.max(0, taskIndex - 1);
    render();
  });
  nextTaskButton.addEventListener("click", () => {
    taskIndex = Math.min(study.tasks.length - 1, taskIndex + 1);
    render();
  });

  doneButton.addEventListener("click", () => {
    setCompleted(study.status !== "completed");
  });

  renderDoneButton();
  render();
  renderProcessPanel();
}

// ---------- Start (last, so everything above is defined) ----------

if (!study) {
  showMessage("Study not found. Go back to the home page and open Results from a study card.");
} else if (study.status === "draft") {
  showMessage("A draft has no results yet.");
} else if (study.participants.length === 0) {
  showMessage("No participants yet. Add a participant from the home page.");
} else {
  startResults();
}
