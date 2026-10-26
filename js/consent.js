// Consent form
// 1. Take Study stays disabled until all 6 initial boxes + name + signature are filled (TODO)
// 2. Date: fill in today's date automatically (done below)
// 3. Take Study: the person becomes a participant of the study (draft -> in progress), then go to the live session page (page not built yet, home for now)

// Date: today's date in the user's local time zone.
// Not toISOString(): that is UTC, so in the evening it can show tomorrow.
const dateInput = document.getElementById("consent-date");
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
dateInput.value = `${yyyy}-${mm}-${dd}`; // date inputs need the YYYY-MM-DD format

// Take Study: the person who filled in Add Participant joins the study
const consentForm = document.getElementById("consent-form");

consentForm.addEventListener("submit", (event) => {
  event.preventDefault(); // without this the form fills the url with ?initial-1=...&signature=...

  // the browser checks `required` (6 initials, name, signature) and shows its own message
  if (!consentForm.reportValidity()) {
    return;
  }

  const pending = takePendingParticipant(); // set by the Add Participant popup
  if (pending?.studyId) {
    addParticipantToStudy(pending.studyId, { ...pending, consentDate: dateInput.value });
  } else {
    console.warn("No participant waiting: open this page from Add Participant on a study card");
  }

  // TODO: go to the live session page when it exists
  window.location.href = "index.html";
});
