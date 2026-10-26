// Results
// 1. Participant tabs: one tab per participant of the study, clicking a tab switches whose data is shown
// 2. Task navigation: "Task 2 →" shows the next task (and a "← Task 1" back when needed)
// 3. Done: saves the comments and goes back to index.html. Edit Study has no page yet (href="#")
// 4. Viewer: heatmap and scanpath slides, scroll sideways. A <video> when there is a url, else a placeholder
// 5. Comments: one per participant per task. Typing keeps them in memory, Done saves them in localStorage

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

let participantIndex = 0;
let taskIndex = 0;

// ---------- Nothing to show ----------

function showMessage(text) {
  tabsScroller.hidden = true;
  resultsContent.hidden = true;
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

function renderSlide(slide, label, videoUrl) {
  slide.replaceChildren();

  if (videoUrl) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = videoUrl;
    video.setAttribute("aria-label", `${label} video`);
    slide.appendChild(video);
    return;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "video-placeholder";
  const title = document.createElement("strong");
  title.textContent = label;
  const note = document.createElement("span");
  note.textContent = "Video placeholder, no recording yet";
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

// ---------- Page ----------

function render() {
  const participant = study.participants[participantIndex];
  const task = study.tasks[taskIndex];
  const result = participant.results?.[taskIndex];

  taskTitle.textContent = `Task ${taskIndex + 1}:`;
  taskText.textContent = task ? task.text : "This study has no tasks yet.";
  commentsBox.value = getComment(participant, taskIndex);

  renderSlide(document.getElementById("slide-heatmap"), "Heatmap", result?.heatmap);
  renderSlide(document.getElementById("slide-scanpath"), "Scanpath", result?.scanpath);
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

  // Comments: typing keeps the text in memory (switching tab / task keeps it), Done saves it
  commentsBox.addEventListener("input", () => {
    setComment(study.participants[participantIndex], taskIndex, commentsBox.value);
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
    saveComments();
    window.location.href = "index.html";
  });

  render();
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
