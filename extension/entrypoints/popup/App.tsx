import { useState } from "react";

import "./App.css";

interface Experience {
  title: string;
  company: string;
  duration: string;
}

interface Education {
  school: string;
  degree: string;
  duration: string;
}

interface ProfileData {
  name: string;
  headline: string;
  location: string;
  summary: string;
  linkedinUrl: string;
  experience: Experience[];
  education: Education[];
}

function App() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleScrape = async () => {
    setLoading(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        const response = await browser.tabs.sendMessage(tab.id, {
          action: "scrapeProfile",
        });
        if (response) {
          setProfileData(response);
        } else {
          setErrorMessage(
            "Failed to scrape profile. Make sure you are on a LinkedIn profile page.",
          );
          setStatus("error");
        }
      }
    } catch (error) {
      console.error("Scraping error:", error);
      setErrorMessage("Error communicating with content script. Refresh the page and try again.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profileData || !email) {
      setErrorMessage("Email is required.");
      setStatus("error");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const payload = {
        ...profileData,
        email,
        skills: [], // Optional
        resumeUrl: null, // Optional
      };

      // Assuming API uses TRPC via HTTP POST
      // Adjust endpoint if needed. Typically /api/trpc/candidates.create?batch=1
      // or standard JSON body if using openapi/REST adapter.
      // TRPC standard HTTP uses query params for GET, but body for POST.
      // However, input usually needs to be wrapped in "0" key for batch or "json" for standard.
      // Let's assume standard TRPC over HTTP:
      // POST http://localhost:3001/api/trpc/candidates.create
      // Body: { "0": { json: payload } } if batching, or just { json: payload }?
      // Default TRPC client uses batching.
      // Let's try to mimic TRPC client structure.

      const response = await fetch("http://localhost:3001/api/trpc/candidates.create", {
        body: JSON.stringify({
          json: payload,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      setStatus("success");
      setProfileData(null);
      setEmail("");
    } catch (error: unknown) {
      console.error("Save error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to save candidate.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>LinkedIn Scraper</h1>

      {!profileData ? (
        <button type="button" onClick={handleScrape} disabled={loading}>
          {loading ? "Scraping..." : "Scrape Profile"}
        </button>
      ) : (
        <div className="profile-preview">
          <h2>{profileData.name}</h2>
          <p className="headline">{profileData.headline}</p>
          <p className="location">{profileData.location}</p>

          <div className="form-group">
            <label htmlFor="email">Email (Required)</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              required
            />
          </div>

          <div className="actions">
            <button type="button" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save to Dash TSG"}
            </button>
            <button type="button" className="secondary" onClick={() => setProfileData(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "success" && <p className="success">Candidate saved successfully!</p>}
      {status === "error" && <p className="error">{errorMessage}</p>}
    </div>
  );
}

export default App;
