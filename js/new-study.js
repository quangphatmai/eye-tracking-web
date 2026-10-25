// New Study form
// 1. "+ Add task": append another task block (Task 2, Task 3...)  (done)
// 2. "+ Member": add a team member row with a name input          (done)
// 3. Save: collect form values into an object and log it (no storage yet)  (done)
// 4. Back: return to index.html  (it is a normal link in new-study.html)

const studyForm = document.getElementById("study-form");
const memberList = document.getElementById("member-list");
const taskList = document.getElementById("task-list");

// + Member: a new row with a name input and a remove button
document.getElementById("add-member").addEventListener("click", () => {
  const item = document.createElement("li");

  const input = document.createElement("input");
  input.type = "text";
  input.name = "member";
  input.className = "field-box";
  input.placeholder = "Member name";
  input.setAttribute("aria-label", "Team member name");

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "member-remove";
  removeButton.setAttribute("aria-label", "Remove team member");
  removeButton.textContent = "×"; // ×
  removeButton.addEventListener("click", () => item.remove());

  item.append(input, removeButton);
  memberList.appendChild(item);
  input.focus();
});

// + Add task: copies the structure of Task 1 with new numbers in the ids
document.getElementById("add-task").addEventListener("click", () => {
  const number = taskList.querySelectorAll(".task-block").length + 1;

  const block = document.createElement("div");
  block.className = "task-block";
  block.innerHTML = `
    <label for="task-${number}">Task ${number}:</label>
    <textarea id="task-${number}" name="task-${number}" class="field-box" placeholder="Write task here..."></textarea>
    <label for="task-${number}-url">Attach URL link below:</label>
    <input type="url" id="task-${number}-url" name="task-${number}-url" class="field-box" placeholder="URL link goes here..." />
  `;

  taskList.appendChild(block);
  block.querySelector("textarea").focus();
});

// Save: build one study object from the form and log it
studyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!studyForm.reportValidity()) {
    return;
  }

  const study = {
    name: studyForm.elements["project-name"].value.trim(),
    teamMembers: Array.from(memberList.querySelectorAll("input"))
      .map((input) => input.value.trim())
      .filter(Boolean),
    tasks: Array.from(taskList.querySelectorAll(".task-block")).map((block) => ({
      text: block.querySelector("textarea").value.trim(),
      url: block.querySelector("input").value.trim(),
    })),
  };

  console.log("New study:", study);
  // TODO: save the study (js/data/studies.js shape), then go back to index.html
});
