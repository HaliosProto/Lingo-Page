# Product-owner action checklist

Development can continue only after the exact next milestone is approved. No item below grants deployment, publication, paid use, or secret access.

## Required now

| Action                                                                | Why / when                                             | Exact step                                                                                                                        | Security warning                                                          | Can work continue without it?                   |
| --------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| Approve or revise Milestone 1 scope                                   | Prevents silent expansion after M0                     | Review `ROADMAP.md`, the M1 Beads epic/tasks, risks, and acceptance criteria; authorize the exact milestone                       | Approval does not include providers, deployment, accounts, or publication | No M1 implementation; planning remains possible |
| Decide whether to allow official Spec Kit/uv download                 | Enables pinned CLI integration                         | Approve network access only to verified official distributions, then review the isolated initialization diff                      | Do not install look-alike packages or expose repository content           | Yes; existing spec workflow is functional       |
| Confirm private GitHub visibility if independent evidence is required | Local remote URL does not prove server-side visibility | Check repository Settings -> General/Danger Zone visibility while signed in; report only “private confirmed,” not account details | Do not change visibility or share screenshots containing private metadata | Yes; no GitHub action is needed now             |

## Required later

| Action                                      | Needed for                                  | Exact step at that time                                                                                            | Security warning                                             | Continue without it?         |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------- |
| Branded-Chrome acceptance                   | M1/release evidence                         | Load the ignored local candidate, run the synthetic owner checklist, inspect page/popup/worker console and network | Never test private pages or expose keys/screenshots          | Yes until gate               |
| Real-provider approval/key and terms review | Provider qualification                      | Select one provider, approve a tiny synthetic local smoke test, place key only in ignored backend vars             | Calls transmit text and may cost money; never paste the key  | Yes; mock remains default    |
| Native Persian/Arabic/Hebrew reviewers      | BiDi and quality release gate               | Review the approved synthetic corpus and rubric                                                                    | Use no private content; record disagreement honestly         | Yes until release gate       |
| Figma/design approval                       | Formal visual system/assets                 | Authorize account/file access and approve original design direction                                                | Review asset licenses and avoid proprietary copying          | Yes                          |
| Domain/cloud billing/store accounts         | Production hosting and distribution         | Approve exact account/resource/action separately                                                                   | Least privilege, MFA, recovery, cost caps; no shared secrets | Yes until deployment/release |
| Apple/Google Play and physical devices      | Mobile prototypes/release                   | Approve platform accounts and device test plan                                                                     | Device logs/screenshots may contain personal data            | Yes                          |
| Meeting-platform access                     | Lingo Meet integration                      | Approve platform/scopes and synthetic meeting workspace                                                            | Explicit participant consent; no covert recording            | Yes                          |
| Payment processor                           | Billing milestone                           | Approve provider, data flow, pricing, tax/legal plan                                                               | Never handle raw card data directly                          | Yes                          |
| Legal/privacy review                        | Public policy, trademarks, regulated claims | Review final data flows, terms, name, disclosures, and claims                                                      | No unverified compliance claims                              | Yes until public release     |

## Optional input

Original visual references, brand preferences, pricing hypotheses, desired beta audience, and target languages can improve planning. Provide only assets you own or may use and never include private user data.
