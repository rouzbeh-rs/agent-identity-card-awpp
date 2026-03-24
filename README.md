# Agent Identity Card — Browser Extension (Proof of Concept)

## Overview

This browser extension is a proof-of-concept implementation of the **Agent White Paper Protocol (AWPP)**. It demonstrates that a standardized, two-tiered documentation system for autonomous AI agents can be rendered in real web environments without requiring platform-level integration.

The extension acts as a **client-side verifier and renderer**. It does NOT scrape websites, does NOT use an LLM to infer capabilities, and does NOT guess agent attributes. All data comes from pre-authored JSON files created through **manual auditing** of publicly available documentation.

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser Extension (Client-Side)        │
│                                         │
│  ┌─────────────┐   ┌────────────────┐   │
│  │ URL Matcher │──>│ Mock Registry  │   │
│  │ (content.js)│   │ (data/*.json)  │   │
│  └──────┬──────┘   └───────┬────────┘   │
│         │                  │            │
│         v                  v            │
│  ┌─────────────────────────────────┐    │
│  │  Identity Card Renderer         │    │
│  │  (HTML/CSS DOM Injection)       │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

1. **URL Matching**: Content script detects when the user navigates to a known AI agent interface.
2. **Mock Registry Lookup**: Fetches the corresponding pre-authored JSON data model.
3. **Card Rendering**: Dynamically generates and injects the Agent Identity Card into the page DOM.

## Target Agents

| Agent | URL | JSON File |
|-------|-----|-----------|
| Perplexity AI | perplexity.ai | `data/perplexity.json` |
| Claude (Anthropic) | claude.ai | `data/claude.json` |
| ChatGPT (OpenAI) | chatgpt.com | `data/chatgpt.json` |

## Installation (Chrome)

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `agent-identity-extension` folder.
5. Navigate to any of the target agent URLs listed above.
6. Click the blue **ⓘ** button in the bottom-right corner to view the Identity Card.

## JSON Data Model

Each JSON file follows the AWPP Tier 1 schema with six mandatory sections:

- **Identity & Provenance**: Name, version, legal operator, license, DID
- **Purpose & Constraints**: Task description, intended use, out-of-scope use
- **Architecture**: Base model, planning module, memory system, knowledge system
- **Capabilities & Tools**: Enumerated tools and API access
- **Communication & Interoperability**: I/O modalities, protocol support
- **Evaluation & Benchmarks**: Performance records and known limitations

Each file also includes an `_auditMetadata` section documenting the audit process: which fields could not be found, difficulty ratings per section, and methodology notes.

## Customizing for Your Audit

To add a new agent or refine existing data:

1. Copy an existing JSON file in `data/` as a template.
2. Update all fields based on your documentation audit.
3. Fill in the `_auditMetadata` section with your audit findings.
4. Add the new hostname to the `AGENT_REGISTRY` map in `content.js`.
5. Add the URL pattern to `manifest.json` under both `content_scripts.matches` and `web_accessible_resources.matches`.

## Important Notes

- This is a **research prototype**, not a production tool.
- Data is sourced from **public documentation** and has NOT been verified by the agent developers.
- In a fully deployed AWPP ecosystem, developers would author and cryptographically sign their own JSON data models. This extension simulates that by using researcher-authored data.
- The `_auditMetadata.fieldsNotDisclosed` array explicitly tracks which schema fields could not be populated — this transparency gap is itself a key finding of the case study.

## License

This extension is released for academic research purposes under the MIT License.

## Citation

If you use this extension in your research, please cite the Agent White Paper Protocol paper.
