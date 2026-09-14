# Public source boundary

Admissible is a **pre-existing proprietary runtime/service**. This repository exposes only the reviewed hackathon application, integration clients, judge interface and generic session-access layer. It does not include or license the underlying Admissible implementation.

The application coordinates ordinary invoice work and independent-verification evidence before asking a person for authority. Missing evidence remains agent-system work. **Advance synthetic verification** represents independently gathered evidence arriving in this synthetic demo; it is not the human performing verification. The human decision is requested only after evidence is sufficient and authority is the remaining requirement.

Included implementation files are copies of the reviewed application, with a narrow September 13 presentation follow-up in `judge-surface/public/app.mjs`, `judge-surface/public/components.mjs` and their selected presentation tests: public recorded-proof wording, removal of a redundant recorded-page self-link, and removal of an empty-case refresh control. Workflow, authority, evidence and transport behavior are unchanged. No proprietary runtime code has been redacted, simplified, partially reproduced or reimplemented to make this repository appear self-contained.

| Material class | Disposition |
| --- | --- |
| Hackathon application/integration source | Only the reviewed Strands agent-side workflow, AWS clients, judge interface, generic session-access bridge and selected tests |
| Public documentation and assets | README, judge instructions, source boundary, simple architecture, licensing/notices and file-hash manifest |
| Pre-existing proprietary Admissible implementation | Entirely excluded: its authority evaluation, evidence handling, exact delegation, enforcement and reconciliation implementation |
| Private or secret material | Entirely excluded: demo code, credentials, cookies, private configuration/endpoints, raw provider records, deployment bundles and session data |
| Internal development material | Excluded: operational diagnostics, private staging files, internal evidence reports, generated build outputs and repository history |

The Strands agent calls configured application interfaces. The generic judge bridge accepts backend and session-storage interfaces supplied by its host. These are integration boundaries, not substitutes for the omitted Admissible service. Authority and effect checks remain server-enforced in the hosted demo. Provider-specific deployed configuration and service implementation are not required public-source dependencies; they remain outside this repository.

File hashes are recorded in [`PUBLIC_SOURCE_MANIFEST.json`](PUBLIC_SOURCE_MANIFEST.json). The private development repository and its history are not copied into this public source subset. No credentials, access code or private endpoint configuration are included.

The candidate includes test-only literals such as `AKIDEXAMPLE`, `example-secret-not-real`, `example-session-not-real`, and non-deployed sample hostnames `read.lambda-url.us-west-2.on.aws` / `admin.lambda-url.us-west-2.on.aws`. They are explicit offline fixtures, not credentials or private endpoints. The tests inject their own transport and never contact these hosts.

The complete system is evaluated through the hosted demo. This repository is not a standalone deployment of Admissible and does not provide a replacement implementation of the proprietary service.

## License scope

The included first-party hackathon application source and documentation are licensed under [Apache License 2.0](LICENSE). The license covers only the included work; it grants no rights to the omitted proprietary Admissible runtime/service, private deployment material or other omitted intellectual property. Admissible trademarks are not licensed by inclusion of the application source.

Separately identified third-party material retains its own license. In particular, Manrope remains under SIL Open Font License 1.1, not Apache 2.0. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
