# Pre-existing design and third-party notices

## Admissible design and branding

The Admissible name and visual design pre-date this hackathon. The judge interface reuses that design; its application-specific layout and legibility refinements were developed for this project. The provenance comment in `judge-surface/public/theme.css` does not include the original repository/history or claim that the existing design was invented for the hackathon.

The first-party application source follows the root Apache 2.0 license; this does not grant rights to omitted Admissible runtime/service implementation or trademarks. See [`SOURCE_BOUNDARY.md`](SOURCE_BOUNDARY.md).

## Included third-party material: Manrope

- File: `judge-surface/public/manrope-latin.woff2` (Latin variable font used by the judge interface).
- Copyright 2018 The Manrope Project Authors (https://github.com/sharanda/manrope).
- License: **SIL Open Font License, Version 1.1**, preserved in [`judge-surface/public/Manrope-OFL.txt`](judge-surface/public/Manrope-OFL.txt).
- The font and its original notice are unchanged from the reviewed application assets. The font remains under OFL 1.1 and is not relicensed under the root Apache 2.0 license.

This is a pre-existing third-party asset, not newly created hackathon technology. Preserve the font's copyright and license notice when distributing it. The system-font fallbacks named by the CSS are not bundled here.

## Dependencies not bundled in this repository

Strands Agents, the Bedrock AgentCore SDK, boto3 and botocore are external dependencies. Their own licenses and notices apply when installed; their source or installed package trees are not included here. Installation requirements are in [`agent/requirements-agentcore.txt`](agent/requirements-agentcore.txt). Node.js and Python are execution prerequisites, not redistributed binaries in this source repository.

No additional third-party images, icon packs, JavaScript libraries, font binaries or package source trees are bundled in this reviewed subset. The root `LICENSE` contains the unmodified [Apache Software Foundation's Apache 2.0 license text](https://www.apache.org/licenses/LICENSE-2.0.txt).
