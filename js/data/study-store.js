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
  removeThumbnail(id);
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

// A session ended: the raw recordings are saved on the lab computer, the videos are not made yet.
// The participant gets  recording: { sessionId, taskCount, status: "recorded" }  (the helper finds the folder from sessionId).
// Making the videos is heavy, so it happens later (Results page, "Process videos"), when nobody is being recorded.
function saveParticipantRecording(studyId, participantId, sessionId, taskCount) {
  updateParticipant(studyId, participantId, (participant) => ({
    ...participant,
    recording: { sessionId, taskCount, status: "recorded" },
  }));
}

// The helper made the videos of one participant: [{ task, heatmap, scanpath }] (video url or null).
// They become the participant's results, which the Results page shows, and the recording is "ready".
function saveParticipantResults(studyId, participantId, videos) {
  const study = getStudy(studyId);
  if (!study) return;

  updateParticipant(studyId, participantId, (participant) => {
    const results = study.tasks.map((_, index) => {
      const video = videos.find((item) => item.task === index);
      return { heatmap: video?.heatmap ?? null, scanpath: video?.scanpath ?? null };
    });
    const recording = participant.recording ? { ...participant.recording, status: "ready" } : participant.recording;
    return { ...participant, results, recording };
  });
}

// The helper made the videos of ONE task right after it (the review on the Session page): keep their urls as the result of
// that task, so the Results page shows them without "Process videos".
function saveTaskVideos(studyId, participantId, taskIndex, heatmap, scanpath) {
  updateParticipant(studyId, participantId, (participant) => {
    const results = [...(participant.results ?? [])];
    results[taskIndex] = { heatmap, scanpath };
    return { ...participant, results };
  });
}

// The session is over and every recorded task has its videos: the recording is "ready" (nothing left to process)
function markRecordingReady(studyId, participantId) {
  updateParticipant(studyId, participantId, (participant) =>
    participant.recording ? { ...participant, recording: { ...participant.recording, status: "ready" } } : participant,
  );
}

// the participants of a study whose videos still have to be made (they have a recording that is not "ready")
function getParticipantsToProcess(study) {
  return study.participants.filter((participant) => participant.recording && participant.recording.status !== "ready");
}

function updateParticipant(studyId, participantId, change) {
  const study = getStudy(studyId);
  if (!study) return;
  saveStudy({
    ...study,
    participants: study.participants.map((participant) => (participant.id === participantId ? change(participant) : participant)),
  });
}

// The comment of one participant for one task (text). The observer writes it on the Session page (after the task, while
// watching the videos with the participant) and on the Results page: it is the same text in both places.
// Saved in localStorage as { [participantId]: { [taskIndex]: "text" } }, the same format results.js uses.
const TASK_COMMENTS_KEY_PREFIX = "uvu-eye-tracking:comments:"; // + study id

function readTaskComments(studyId) {
  try {
    const stored = localStorage.getItem(TASK_COMMENTS_KEY_PREFIX + studyId);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {}; // storage blocked or broken
  }
}

function getTaskComment(study, participant, taskIndex) {
  const saved = readTaskComments(study.id)[participant.id]?.[taskIndex];
  if (saved !== undefined) return saved;
  return participant.comments?.[taskIndex] ?? "";
}

function setTaskComment(studyId, participantId, taskIndex, text) {
  const all = readTaskComments(studyId);
  all[participantId] = all[participantId] || {};
  all[participantId][taskIndex] = text;
  try {
    localStorage.setItem(TASK_COMMENTS_KEY_PREFIX + studyId, JSON.stringify(all));
  } catch (error) {
    console.warn("Could not save the comment", error);
  }
}

// ---------- Thumbnails (the picture of a study card) ----------
// A screenshot of the first website of the study (the URL of Task 1), taken by the helper (see js/thumbnails.js).
// Kept apart from the studies: { [studyId]: { url, image } } with image = "data:image/jpeg;base64,...".
// It belongs to the URL it was taken from: when Task 1 gets another URL, the old picture is not used any more.
const THUMBNAILS_KEY = "uvu-eye-tracking:thumbnails";

function readThumbnails() {
  try {
    return JSON.parse(localStorage.getItem(THUMBNAILS_KEY)) ?? {};
  } catch (error) {
    return {};
  }
}

function writeThumbnails(thumbnails) {
  try {
    localStorage.setItem(THUMBNAILS_KEY, JSON.stringify(thumbnails));
  } catch (error) {
    console.warn("Could not save the thumbnail", error); // storage full: the card shows the placeholder
  }
}

// the picture of this study, or null (none yet, or it is of another URL)
function getThumbnail(study) {
  const saved = readThumbnails()[study.id];
  const url = study.tasks[0]?.url;
  return saved && url && saved.url === url ? saved.image : null;
}

function saveThumbnail(studyId, url, image) {
  writeThumbnails({ ...readThumbnails(), [studyId]: { url, image } });
}

function removeThumbnail(studyId) {
  const thumbnails = readThumbnails();
  delete thumbnails[studyId];
  writeThumbnails(thumbnails);
}
