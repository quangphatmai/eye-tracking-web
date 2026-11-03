// New Study form
// 1. "+ Add task": append another task block (Task 2, Task 3...)  (done)
// 2. "+ Member": add a team member as a name pill, pills wrap to the next line  (done)
// 3. Save: only the project name is required. A new study is a draft and goes to the top of the home page;
//    when opened as new-study.html?study=ID (Edit on a card) the form is filled in and Save updates that study  (done)
// 4. Back: return to index.html  (it is a normal link in new-study.html)
// 5. Task duration: after a URL is typed, a drop-down appears for the maximum time of that task
//    (30 s steps, 30 s to 3 min, default 1 min). Saved in seconds as task.duration
//    The drop-down is a button + list made here (to match the Figma). A hidden <select> keeps the value

const studyForm = document.getElementById("study-form");
const memberList = document.getElementById("member-list");
const taskList = document.getElementById("task-list");

// Task duration = the maximum time of one task, in seconds
const DEFAULT_DURATION = 60;
const DURATION_STEP = 30;
const MAX_DURATION = 180; // 3 minutes
const durationOptions = Array.from({ length: MAX_DURATION / DURATION_STEP }, (_, index) => (index + 1) * DURATION_STEP);

// 90 -> "1:30"
function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// Edit mode: new-study.html?study=ID
const editingStudy = getStudy(new URLSearchParams(window.location.search).get("study")) ?? null;

// + Member: a name pill appears before the button, type the name and press Enter (or click away)
const addMemberItem = memberList.querySelector(".member-add");
const addMemberButton = document.getElementById("add-member");

function createMemberChip(name) {
  const chip = document.createElement("li");
  chip.className = "member-chip";

  const nameText = document.createElement("span");
  nameText.className = "member-name";
  nameText.textContent = name; // text, not HTML

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "member-remove";
  removeButton.setAttribute("aria-label", `Remove ${name}`);
  removeButton.textContent = "\u00d7"; // ×
  removeButton.addEventListener("click", () => {
    chip.remove();
    addMemberButton.focus();
  });

  chip.append(nameText, removeButton);
  return chip;
}

function startAddingMember() {
  const chip = document.createElement("li");
  chip.className = "member-chip";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "member-input";
  input.placeholder = "Member name";
  input.maxLength = 40;
  input.setAttribute("aria-label", "Team member name");
  chip.appendChild(input);
  memberList.insertBefore(chip, addMemberItem);

  // turns the typed pill into a finished name pill, or throws it away when it is empty / cancelled
  let finished = false;
  function finish(keepName) {
    if (finished) return;
    finished = true;
    const name = input.value.trim();
    chip.remove();
    if (keepName && name) {
      memberList.insertBefore(createMemberChip(name), addMemberItem);
    }
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Enter must not submit the whole form
      finish(true);
      addMemberButton.focus();
    } else if (event.key === "Escape") {
      finish(false);
      addMemberButton.focus();
    }
  });
  input.addEventListener("blur", () => finish(true));
  input.focus();
}

// keep the focus in the name pill when the button is pressed, so the pill is not moved before the click
addMemberButton.addEventListener("mousedown", (event) => event.preventDefault());

addMemberButton.addEventListener("click", () => {
  const typing = memberList.querySelector(".member-input");
  if (typing && !typing.value.trim()) {
    typing.focus(); // an empty pill is already waiting
    return;
  }
  if (typing) typing.blur(); // finishes the name that was typed
  startAddingMember(); // so you can add names one after another
});

// The duration drop-down: a button showing the chosen time, and a list under it.
// The <select> inside stays (hidden) as the place where the value lives, so saving and editing read it as before.
function setupDurationPicker(picker) {
  const select = picker.querySelector("select");
  const button = picker.querySelector(".duration-button");
  const valueText = picker.querySelector(".duration-value");
  const list = picker.querySelector(".duration-list");
  const items = Array.from(list.querySelectorAll("[role='option']"));

  function showValue() {
    valueText.textContent = formatDuration(Number(select.value));
    items.forEach((item) => item.setAttribute("aria-selected", String(item.dataset.value === select.value)));
  }

  function open() {
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    (items.find((item) => item.dataset.value === select.value) ?? items[0]).focus();
  }

  function close(returnFocus) {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }

  function choose(item) {
    select.value = item.dataset.value;
    showValue();
    close(true);
  }

  button.addEventListener("click", () => (list.hidden ? open() : close(false)));
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open();
    }
  });

  list.addEventListener("click", (event) => {
    const item = event.target.closest("[role='option']");
    if (item) choose(item);
  });
  list.addEventListener("keydown", (event) => {
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[Math.min(items.length - 1, index + 1)].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[Math.max(0, index - 1)].focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (index >= 0) choose(items[index]);
    } else if (event.key === "Escape") {
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  });

  picker.showValue = showValue; // called again when the value is set from saved data
  showValue();
}

