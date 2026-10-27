// Where studies live while there is no backend.
// - js/data/studies.js has the sample studies (always there)
// - studies you create or edit are saved in localStorage (this browser only) and win over the samples
// When a real backend comes, replace the bodies of these functions, the pages keep calling the same names.
// Load order in the html: studies.js first, then this file.

const STUDIES_KEY = "uvu-eye-tracking:studies";
const DELETED_KEY = "uvu-eye-tracking:deleted-ids"; // ids of deleted studies (the sample studies live in studies.js, so they are hidden, not removed)
const PENDING_PARTICIPANT_KEY = "uvu-eye-tracking:pending-participant";

function readSavedStudies() {
  try {
    return JSON.parse(localStorage.getItem(STUDIES_KEY)) ?? [];
  } catch (error) {
    return []; // storage blocked or broken: only the sample studies
  }
}

function writeSavedStudies(savedStudies) {
  try {
    localStorage.setItem(STUDIES_KEY, JSON.stringify(savedStudies));
  } catch (error) {
    console.warn("Could not save the studies", error);
  }
}

function readDeletedIds() {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY)) ?? [];
  } catch (error) {
    return [];
  }
}

// every study, newest first (the home page default order)
function getStudies() {
  const saved = readSavedStudies();
  const savedById = new Map(saved.map((study) => [study.id, study]));

  const all = studies.map((study) => savedById.get(study.id) ?? study); // a saved edit replaces its sample
  saved.forEach((study) => {
    if (!studies.some((sample) => sample.id === study.id)) all.push(study); // studies made on the New Study page
  });

  const deleted = readDeletedIds();
  return all.filter((study) => !deleted.includes(study.id)).sort((a, b) => b.createdAt - a.createdAt);
}

function getStudy(id) {
  return getStudies().find((study) => study.id === Number(id));
}

function nextStudyId() {
  // deleted ids count too, so a new study never gets the id of a deleted one (it would stay hidden)
  return Math.max(0, ...getStudies().map((study) => study.id), ...readDeletedIds()) + 1;
}

// insert a new study, or replace the one with the same id
function saveStudy(study) {
  const saved = readSavedStudies().filter((item) => item.id !== study.id);
  saved.push(study);
  writeSavedStudies(saved);
}

// delete a study for good: the saved copy goes away and its id is remembered so a sample study stays hidden
function deleteStudy(id) {
  writeSavedStudies(readSavedStudies().filter((study) => study.id !== id));
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...readDeletedIds(), id]));
  } catch (error) {
    console.warn("Could not delete the study", error);
  }
}

// ---------- Participant on his way from the Add Participant popup to the consent page ----------
// sessionStorage: it only has to survive the page change, it is gone when the tab closes

function savePendingParticipant(participant) {
  try {
    sessionStorage.setItem(PENDING_PARTICIPANT_KEY, JSON.stringify(participant));
  } catch (error) {
    console.warn("Could not keep the participant for the consent page", error);
  }
}

// reads it and removes it, so a refresh of the consent page cannot add the same person twice
function takePendingParticipant() {
  try {
    const stored = sessionStorage.getItem(PENDING_PARTICIPANT_KEY);
    sessionStorage.removeItem(PENDING_PARTICIPANT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

// Take Study on the consent page: the person becomes a participant of the study.
// The first participant moves a draft study to in progress.
function addParticipantToStudy(studyId, info) {
  const study = getStudy(studyId);
  if (!study) return null;

  const participant = {
    id: Math.max(0, ...study.participants.map((item) => item.id)) + 1,
    firstName: info.firstName,
    lastName: info.lastName,
    gender: info.gender,
    age: info.age,
    consentDate: info.consentDate,
    results: study.tasks.map(() => ({ heatmap: null, scanpath: null })), // no recordings yet
    comments: [],
  };

  saveStudy({
    ...study,
    status: study.status === "draft" ? "in-progress" : study.status,
    participants: [...study.participants, participant],
  });
  return participant;
}
