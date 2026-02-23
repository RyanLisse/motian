import { useEffect, useState } from "react";

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
  skills: string[];
}

const DEFAULT_API_URL = "http://localhost:3001";

function App() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);

  useEffect(() => {
    browser.storage.local.get("motianApiUrl").then((result) => {
      if (result.motianApiUrl) {
        setApiUrl(result.motianApiUrl as string);
      }
    });
  }, []);

  const handleSaveSettings = async () => {
    const url = apiUrl.replace(/\/+$/, ""); // strip trailing slashes
    await browser.storage.local.set({ motianApiUrl: url });
    setApiUrl(url);
    setShowSettings(false);
  };

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
            "Profiel kon niet worden gescraped. Zorg dat je op een LinkedIn profiel pagina bent.",
          );
          setStatus("error");
        }
      }
    } catch (error) {
      console.error("Scraping error:", error);
      setErrorMessage(
        "Fout bij communicatie met content script. Herlaad de pagina en probeer opnieuw.",
      );
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profileData) return;

    setLoading(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const payload = {
        name: profileData.name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        headline: profileData.headline.trim() || undefined,
        location: profileData.location.trim() || undefined,
        skills: profileData.skills.length > 0 ? profileData.skills : undefined,
        experience: profileData.experience.length > 0 ? profileData.experience : undefined,
        education: profileData.education.length > 0 ? profileData.education : undefined,
        linkedinUrl: profileData.linkedinUrl,
        source: "linkedin",
      };

      const response = await fetch(`${apiUrl}/api/kandidaten`, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API fout: ${response.status} — ${errorBody}`);
      }

      setStatus("success");
      setProfileData(null);
      setEmail("");
      setPhone("");
    } catch (error: unknown) {
      console.error("Save error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Opslaan mislukt.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  if (showSettings) {
    return (
      <div className="container">
        <div className="header">
          <h1>Instellingen</h1>
          <button type="button" className="icon-btn" onClick={() => setShowSettings(false)}>
            ✕
          </button>
        </div>
        <div className="form-group">
          <label htmlFor="apiUrl">API Base URL</label>
          <input
            id="apiUrl"
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder={DEFAULT_API_URL}
          />
        </div>
        <button type="button" onClick={handleSaveSettings}>
          Opslaan
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Motian LinkedIn Importer</h1>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowSettings(true)}
          title="Instellingen"
        >
          ⚙
        </button>
      </div>

      {!profileData ? (
        <button type="button" onClick={handleScrape} disabled={loading}>
          {loading ? "Scrapen..." : "Profiel scrapen"}
        </button>
      ) : (
        <div className="profile-preview">
          <h2>{profileData.name}</h2>
          <p className="headline">{profileData.headline}</p>
          <p className="location">{profileData.location}</p>

          {profileData.skills.length > 0 && (
            <div className="skills-preview">
              {profileData.skills.slice(0, 6).map((skill) => (
                <span key={skill} className="skill-tag">
                  {skill}
                </span>
              ))}
              {profileData.skills.length > 6 && (
                <span className="skill-tag muted">+{profileData.skills.length - 6}</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">E-mail (optioneel)</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kandidaat@voorbeeld.nl"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefoon (optioneel)</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+31 6 12345678"
            />
          </div>

          <div className="actions">
            <button type="button" onClick={handleSave} disabled={loading}>
              {loading ? "Opslaan..." : "Opslaan in Motian"}
            </button>
            <button type="button" className="secondary" onClick={() => setProfileData(null)}>
              Annuleren
            </button>
          </div>
        </div>
      )}

      {status === "success" && <p className="success">Kandidaat succesvol opgeslagen!</p>}
      {status === "error" && <p className="error">{errorMessage}</p>}
    </div>
  );
}

export default App;
