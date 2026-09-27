# Devpost submission — Riffle

- **Live prototype:** https://karan6705.github.io/riffle/
- **Code:** https://github.com/karan6705/riffle
- **Demo video file:** https://github.com/karan6705/riffle/releases/download/v1.0/riffle-demo.mp4 (captions: riffle-demo.srt)
- **Thumbnail:** docs/thumbnail.png

## Tagline
An explainable AI co-pilot for citizen stream science, turning a 5-minute stream check into One Health early warnings and FHIR-ready data.

## Track
**Track 3 — AI-Supported Assessment.** Riffle uses AI responsibly to make citizen stream assessments more reliable without replacing human judgement. It combines validation rules, an explainable plausibility model and on-device photo checks with a human-in-the-loop review workflow.

It also carries that assessment through the full "streams to systems" chain: guided UX (T1), insight dashboards (T2), storytelling (T4), gamification (T5), early warning (T6) and HL7 FHIR R4 export (T7).

## Inspiration
In Coimbra's urban streams, and in cities across Europe, a sewer misconnection or a heatwave bloom can turn a park stream dangerous within hours. Professional monitoring visits a site a few times a year. Citizens walk past every day, but the tools ask them to learn jargon, their data is distrusted, and what they record rarely becomes a warning anyone acts on.

We asked: *what if the app double-checked with you like a friendly ecologist, and your observation told your neighbours whether their kids and dogs could go in the water today?*

## What it does
1. **Guided check (≈5 min).** Place, water, banks, animals, photo, co-pilot. It uses pictures and plain words, a "How to tell" guide for 13 macroinvertebrate groups, a sampling timer, and GPS or map pins.
2. **AI co-pilot.**
   - *Expert rules* catch implausible combinations, such as stoneflies in sewage-smelling water, or a temperature recorded in °F.
   - A *ridge-regression plausibility model* predicts the bug score the stream "should" have from 17 observations, and flags big disagreements. It shows exactly which observations drove its expectation.
   - *On-device colour analysis* checks the water photo against the reported colour.
   - The expectation is revealed only after the citizen records their animals, to avoid anchoring bias.
3. **The human decides.** For each flag, the citizen either goes back and checks (the flag resolves automatically) or confirms with a note. Unresolved records are published as *preliminary* and routed to an **expert review queue**. There, experts see the citizen's note beside the model's evidence, and the page tracks how often flags turn out valid.
4. **One Health reading.** Every check becomes three scores (ecosystem, people, animals) with practical advice: "Avoid skin contact for 48 h", "Keep dogs on the lead: possible cyanobacteria".
5. **Insight.** A city map coloured by health or by 7-day risk, a ranking of pressures ("what is stressing the streams"), trends, and a quarterly heat map of which animal groups are present.
6. **Early warning.** The live Open-Meteo forecast × site vulnerability × latest observations gives sewer-overflow, heat/bloom and flash-flood alerts. They are grouped by day, list the affected sites and give concrete actions, with browser notifications and an offline stress-test scenario.
7. **Engagement that rewards good science.** XP for thorough searches and honest corrections, badges like *Honest Scientist*, weekly challenges, and a leaderboard ranked by trusted checks × data quality.
8. **Interoperability.** Each check exports as a FHIR R4 Bundle: `Location`, `Observation` (miniSASS + taxa components, water and habitat findings, One Health index), `DetectedIssue` (co-pilot flags with the citizen's resolution) and `Provenance` (citizen author, AI verifier, expert attester). A live structural validator checks every bundle, and bulk FHIR and CSV export is available.

## How we built it
- **The domain core is a pure TypeScript library** (`src/core`) covering scoring, the model, co-pilot, photo analysis, One Health, warnings, FHIR and gamification. It has 28 Vitest unit tests: model weight recovery, ecological sanity of the learned weights, every co-pilot rule, the photo classifier, alerting, FHIR validation including broken-reference detection, and storyline tests on the seed data.
- **The frontend** is React 19 + TypeScript 7 + Vite 8 + Tailwind 4, as an offline-capable PWA with hash routing so it deploys as a static site. Maps use Leaflet with OpenStreetMap tiles. The forecast comes from Open-Meteo (keyless) with a graceful offline fallback.
- **The model** is trained in the browser in milliseconds with a closed-form ridge solver (Gaussian elimination). Its training data comes from a documented generative model of expert priors, including independent point-source spills so that sewage signals carry weight of their own.
- **Design:** a "field notebook meets instrument" identity, with warm paper, river ink and one kingfisher-orange accent. It uses the Fraunces, Instrument Sans and JetBrains Mono typefaces, procedurally drawn bug illustrations, and slowly flowing contour lines. It is mobile-first, with keyboard focus states, ARIA roles, reduced-motion support and dark mode.

## Challenges
- **Designing AI that asks rather than decides.** Unusual records are often the most valuable (a brand-new spill), so the co-pilot never rejects anything; it escalates.
- **Explanations that read correctly.** "Algae +0.5" is confusing when there was *no* algae. The contributions now describe what was actually observed ("Little or no algae +0.5").
- **Honest calibration.** The simulator had to be tuned so that clean reference reaches score "natural" and mid-pressure reaches "fair". This was verified by tests.

## Accomplishments
- A complete, working loop from a citizen's first tap to a validated FHIR bundle with provenance.
- Explainability at every layer: rules state their reasons, the model shows its drivers, the hazard formulas are published and there is a model card.
- It runs entirely on the device: no account, no uploads, works offline.

## What we learned
Human-in-the-loop is a UX problem as much as an AI problem. The wording of a flag ("You are the scientist here") decides whether a citizen feels corrected or respected.

## What's next
- Calibrate thresholds and retrain on OneAquaHealth expert-verified records; the review queue already produces labelled data.
- Add a FHIR server sync and a public-health dashboard, plus languages for the partner cities.
- Add image-based insect ID as a suggestion within the same human-in-the-loop flow.

## Built with
react · typescript · vite · tailwindcss · leaflet · openstreetmap · open-meteo · hl7-fhir · zustand · vitest

## Impact
- **Ecosystem:** earlier detection of spills and degradation, plus trend and presence evidence for restoration (the Covões restored reach shows recovery).
- **People:** clear daily "can we touch the water?" guidance, and warnings for sewer overflows after rain.
- **Animals:** alerts for dog owners about cyanobacteria risk, and signs of wildlife losing its food web.
- **Systems:** standards-based data that can flow into research, water utilities and public-health surveillance.
