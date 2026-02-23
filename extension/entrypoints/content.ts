export default defineContentScript({
  main() {
    console.log("Motian LinkedIn Content Script Loaded");

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "scrapeProfile") {
        const profileData = scrapeProfile();
        sendResponse(profileData);
      }
    });
  },
  matches: ["*://*.linkedin.com/*"],
});

function scrapeProfile() {
  const name = getText("h1");
  const headline = getText(".text-body-medium.break-words");
  const location = getText(".text-body-small.inline.t-black--light.break-words");
  const summary = getText("#about ~ .display-flex .inline-show-more-text--is-collapsed");
  const linkedinUrl = window.location.href.split("?")[0]; // strip query params

  const experience = scrapeListSection("#experience");
  const education = scrapeListSection("#education");
  const skills = scrapeSkills();

  return {
    education: education.map((item) => ({
      school: item.primary,
      degree: item.secondary,
      duration: item.meta,
    })),
    experience: experience.map((item) => ({
      title: item.primary,
      company: item.secondary,
      duration: item.meta,
    })),
    headline,
    linkedinUrl,
    location,
    name,
    skills,
    summary,
  };
}

/** Safely extract trimmed text content from a selector. */
function getText(selector: string): string {
  return (document.querySelector(selector) as HTMLElement)?.textContent?.trim() || "";
}

/** Scrape a list section (experience or education) by its anchor ID. */
function scrapeListSection(anchorId: string) {
  const section = document.querySelector(anchorId);
  if (!section) return [];

  // LinkedIn wraps sections in a parent container; the list items are siblings
  const container = section.closest("section") ?? section.parentElement;
  if (!container) return [];

  const items = container.querySelectorAll("li.artdeco-list__item");
  return [...items].map((item) => {
    const spans = item.querySelectorAll("span[aria-hidden='true']");
    return {
      primary: spans[0]?.textContent?.trim() || "",
      secondary: spans[1]?.textContent?.trim() || "",
      meta: spans[2]?.textContent?.trim() || "",
    };
  });
}

/** Scrape skills from the LinkedIn Skills section. */
function scrapeSkills(): string[] {
  const skills: string[] = [];

  // Method 1: Skills section on the profile page
  const skillsSection = document.querySelector("#skills");
  if (skillsSection) {
    const container = skillsSection.closest("section") ?? skillsSection.parentElement;
    if (container) {
      const items = container.querySelectorAll("li.artdeco-list__item");
      for (const item of items) {
        const span = item.querySelector("span[aria-hidden='true']");
        const text = span?.textContent?.trim();
        if (text) skills.push(text);
      }
    }
  }

  // Method 2: Skill badges/pills elsewhere on the page
  if (skills.length === 0) {
    const badges = document.querySelectorAll(
      ".skill-category-entity__name, .pv-skill-category-entity__name-text",
    );
    for (const badge of badges) {
      const text = badge.textContent?.trim();
      if (text) skills.push(text);
    }
  }

  // Deduplicate
  return [...new Set(skills)];
}
