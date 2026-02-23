// import { defineContentScript } from "wxt/sandbox"; // Auto-imported
export default defineContentScript({
  main() {
    console.log("LinkedIn Content Script Loaded");

    // Listen for messages from the popup
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
  const name = (document.querySelector("h1") as HTMLElement)?.textContent || "";
  const headline =
    (document.querySelector(".text-body-medium.break-words") as HTMLElement)?.textContent || "";
  const location =
    (document.querySelector(".text-body-small.inline.t-black--light.break-words") as HTMLElement)
      ?.textContent || "";
  const summary =
    (
      document.querySelector(
        "#about ~ .display-flex .inline-show-more-text--is-collapsed",
      ) as HTMLElement
    )?.textContent || "";
  const linkedinUrl = window.location.href;

  // Basic experience scraping (needs refine based on actual DOM structure which might vary)
  const experienceSection = document.querySelector("#experience");
  const experienceItems =
    experienceSection?.parentElement?.querySelectorAll("li.artdeco-list__item");
  const experience = [...(experienceItems || [])].map((item) => ({
    company:
      (item.querySelector(".t-14.t-normal span[aria-hidden='true']") as HTMLElement)?.textContent ||
      "",
    duration:
      (item.querySelector(".t-14.t-black--light.t-normal span[aria-hidden='true']") as HTMLElement)
        ?.textContent || "",
    title:
      (
        item.querySelector(
          ".display-flex.align-items-center span[aria-hidden='true']",
        ) as HTMLElement
      )?.textContent || "",
  }));

  // Basic education scraping
  const educationSection = document.querySelector("#education");
  const educationItems = educationSection?.parentElement?.querySelectorAll("li.artdeco-list__item");
  const education = [...(educationItems || [])].map((item) => ({
    degree:
      (item.querySelector(".t-14.t-normal span[aria-hidden='true']") as HTMLElement)?.textContent ||
      "",
    duration:
      (item.querySelector(".t-14.t-black--light.t-normal span[aria-hidden='true']") as HTMLElement)
        ?.textContent || "",
    school:
      (
        item.querySelector(
          ".display-flex.align-items-center span[aria-hidden='true']",
        ) as HTMLElement
      )?.textContent || "",
  }));

  return {
    education,
    experience,
    headline,
    linkedinUrl,
    location,
    name,
    summary,
  };
}