// a click anywhere else closes an open list
document.addEventListener("click", (event) => {
  document.querySelectorAll(".duration-picker").forEach((picker) => {
    const list = picker.querySelector(".duration-list");
    if (!list.hidden && !picker.contains(event.target)) {
      list.hidden = true;
      picker.querySelector(".duration-button").setAttribute("aria-expanded", "false");
    }
  });
});

// A task block: label + textarea, label + url, duration (shown once there is a url). `task` fills the boxes (edit mode)
function addTaskBlock(task = { text: "", url: "", duration: DEFAULT_DURATION }) {
  const number = taskList.querySelectorAll(".task-block").length + 1;

  const block = document.createElement("div");
  block.className = "task-block";
  block.innerHTML = `
    <label for="task-${number}">Task ${number}:</label>
    <textarea id="task-${number}" name="task-${number}" class="field-box" placeholder="Write task here..."></textarea>
    <label for="task-${number}-url">Attach URL link below:</label>
    <input type="url" id="task-${number}-url" name="task-${number}-url" class="field-box" placeholder="URL link goes here..." />
    <div class="task-duration" hidden>
      <label for="task-${number}-duration-button" id="task-${number}-duration-label">Task duration (maximum time):</label>
      <div class="duration-picker">
        <select id="task-${number}-duration" name="task-${number}-duration" hidden>
          ${durationOptions.map((seconds) => `<option value="${seconds}">${formatDuration(seconds)}</option>`).join("")}
        </select>
        <button type="button" id="task-${number}-duration-button" class="duration-button" aria-haspopup="listbox" aria-expanded="false">
          <svg class="duration-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10L8 12z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
          <span class="duration-value"></span>
        </button>
        <ul class="duration-list" role="listbox" aria-labelledby="task-${number}-duration-label" hidden>
          ${durationOptions.map((seconds) => `<li role="option" tabindex="-1" data-value="${seconds}">${formatDuration(seconds)}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
  // values go in as text, never through the html above
  block.querySelector("textarea").value = task.text;
  const urlInput = block.querySelector("input");
  const durationBox = block.querySelector(".task-duration");
  const durationSelect = block.querySelector("select");
  urlInput.value = task.url;
  // an old task without a duration (or a value that is not in the list) gets the default
  durationSelect.value = String(durationOptions.includes(task.duration) ? task.duration : DEFAULT_DURATION);
  setupDurationPicker(block.querySelector(".duration-picker"));

  // the drop-down shows up once there is a url, and hides again when the url is cleared (the choice is kept)
  function updateDurationVisibility() {
    durationBox.hidden = urlInput.value.trim() === "";
  }
  urlInput.addEventListener("input", updateDurationVisibility);
  updateDurationVisibility();

  taskList.appendChild(block);
  return block;
}

document.getElementById("add-task").addEventListener("click", () => {
  addTaskBlock().querySelector("textarea").focus();
});

// Start: empty form, or the study being edited
if (editingStudy) {
  document.title = "Edit Study | UVU Eye Tracking";
  document.getElementById("page-title").textContent = "Edit Study";
  studyForm.elements["project-name"].value = editingStudy.name;
  editingStudy.teamMembers.forEach((name) => memberList.insertBefore(createMemberChip(name), addMemberItem));
  (editingStudy.tasks.length ? editingStudy.tasks : [undefined]).forEach((task) => addTaskBlock(task));
} else {
  addTaskBlock();
}

// "booking.com" from "https://www.booking.com/flights", shown on the card as the site being tested
function siteName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

// Save: only the project name is required (the browser checks it). Empty tasks are dropped.
studyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!studyForm.reportValidity()) {
    return;
  }

  const tasks = Array.from(taskList.querySelectorAll(".task-block"))
    .map((block) => ({
      text: block.querySelector("textarea").value.trim(),
      url: block.querySelector("input").value.trim(),
      duration: Number(block.querySelector("select").value),
    }))
    .filter((task) => task.text || task.url);

  const details = {
    name: studyForm.elements["project-name"].value.trim(),
    siteTested: siteName(tasks.find((task) => task.url)?.url ?? "") || "Not set yet",
    teamMembers: Array.from(memberList.querySelectorAll(".member-name")).map((name) => name.textContent),
    tasks,
  };

  const study = editingStudy
    ? { ...editingStudy, ...details } // keeps id, status, createdAt and participants
    : { ...details, id: nextStudyId(), status: "draft", createdAt: Date.now(), participants: [] };

  saveStudy(study);
  window.location.href = "index.html"; // a new study is the first card there
});
