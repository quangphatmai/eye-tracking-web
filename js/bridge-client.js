// Bridge client: how the website talks to the Python helper (bridge_server.py in eye-tracking-integration/bridge)
//
// It is a WebSocket: one connection that stays open, both sides can send at any time (see bridge_server.py for the messages).
// Every message is JSON: {"type": "start_task", "index": 0, ...}
//
// How a page uses it:
//   bridge.on("calibration_progress", (message) => { ...update the screen... });   // listen
//   bridge.on("open", ...) / bridge.on("close", ...)                               // connected / connection gone
//   bridge.connect();                                                              // open the connection
//   bridge.send("start_calibration");                                              // talk to Python
//   bridge.send("start_task", { index: 0, url: "https://...", duration: 60 });
//
// Load order in the html: this file first, then the page's own js.

const BRIDGE_URL = "ws://127.0.0.1:8766"; // this computer, port of bridge_server.py

const bridge = (() => {
  let socket = null;
  const listeners = {}; // { "task_started": [function, function], ... }

  // bridge.on("type", function): run `function` every time a message of that type arrives
  function on(type, callback) {
    (listeners[type] = listeners[type] || []).push(callback);
  }

  function emit(type, data) {
    (listeners[type] || []).forEach((callback) => callback(data));
  }

  function connect() {
    if (socket && socket.readyState <= WebSocket.OPEN) return; // already connecting or connected

    const thisSocket = new WebSocket(BRIDGE_URL);
    socket = thisSocket;

    thisSocket.addEventListener("open", () => emit("open", {}));
    // "close" also fires when the connection never worked (helper not started), so it is the only "gone" event we need
    thisSocket.addEventListener("close", () => {
      if (socket === thisSocket) socket = null;
      emit("close", {});
    });
    thisSocket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        emit(message.type, message);
      } catch (error) {
        console.warn("Bridge sent something that is not JSON", event.data);
      }
    });
  }

  // returns false when there is no connection (nothing was sent)
  function send(type, data = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, ...data }));
    return true;
  }

  return { on, connect, send };
})();
