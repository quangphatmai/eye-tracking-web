// Reusable tab bar (filter bar). Used with the .tab-bar markup from css/components.css
//
//   initTabBar(document.getElementById("study-filter"), (filter) => { ... });
//
// - Clicking a tab makes it active (class "is-active" + aria-pressed)
// - onChange gets the tab's data-filter value, e.g. "all", "draft", "in-progress"
// - Works for any page: the results page can use the same bar for other filters
function initTabBar(tabBar, onChange) {
  const tabs = Array.from(tabBar.querySelectorAll(".tab-bar-item"));

  function selectTab(selectedTab) {
    tabs.forEach((tab) => {
      const isActive = tab === selectedTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-pressed", String(isActive));
    });
    onChange(selectedTab.dataset.filter);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab));
  });
}
