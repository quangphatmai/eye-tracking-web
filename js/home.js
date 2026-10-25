// Home page
// 1. Render one card per study from the data (renderStudyCard(study))
// 2. Filter tabs: show only studies matching the status (done below, uses js/tab-bar.js)
// 3. Search icon: filter by name (later)
// 4. Buttons: Results -> results.html (+ New Study is a link in index.html)
// 5. Add Participant -> opens the popup (done below)

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
