// Add Participant
// Next: check first name / last name / gender / age are filled, then go to consent.html

const form = document.getElementById("add-participant-form");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the normal form submit, we choose where to go

  // the browser checks `required` and the age `pattern` and shows its own message
  if (!form.reportValidity()) {
    return;
  }

  // TODO: save the participant (name, gender, age) before leaving, the consent page / session needs it
  window.location.href = "consent.html";
});
