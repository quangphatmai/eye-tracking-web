// Reusable tab bar (filter bar). Used with the .tab-bar markup from css/components.css
//
//   initTabBar(document.getElementById("study-filter"), (filter) => { ... });
//   initTabBarScroll(document.getElementById("participant-scroller"));   // only if there can be many tabs
//
// - Clicking a tab makes it active (class "is-active" + aria-pressed)
// - onChange gets the tab's data-filter value, e.g. "all", "draft", "in-progress"
// - Works for any page: the home page filters by status, the results page picks a participant
function initTabBar(tabBar, onChange) {
  const tabs = Array.from(tabBar.querySelectorAll(".tab-bar-item"));

  // If the bar scrolls sideways, bring the chosen tab fully into view (only moves the bar, not the page)
  function scrollTabIntoView(tab) {
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < tabBar.scrollLeft) {
      tabBar.scrollTo({ left, behavior: "smooth" });
    } else if (right > tabBar.scrollLeft + tabBar.clientWidth) {
      tabBar.scrollTo({ left: right - tabBar.clientWidth, behavior: "smooth" });
    }
  }

  function selectTab(selectedTab) {
    tabs.forEach((tab) => {
      const isActive = tab === selectedTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-pressed", String(isActive));
    });
    scrollTabIntoView(selectedTab);
    onChange(selectedTab.dataset.filter);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab));
  });
}

// Scrollable version: the tabs scroll sideways and ‹ › buttons appear only when they do not all fit.
// Markup: <div class="tab-bar-scroll"> <button class="tab-bar-arrow tab-bar-arrow--prev">
//         <nav class="tab-bar">...</nav> <button class="tab-bar-arrow tab-bar-arrow--next"> </div>
const TABS_PER_PAGE = 4;

function initTabBarScroll(scroller) {
  const tabBar = scroller.querySelector(".tab-bar");
  const prevButton = scroller.querySelector(".tab-bar-arrow--prev");
  const nextButton = scroller.querySelector(".tab-bar-arrow--next");

  // All tabs get the width of the widest one (its text + padding), the bar is TABS_PER_PAGE tabs wide.
  // Done in JS because the widest label ("Participant 10") is only known once the tabs exist.
  function sizeTabs() {
    const tabs = Array.from(tabBar.querySelectorAll(".tab-bar-item"));
    scroller.style.removeProperty("--tab-width"); // measure the natural widths
    const widest = Math.max(0, ...tabs.map((tab) => tab.offsetWidth));
    scroller.style.setProperty("--tab-width", `${widest}px`);
    scroller.style.setProperty("--tab-count", Math.min(TABS_PER_PAGE, tabs.length));
  }

  function update() {
    const overflows = tabBar.scrollWidth > tabBar.clientWidth + 1;
    scroller.classList.toggle("has-overflow", overflows);
    prevButton.disabled = tabBar.scrollLeft <= 0;
    nextButton.disabled = tabBar.scrollLeft + tabBar.clientWidth >= tabBar.scrollWidth - 1;
  }

  prevButton.addEventListener("click", () => {
    tabBar.scrollBy({ left: -tabBar.clientWidth, behavior: "smooth" }); // one page back
  });
  nextButton.addEventListener("click", () => {
    tabBar.scrollBy({ left: tabBar.clientWidth, behavior: "smooth" }); // one page forward
  });

  tabBar.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  sizeTabs();
  update();
  document.fonts?.ready.then(() => { sizeTabs(); update(); }); // fonts change the text width
}
