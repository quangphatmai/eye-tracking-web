// Placeholder data for the static phase. Shape is a suggestion; change as you learn what you need.
// The home page cards (js/home.js) and the results page (js/results.js) both read this list,
// so the "Participants: N" on a card is always the number of participants the results page shows.
//
// Study shape:
//   id, name, siteTested, status ("draft" | "in-progress" | "completed"), teamMembers: ["Dan"],
//   tasks: [{ text, url }]                       <- what New Study saves
//   participants: [{ id, firstName, lastName, gender, age,
//     results:  [{ heatmap, scanpath }],         <- one entry per task, video url or null (no videos yet)
//     comments: ["comment for task 1", ...]      <- optional starting comments, one per task
//   }]
// Comments written on the results page are saved in localStorage by js/results.js and win over these.

const sampleTasks = [
  { text: "Find an item you like, and add it to your cart.", url: "https://www.booking.com" },
  { text: "Search for a stay in Salt Lake City for two adults next weekend.", url: "https://www.booking.com" },
  { text: "Find the page where you can change an existing booking.", url: "https://www.booking.com" },
];

const sampleFirstNames = ["Ethan", "Maya", "Liam", "Sofia", "Noah", "Ava", "Lucas", "Mia", "Owen", "Zoe"];
const sampleLastNames = ["Carter", "Nguyen", "Brooks", "Lopez", "Evans", "Kim", "Reed", "Shah", "Diaz", "Hall"];

// n fake participants, each with an empty result (no video yet) for every task
function makeParticipants(count, taskCount) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    firstName: sampleFirstNames[index % sampleFirstNames.length],
    lastName: sampleLastNames[index % sampleLastNames.length],
    gender: "prefer-not-to-say",
    age: String(20 + index),
    results: Array.from({ length: taskCount }, () => ({ heatmap: null, scanpath: null })),
    comments: [],
  }));
}

const studies = [
  {
    id: 1,
    name: "Booking.com Search Flow",
    siteTested: "booking.com",
    status: "in-progress",
    teamMembers: ["Dan", "Rachel"],
    tasks: sampleTasks,
    participants: makeParticipants(10, sampleTasks.length), // 10 on purpose: the tab bar has to scroll
  },
  {
    id: 2,
    name: "Course Registration",
    siteTested: "uvu.edu",
    status: "draft",
    teamMembers: ["Dan"],
    tasks: sampleTasks.slice(0, 1),
    participants: [],
  },
  {
    id: 3,
    name: "Campus Map Navigation",
    siteTested: "uvu.edu/map",
    status: "draft",
    teamMembers: [],
    tasks: [],
    participants: [],
  },
  {
    id: 4,
    name: "Library Search",
    siteTested: "library.uvu.edu",
    status: "in-progress",
    teamMembers: ["Rachel"],
    tasks: sampleTasks.slice(0, 2),
    participants: [], // in progress but nobody has taken it yet: Results stays disabled
  },
  {
    id: 5,
    name: "Flight Booking",
    siteTested: "booking.com/flights",
    status: "completed",
    teamMembers: ["Dan", "Rachel"],
    tasks: sampleTasks,
    participants: makeParticipants(6, sampleTasks.length),
  },
  {
    id: 6,
    name: "Student Portal Login",
    siteTested: "my.uvu.edu",
    status: "completed",
    teamMembers: ["Dan"],
    tasks: sampleTasks.slice(0, 2),
    participants: makeParticipants(4, 2),
  },
];

// A starting comment so you can see one on the results page (Study 5, Participant 1, Task 1)
studies[4].participants[0].comments[0] =
  "User had a hard time finding the product listings. Once the listings were found, the flow was easy.";
