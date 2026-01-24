---
name: project
description: Project-specific architecture, maintenance tasks, and unique conventions for SEO.
---

# SEO Project Skill

Ensure your public-facing notes are optimized for search engines and AI. This plugin audits and manages note frontmatter for SEO purposes, specifically targeting users of publishing platforms.

## Core Architecture

- **SEO Auditing**: Logic focused on analyzing note content and frontmatter for SEO best practices.
- **Metadata Management**: automates the injection and maintenance of `description`, `keywords`, and `tags` for export.
- **UI Feedback**: Uses a 14KB `styles.css` to provide visual SEO scores and warning indicators in the editor.

## Project-Specific Conventions

- **AI Optimization**: Includes specific logic for ensuring notes are readable and indexable by LLMs and search bots.
- **Frontmatter Standards**: Maps internal note data to standard meta-tag structures.
- **Responsive Audit**: Designed to provide immediate feedback as the user writes in the editor.

## Key Files

- `src/main.ts`: Main auditing logic and command/view registration.
- `manifest.json`: Plugin registration and id (`seo`).
- `styles.css`: SEO score indicators and auditor UI components.
- `esbuild.config.mjs`: Standard build configuration.

## Maintenance Tasks

- **Search Algorithm Sync**: Periodically audit the "best practices" recommendations against current SEO standards.
- **Frontmatter Mapping**: Ensure injected tags are compatible with popular publishing platforms (e.g., Quartz, Jekyll, Astro).
- **Mobile UX**: Verify that SEO indicators don't clutter the interface on smaller screens.
