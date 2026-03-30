# Plugin System V2 PRD

## Purpose

This document defines the product requirements for Semestra's next-generation plugin system.

It replaces the previous mental model where plugin-level persistence, built-in shell tabs, and runtime ownership boundaries were partially mixed together.

The goal is to make ownership, storage, inheritance, runtime permissions, and host/plugin responsibilities explicit before implementation begins.

## Product Model

### Core principle

At the product level, there is no standalone persistent "plugin layer".

A plugin remains only:
- a code package
- a registration identity
- a capability bundle that may contribute multiple tab types and multiple widget types

Persistent business ownership belongs to:
- tab types
- widget instances
- host-reserved workspace surfaces

### Reserved host surfaces

`Dashboard` and `Settings` remain host-level reserved tab types.

They:
- are not plugins
- do not appear in the plugin catalog
- do not appear in the add-tab selector
- are not plugin-owned runtime surfaces

## Contribution Model

### Tab types

A single package may contribute multiple tab types.

For each tab type:
- only one instance is allowed per scope
- the tab is the primary interaction surface for that package
- the tab has no instance-level configuration

### Widget types

A single package may contribute multiple widget types.

For each widget type:
- multiple instances are allowed per scope
- each widget instance owns its own instance-level settings
- widget instance settings do not inherit from parent scopes

### Direct communication

There is no direct widget-to-widget communication channel.

Widgets may only interact through host-managed data access rules defined in this document.

## Scope Model

The runtime scopes are:
- `program`
- `semester`
- `course`

There are two course cases:
- assigned course: a course that belongs to a semester
- unassigned course: a course that belongs to a program but not to any semester

## Data Ownership Model

### Product-facing semantics

At the product level:
- tab data is the package's data
- tab settings are the package's settings
- widget instance settings are widget-instance-local only

There is no user-facing standalone plugin-level settings bucket separate from tabs.

### Internal implementation rule

Although the product model is tab-owned, the internal implementation may use a hidden package namespace to organize storage.

This internal namespace:
- must not appear as a separate product concept
- exists only to make multi-tab and tab-plus-widget packages implementable

Product semantics must still behave as if ownership belongs to tab types and widget instances.

## Settings Model

### Tab settings

Tab settings are stored by:
- `tab_type`
- `scope`

Different tab types are fully isolated from one another.

A tab may:
- read and write its own tab type settings
- not read, write, delete, or list settings of other tab types in the same package

### Tab settings inheritance

Inheritance applies only within the same tab type.

Priority is:

```text
course > semester > program
```

Rules:
- a lower scope overrides the same key from a higher scope
- different tab types never merge with one another
- unassigned course settings override program settings directly because no semester layer exists

### Widget instance settings

Widget instance settings:
- belong only to that widget instance
- do not inherit from program, semester, or course
- are not shared with any other widget instance
- are not shared with tabs

## Data Access Model

### Read permissions

All scopes may read both higher-level and lower-level data within the same package boundary.

Examples:
- a course runtime may read semester and program data
- a semester runtime may read program data and data from its child assigned courses
- a program runtime may read semester data and course data

### Write permissions

A runtime may write:
- its own scope
- descendant scopes

A runtime may not write:
- ancestor scopes

Examples:
- program may write program, semester, assigned-course, and unassigned-course data
- semester may write semester and its assigned-course data
- assigned course may write only its own course data
- unassigned course may write only its own course data

### Descendant rules

For write authorization, descendants are defined as:
- `program` descendants: all semesters and all courses in the program
- `semester` descendants: only courses assigned to that semester
- `course` descendants: none

An unassigned course is not a descendant of any semester.

## Tab Data Rules

Tabs are allowed to create, read, update, and delete package data under the runtime access rules above.

Tabs may operate on all tab-owned data buckets within the same package boundary.

Tabs may not operate on settings owned by other tab types.

## Widget Data Rules

Widgets are allowed to:
- create, read, update, and delete their own widget instance settings
- create, read, update, and delete package data under the runtime access rules above

Widgets are not allowed to:
- directly communicate with other widgets
- access settings owned by other tab types unless explicitly routed through their own tab type contract in a future version

## Ordering Model

Tab ordering is host-managed and separated by workspace class.

There are three ordering buckets:
- semester homepage order
- shared order for all courses that belong to the same semester
- per-course order for each unassigned course

Rules:
- a semester has its own tab order
- all assigned courses under the same semester share the same tab order
- each unassigned course stores and uses its own tab order independently

Host-reserved tab types are outside the plugin catalog flow.

They must remain separated from package-contributed tab selection and ordering behavior.

## Availability Model

When a package contribution is unavailable in a scope, the host must handle it explicitly.

The runtime must return structured availability state instead of silently falling back to empty data.

### Required states

Each contribution check must resolve to either:
- `available`
- `unavailable`

When unavailable, the host must also provide a reason code.

### Required reason codes

The host must support these reason codes:
- `not_enabled`
- `not_supported_in_scope`
- `requires_parent_scope`
- `requires_dependency`
- `permission_denied`
- `not_installed`

### Host behavior

When a contribution is unavailable:
- the host renders the unavailable state shell
- the package runtime is not entered
- host APIs that target that contribution return structured unavailable results

Packages do not own unavailable-state policy.

## Navigation API

The host must provide an API that allows a package runtime to request navigation to a target tab type.

### Requirements

- navigation requires user confirmation
- the target is a tab type, not an arbitrary route
- the API is host-scoped to the current workspace
- if the target tab type is unavailable or absent in the current scope, the host shows an explicit unavailable or missing prompt

## Non-Goals

This version does not include:
- cross-package data read APIs
- direct widget-to-widget messaging
- plugin-owned control over host unavailable-state UX
- a standalone product-visible plugin settings layer independent from tab settings

## Acceptance Criteria

The implementation is correct only if all of the following are true:

1. `Dashboard` and `Settings` are host-reserved types and are absent from the plugin catalog and add-tab selector.
2. A package may contribute multiple tab types and multiple widget types.
3. Each tab type is singleton per scope.
4. Each widget type supports multiple instances per scope.
5. Tab settings are isolated by tab type and scope.
6. Tab settings inherit only within the same tab type using `course > semester > program`.
7. Widget instance settings never inherit.
8. All scopes may read both upward and downward within the same package boundary.
9. Writes are limited to self and descendants.
10. Semester homepage order is separate from the shared assigned-course order.
11. All courses inside one semester use the same course-tab order.
12. Every unassigned course uses its own independent tab order.
13. Unavailable contributions resolve through host-managed structured availability state and reason codes.
14. Host-provided jump-to-tab-type requires user confirmation.

