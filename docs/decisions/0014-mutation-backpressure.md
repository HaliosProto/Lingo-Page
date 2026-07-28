# ADR 0014: Bound mutation processing with generation-aware backpressure

- Status: Accepted.
- Date: 2026-07-28

## Context

A debounce alone can retain an unbounded mutation list and can repeatedly rescan obsolete DOM after hydration, infinite scroll, or framework rerenders.

## Decision

Queue unique mutation roots by navigation generation with a maximum backlog of 256. Process at most 48 roots or 8 ms per slice, yield for 16 ms when more work remains, and drop obsolete generations. Explicit scans clear their already-accounted queued mutations. Session end/navigation disconnects the observer and clears timers and queued references.

Compatible root replacement rebinds only a unique source fingerprint, structural fingerprint, and element-role match. Ambiguous replacements remain original. Provider output continues to use text-node assignment only.

## Consequences

Mutation storms are bounded and deduplicated, framework replacement can reuse confident translations, and obsolete roots do not grow without limit. Global change scanning remains intentionally conservative and the 2,500-segment hard ceiling remains.
