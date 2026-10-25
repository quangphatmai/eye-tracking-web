// Home page
// 1. Render one card per study from js/data/studies.js (done below, renderStudyCard)
// 2. Filter tabs: show only studies matching the status (done below, uses js/tab-bar.js)
// 3. Search icon: filter by name (later)
// 4. Buttons: Results -> results.html (+ New Study is a link in index.html)
// 5. Add Participant -> opens the popup (done below)

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

  card.innerHTML = `
    <div class="thumbnail-section">
      <span class="status-badge">${STATUS_LABELS[study.status]}</span>
      <img src="assets/images/sample_image.png" alt="Study Thumbnail" class="thumbnail-image" />
    </div>

    <div class="study-info">
      <h2 class="study-title">${escapeHtml(study.name)}</h2>
      <p class="participants-count">Participants: ${study.participants.length}</p>
      <p class="site-name">Site: ${escapeHtml(study.siteTested)}</p>
      <button type="button" class="add-participant-btn" aria-haspopup="dialog">Add Participant</button>
      ${resultsButton}
    </div>
    <div class="card-actions">
      <button class="delete-btn" aria-label="Delete Study">Delete</button>
      <button class="edit-btn" aria-label="Edit Study">Edit</button>
    </div>
  `;

  return card;
}

const studyGrid = document.getElementById("study-grid");
studies.forEach((study) => studyGrid.appendChild(renderStudyCard(study)));

const addParticipantDialog = document.getElementById("add-participant-dialog");
const addParticipantForm = document.getElementById("add-participant-form");

// open the popup from any card's Add Participant button
document.querySelectorAll(".add-participant-btn").forEach((button) => {
  button.addEventListener("click", () => {
    addParticipantDialog.showModal(); // modal: dims the page, traps focus, Esc closes it
  });
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

// Filter tabs: show only the cards whose data-status matches the tab (the "all" tab shows every card)
const studyCards = document.querySelectorAll("#study-grid .study-card");
const noStudiesMessage = document.getElementById("no-studies");

initTabBar(document.getElementById("study-filter"), (filter) => {
  let visibleCount = 0;

  studyCards.forEach((card) => {
    const matches = filter === "all" || card.dataset.status === filter;
    card.hidden = !matches;
    if (matches) visibleCount++;
  });

  noStudiesMessage.hidden = visibleCount > 0;
});
