# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | Planning the configuration model in S02. | architecture | Using Zod provides both runtime validation and TypeScript type inference from a single source of truth, ensuring the AppConfig object is always valid and strongly typed. | Zod for domain model and configuration validation. | Reduces boilerplate, provides clear validation errors, and keeps types in sync with validation logic. | true | agent |
