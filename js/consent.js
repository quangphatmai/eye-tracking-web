// Consent form
// 1. Take Study stays disabled until all 6 initial boxes + name + signature are filled (TODO)
// 2. Date: fill in today's date automatically (done below)
// 3. Take Study: go to the live session page (not built yet) (TODO)

// Date: today's date in the user's local time zone.
// Not toISOString(): that is UTC, so in the evening it can show tomorrow.
const dateInput = document.getElementById("consent-date");
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
dateInput.value = `${yyyy}-${mm}-${dd}`; // date inputs need the YYYY-MM-DD format
