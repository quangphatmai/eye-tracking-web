// New Study form
// 1. "+ Add task": append another task block (Task 2, Task 3...)  (done)
// 2. "+ Member": add a team member as a name pill, pills wrap to the next line  (done)
// 3. Save: only the project name is required. A new study is a draft and goes to the top of the home page;
//    when opened as new-study.html?study=ID (Edit on a card) the form is filled in and Save updates that study  (done)
// 4. Back: return to index.html  (it is a normal link in new-study.html)

const studyForm = document.getElementById("study-form");
const memberList = document.getElementById("member-list");
const taskList = document.getElementById("task-list");

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

// A task block: label + textarea, label + url. `task` fills the boxes (edit mode)
function addTaskBlock(task = { text: "", url: "" }) {
  const number = taskList.querySelectorAll(".task-block").length + 1;

  const block = document.createElement("div");
  block.className = "task-block";
  block.innerHTML = `
    <label for="task-${number}">Task ${number}:</label>
    <textarea id="task-${number}" name="task-${number}" class="field-box" placeholder="Write task here..."></textarea>
    <label for="task-${number}-url">Attach URL link below:</label>
    <input type="url" id="task-${number}-url" name="task-${number}-url" class="field-box" placeholder="URL link goes here..." />
  `;
  // values go in as text, never through the html above
  block.querySelector("textarea").value = task.text;
  block.querySelector("input").value = task.url;

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
