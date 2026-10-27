// Home page. The way of thinking is the React one:
//   state (activeFilter + the studies in the store)  ->  renderStudies()  ->  cards on the page
// Something changes (a tab is clicked, a study is deleted)? Change the state, then call renderStudies() again.
// Nothing here hides or removes single cards by hand.
// 1. Render one card per study (renderStudyCard / renderStudies below)
// 2. Filter tabs: studies.filter(...) keeps the matching studies, the grid is drawn again (uses js/tab-bar.js)
// 3. Search icon: filter by name (later)
// 4. Buttons: Results -> results.html, Edit -> new-study.html?study=ID (+ New Study is a link in index.html)
// 5. Add Participant -> opens the popup (done below)
// 6. Delete -> asks for confirmation in a popup, then removes the study (done below)

const STATUS_LABELS = {
  draft: "Draft",
  "in-progress": "In Progress",
  completed: "Completed",
};

// study names are text, not HTML: escape them before they go into the card markup
function escapeHtml(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span.innerHTML;
}

function renderStudyCard(study) {
  const card = document.createElement("div");
  card.className = `study-card study-card--${study.status}`;
  card.dataset.status = study.status; // used by the filter tabs
  card.dataset.studyId = study.id;

  // Results opens only when someone can be viewed: not for drafts, not for a study with no participants yet
  const hasResults = study.status !== "draft" && study.participants.length > 0;
  const resultsButton = hasResults
    ? `<a href="results.html?study=${study.id}" class="results-btn">Results</a>`
    : `<button type="button" class="results-btn" disabled>Results</button>`;

  // Thumbnail: a screenshot of the Task 1 website. No Task 1 url yet = icon placeholder.
  // TODO: the screenshot itself (see study.thumbnail idea), for now every study with a url shows the sample image
  const thumbnail = study.tasks[0]?.url
    ? `<img src="assets/images/sample_image.png" alt="Study Thumbnail" class="thumbnail-image" />`
    : `<div class="thumbnail-placeholder" role="img" aria-label="No preview yet"></div>`;

  card.innerHTML = `
    <div class="thumbnail-section">
      <span class="status-badge">${STATUS_LABELS[study.status]}</span>
      ${thumbnail}
    </div>

    <div class="study-info">
      <h2 class="study-title">${escapeHtml(study.name)}</h2>
      <p class="participants-count">Participants: ${study.participants.length}</p>
      <p class="site-name">Site: ${escapeHtml(study.siteTested)}</p>
      <button type="button" class="add-participant-btn" aria-haspopup="dialog">Add Participant</button>
      ${resultsButton}
    </div>
    <div class="card-actions">
      <button type="button" class="delete-btn" aria-label="Delete Study">Delete</button>
      <a href="new-study.html?study=${study.id}" class="edit-btn" aria-label="Edit Study">Edit</a>
    </div>
  `;

  return card;
}

const studyGrid = document.getElementById("study-grid");
const noStudiesMessage = document.getElementById("no-studies");

// ---------- State ----------
let activeFilter = "all"; // "all" | "draft" | "in-progress" | "completed"

// ---------- Render: draws the grid from the state ----------
function renderStudies() {
  // filter() gives a new array with only the studies that pass the test
  const visibleStudies = getStudies().filter(
    (study) => activeFilter === "all" || study.status === activeFilter,
  );

  studyGrid.innerHTML = ""; // clear the old cards ...
  visibleStudies.forEach((study) => studyGrid.appendChild(renderStudyCard(study))); // ... draw the new ones

  noStudiesMessage.hidden = visibleStudies.length > 0;
}

renderStudies();

const addParticipantDialog = document.getElementById("add-participant-dialog");
const addParticipantForm = document.getElementById("add-participant-form");

// open the popup from any card's Add Participant button.
// One listener on the grid instead of one per button: the cards are drawn again on every filter click,
// and a listener put on a button would be lost with the old card. Clicks on the new cards still bubble up to the grid.
studyGrid.addEventListener("click", (event) => {
  const addButton = event.target.closest(".add-participant-btn");
  if (!addButton) return;

  // the popup has to know which study the new participant joins
  addParticipantForm.dataset.studyId = addButton.closest(".study-card").dataset.studyId;
  addParticipantDialog.showModal(); // modal: dims the page, traps focus, Esc closes it
});

// X button closes it
addParticipantDialog
  .querySelector(".modal-close")
  .addEventListener("click", () => addParticipantDialog.close());

// click on the dark area outside the panel closes it
addParticipantDialog.addEventListener("click", (event) => {
  if (event.target === addParticipantDialog) {
    addParticipantDialog.close();
  }
});

// start empty every time it opens
addParticipantDialog.addEventListener("close", () => addParticipantForm.reset());

// Filter tabs: a click changes the state, then the grid is drawn again.
// initTabBar (js/tab-bar.js) only takes care of which tab looks active.
initTabBar(document.getElementById("study-filter"), (filter) => {
  activeFilter = filter;
  renderStudies();
});

// Delete: the link only asks, the popup's Delete button does it
const deleteDialog = document.getElementById("delete-study-dialog");
const deleteMessage = document.getElementById("delete-study-message");
let studyToDelete = null; // the card waiting for the answer

studyGrid.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-btn");
  if (!deleteButton) return;

  studyToDelete = deleteButton.closest(".study-card");
  const study = getStudy(studyToDelete.dataset.studyId);
  const count = study.participants.length;

  deleteMessage.textContent =
    `"${study.name}"` +
    (count > 0 ? ` and the results of its ${count} participant${count === 1 ? "" : "s"}` : "") +
    " will be permanently deleted. This cannot be undone.";
  deleteDialog.showModal();
});

document.getElementById("delete-confirm").addEventListener("click", () => {
  deleteStudy(Number(studyToDelete.dataset.studyId)); // change the data ...
  studyToDelete = null;
  deleteDialog.close();
  renderStudies(); // ... and draw again: the card is gone, and "no studies" shows if it was the last one of this tab
});

document.getElementById("delete-cancel").addEventListener("click", () => deleteDialog.close());
deleteDialog.querySelector(".modal-close").addEventListener("click", () => deleteDialog.close());

// click on the dark area outside the panel closes it
deleteDialog.addEventListener("click", (event) => {
  if (event.target === deleteDialog) {
    deleteDialog.close();
  }
});
