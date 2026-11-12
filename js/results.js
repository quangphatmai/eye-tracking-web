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
const participantInfo = document.getElementById("participant-info");
const viewer = document.getElementById("results-viewer");
const viewerSwitchItems = document.querySelectorAll("#viewer-switch .viewer-switch-item");
const taskTitle = document.getElementById("task-title");
const taskText = document.getElementById("task-text");
const commentsBox = document.getElementById("task-comments");
const stampButton = document.getElementById("stamp-btn");
const prevTaskButton = document.getElementById("prev-task");
const nextTaskButton = document.getElementById("next-task");
const doneButton = document.getElementById("done-btn");

let participantIndex = 0;
let taskIndex = 0;

// ---------- Nothing to show ----------

function showMessage(text) {
  tabsScroller.hidden = true;
  participantInfo.hidden = true;
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
    video.addEventListener("error", () => {
      renderSlide(slide, label, null, "The video could not be loaded. Is the helper running?");
      updateStampButton();
    });
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
  updateStampButton();
}

// "Insert video time" works when the slide you look at has a video
function currentVideo() {
  return viewer.querySelectorAll(".result-slide")[currentSlideIndex()]?.querySelector("video") ?? null;
}

function updateStampButton() {
  stampButton.disabled = !currentVideo();
}

// 75 -> "1:15"
function formatVideoTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
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

// ---------- Videos that are not ready ----------

// The videos are made by the helper right after each task (Session page). This is only the safety net: a recording whose
// videos are missing (an old recording, or a task whose videos failed) is made now, by itself, when this page opens and the
// helper is running. Videos that already exist on disk are not made again, so it is quick. There is no button for it.
let processing = false;
let helperReady = false; // the helper said hello ("ready") on the open connection
let pendingStart = null; // the participants to send as soon as the helper says hello

function startProcessing() {
  const list = getParticipantsToProcess(study);
  if (list.length === 0) return;

  pendingStart = {
    studyId: study.id,
    participants: list.map((participant) => ({
      participantId: participant.id,
      sessionId: participant.recording.sessionId,
      tasks: participant.recording.taskCount,
    })),
  };
  processing = true;
  if (helperReady) {
    bridge.send("process_participants", pendingStart);
    pendingStart = null;
  } else {
    bridge.connect(); // no helper running: nothing happens and the page stays as it is (see "close" below)
  }
}

bridge.on("ready", () => {
  helperReady = true;
  if (pendingStart) {
    bridge.send("process_participants", pendingStart);
    pendingStart = null;
  }
});

// each participant is saved as soon as it is done: when the page is closed in the middle, the finished ones stay finished
bridge.on("participant_done", (message) => {
  saveParticipantResults(study.id, message.participantId, message.videos);
  study = getStudy(study.id);
  if (study.participants[participantIndex]?.id === message.participantId) render(); // the one on screen gets its videos
});

bridge.on("processing_done", () => {
  processing = false;
  study = getStudy(study.id);
  render();
});

// an error or a lost helper: the page keeps what it has (the next time it opens it tries again)
bridge.on("error", () => {
  processing = false;
  pendingStart = null;
  render();
});

bridge.on("close", () => {
  helperReady = false;
  pendingStart = null;
  processing = false;
  render();
});

// ---------- Page ----------

// the values of the Gender drop-down (add-participant.html) as they are written on the page
const GENDER_LABELS = {
  male: "Male",
  female: "Female",
  other: "Other",
  "prefer-not-to-say": "Prefer not to say",
};

// "Phat Mai · Male · Age 24": the parts that are missing (old data) are left out
function renderParticipantInfo(participant) {
  const parts = [
    `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim(),
    GENDER_LABELS[participant.gender] ?? participant.gender,
    participant.age ? `Age ${participant.age}` : "",
  ].filter(Boolean);
  participantInfo.textContent = parts.join(" · "); // text, not HTML
  participantInfo.hidden = parts.length === 0;
}

function render() {
  const participant = study.participants[participantIndex];
  const task = study.tasks[taskIndex];
  const result = participant.results?.[taskIndex];

  renderParticipantInfo(participant);
  taskTitle.textContent = `Task ${taskIndex + 1}:`;
  taskText.textContent = task ? task.text : "This study has no tasks yet.";
  commentsBox.value = getComment(participant, taskIndex);

  // recorded but the videos are not made yet: say so, instead of "no recording"
  const notProcessed = participant.recording && participant.recording.status !== "ready";
  const note = notProcessed
    ? processing
      ? "Making the videos... this takes a moment."
      : "Recorded, but the video is not ready. Start the helper (python bridge_server.py --mode tobii) and open this page again."
    : undefined;
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

  // "[0:42] " at the cursor, on its own line: the comment says which moment of the video it is about
  stampButton.addEventListener("click", () => {
    const video = currentVideo();
    if (!video) return;
    const stamp = `[${formatVideoTime(video.currentTime)}] `;
    const start = commentsBox.selectionStart ?? commentsBox.value.length;
    const end = commentsBox.selectionEnd ?? start;
    const before = commentsBox.value.slice(0, start);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    commentsBox.value = before + lead + stamp + commentsBox.value.slice(end);
    const cursor = (before + lead + stamp).length;
    commentsBox.setSelectionRange(cursor, cursor);
    commentsBox.focus();
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
  startProcessing(); // the safety net for missing videos
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
