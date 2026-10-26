// Add Participant
// Next: check first name / last name / gender / age are filled, keep them for the consent page, then go to consent.html
// (needs js/data/study-store.js). The study comes from form.dataset.studyId, js/home.js sets it when the popup opens

const form = document.getElementById("add-participant-form");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the normal form submit, we choose where to go

  // the browser checks `required` and the age `pattern` and shows its own message
  if (!form.reportValidity()) {
    return;
  }

  // The person only becomes a participant of the study when he takes the study (consent page)
  savePendingParticipant({
    studyId: Number(form.dataset.studyId) || null,
    firstName: form.elements["first-name"].value.trim(),
    lastName: form.elements["last-name"].value.trim(),
    gender: form.elements["gender"].value,
    age: form.elements["age"].value.trim(),
  });
  window.location.href = "consent.html";
});
