<!-- ⚠️ Once this folder changes, update me. -->

`calendar-core/` exposes a standalone calendar domain API outside the plugin framework.
It owns shared source contracts plus the registry that external modules use to contribute events.
Calendar UI consumes this layer as a read-only extension boundary.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for calendar-core contracts and registry services. |
| index.ts | Public entry | Re-exports standalone Calendar source APIs and shared contracts. |
| registry.ts | Registry service | Stores registered Calendar sources by owner, replaces registrations safely, and exposes a React subscription hook. |
| types.ts | Contract types | Defines Calendar events, source definitions, refresh signals including gradebook assessment updates, and semester-range context shared across Calendar consumers. |
