// Thumbnails of the study cards: a screenshot of the Task 1 website, taken by the Python helper (Chrome in the background).
//
// startThumbnails(onReady) is called by the home page. It looks for studies that have a Task 1 URL but no picture yet and asks
// the helper for them, one at a time. No helper running = nothing happens, the cards keep their placeholder, and the next
// time the home page opens it tries again. onReady(studyId) is called when a picture arrives (the card is updated).
//
// Needs js/bridge-client.js and js/data/study-store.js (getThumbnail, saveThumbnail) loaded before this file.

function startThumbnails(onReady) {
  const failedKey = (study) => `uvu-eye-tracking:thumbnail-failed:${study.id}|${study.tasks[0]?.url}`;
  const hasFailed = (study) => {
    try {
      return sessionStorage.getItem(failedKey(study)) !== null; // do not try a broken page again and again in this tab
    } catch (error) {
      return false;
    }
  };

  const queue = getStudies().filter((study) => study.tasks[0]?.url && !getThumbnail(study) && !hasFailed(study));
  if (queue.length === 0) return;

  let current = null; // the study the helper is working on

  function sendNext() {
    current = queue.shift() ?? null;
    if (!current) return;
    bridge.send("capture_thumbnail", { studyId: current.id, url: current.tasks[0].url });
  }

  bridge.on("ready", sendNext);

  bridge.on("thumbnail_ready", (message) => {
    saveThumbnail(message.studyId, message.url, message.image);
    onReady(message.studyId);
    sendNext();
  });

  bridge.on("thumbnail_failed", (message) => {
    if (message.reason === "busy") return; // a session is running: try again next time
    try {
      if (current) sessionStorage.setItem(failedKey(current), "1");
    } catch (error) {
      // no storage: the page is tried again when it is opened again
    }
    sendNext();
  });

  bridge.connect(); // the helper is not running: the connection closes by itself, nothing else happens
}
