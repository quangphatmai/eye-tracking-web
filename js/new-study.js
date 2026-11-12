// New Study form
// 1. "+ Add task": append another task block (Task 2, Task 3...)  (done)
// 2. "+ Member": add a team member as a name pill, pills wrap to the next line  (done)
// 3. Save: only the project name is required. A new study is a draft and goes to the top of the home page;
//    when opened as new-study.html?study=ID (Edit on a card) the form is filled in and Save updates that study  (done)
// 4. Back: return to index.html  (it is a normal link in new-study.html)
// 1b. "Remove" on a task block asks "Remove Task N?" in a popup, then takes that task away; the tasks after it are renumbered  (done)
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

// The visible numbers ("Task 1:", "Task 2:"...) always follow the order of the blocks, so they are set again whenever a task
// is added or removed
function updateTaskNumbers() {
  taskList.querySelectorAll(".task-block").forEach((block, index) => {
    const number = index + 1;
    block.querySelector(".task-title").textContent = `Task ${number}:`;
    block.querySelector(".task-url-label").textContent = `Attach the URL link for Task ${number}:`;
    block.querySelector(".task-prompt-label").textContent = `Write the prompt for Task ${number}:`;
    block.querySelector(".task-remove").setAttribute("aria-label", `Remove Task ${index + 1}`);
  });
}

// Remove: the button only asks, the popup's Remove button does it
const removeTaskDialog = document.getElementById("remove-task-dialog");
const removeTaskTitle = document.getElementById("remove-task-title");
const removeTaskMessage = document.getElementById("remove-task-message");
let taskToRemove = null; // the block waiting for the answer

function askToRemoveTask(block) {
  const number = Array.from(taskList.querySelectorAll(".task-block")).indexOf(block) + 1;
  taskToRemove = block;
  removeTaskTitle.textContent = `Remove Task ${number}?`;
  removeTaskMessage.textContent = `Task ${number} and its link will be removed from this study. This cannot be undone.`;
  removeTaskDialog.showModal();
}

document.getElementById("remove-task-confirm").addEventListener("click", () => {
  const block = taskToRemove;
  taskToRemove = null;
  removeTaskDialog.close();
  if (!block) return;

  // the focus goes to the task above (or the one below), and to "+ Add task" when no task is left
  const neighbour = block.previousElementSibling ?? block.nextElementSibling;
  block.remove();
  updateTaskNumbers();
  (neighbour?.querySelector("input") ?? document.getElementById("add-task")).focus();
});

document.getElementById("remove-task-cancel").addEventListener("click", () => removeTaskDialog.close());
removeTaskDialog.querySelector(".modal-close").addEventListener("click", () => removeTaskDialog.close());
removeTaskDialog.addEventListener("click", (event) => {
  if (event.target === removeTaskDialog) removeTaskDialog.close(); // a click on the dark area outside the panel
});
removeTaskDialog.addEventListener("close", () => {
  taskToRemove = null;
});

// ids need to stay unique (labels point to them), so they come from a counter and not from the visible number
let taskIdCounter = 0;

// A task block: "Task N:" + Remove, label + url, label + textarea (the prompt), duration (shown once there is a url).
// The labels say which task they belong to ("...for Task 2:") and are renumbered by updateTaskNumbers(). `task` fills the boxes (edit mode)
function addTaskBlock(task = { text: "", url: "", duration: DEFAULT_DURATION }) {
  const uid = ++taskIdCounter;

  const block = document.createElement("div");
  block.className = "task-block";
  block.innerHTML = `
    <div class="task-head">
      <h3 class="task-title"></h3>
      <button type="button" class="task-remove">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        Remove
      </button>
    </div>
    <label for="task-${uid}-url" class="task-url-label"></label>
    <input type="url" id="task-${uid}-url" name="task-${uid}-url" class="field-box" placeholder="URL link goes here..." />
    <label for="task-${uid}" class="task-prompt-label"></label>
    <textarea id="task-${uid}" name="task-${uid}" class="field-box" placeholder="Write task here..."></textarea>
    <div class="task-duration" hidden>
      <label for="task-${uid}-duration-button" id="task-${uid}-duration-label">Task duration (maximum time):</label>
      <div class="duration-picker">
        <select id="task-${uid}-duration" name="task-${uid}-duration" hidden>
          ${durationOptions.map((seconds) => `<option value="${seconds}">${formatDuration(seconds)}</option>`).join("")}
        </select>
        <button type="button" id="task-${uid}-duration-button" class="duration-button" aria-haspopup="listbox" aria-expanded="false">
          <svg class="duration-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10L8 12z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
          <span class="duration-value"></span>
        </button>
        <ul class="duration-list" role="listbox" aria-labelledby="task-${uid}-duration-label" hidden>
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

  block.querySelector(".task-remove").addEventListener("click", () => askToRemoveTask(block));

  taskList.appendChild(block);
  updateTaskNumbers();
  return block;
}

document.getElementById("add-task").addEventListener("click", () => {
  addTaskBlock().querySelector("input").focus(); // the URL box comes first
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
