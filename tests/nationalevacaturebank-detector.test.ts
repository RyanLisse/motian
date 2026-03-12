import { describe, expect, it } from "vitest";
import { detectNationaleVacaturebankBlocker } from "../packages/scrapers/src/nationalevacaturebank";

describe("Nationale Vacaturebank blocker detection", () => {
  it("detects the DPG consent gate when HTTP access is redirected", () => {
    const result = detectNationaleVacaturebankBlocker({
      url: "https://myprivacy.dpgmedia.nl/consent?callbackUrl=https%3A%2F%2Fwww.nationalevacaturebank.nl%2Fprivacygate-confirm",
      html: "<html><body><h1>DPG Media Privacy Gate</h1><p>privacygate-confirm</p></body></html>",
      status: 200,
    });

    expect(result.blockerKind).toBe("consent_required");
    expect(result.matchedSignals).toEqual(
      expect.arrayContaining(["host:myprivacy.dpgmedia.nl", "marker:dpg_media_privacy_gate"]),
    );
  });

  it("does not raise a false positive when accessible HTML merely mentions /consent", () => {
    const result = detectNationaleVacaturebankBlocker({
      url: "https://www.nationalevacaturebank.nl/vacatures",
      html: `
        <html>
          <body>
            <main>
              <h1>Vacatures in techniek</h1>
              <a href="/privacy-en-voorwaarden/consent-instellingen">Consent instellingen</a>
              <article>Gewone toegankelijke vacaturelijst</article>
            </main>
          </body>
        </html>
      `,
      status: 200,
    });

    expect(result.blockerKind).toBeNull();
    expect(result.matchedSignals).not.toContain("marker:url_consent");
  });
});
