# Change Log

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1]

Initial release.

### Added

- Explorer badges for top-level type declarations in Java, C#, PHP and Swift.
  - Java — `class`, `interface`, `enum`, `record`, `@interface`
  - C# — `class`, `interface`, `struct`, `enum`, `record`
  - PHP — `class`, `interface`, `enum`, `trait`
  - Swift — `class`, `struct`, `protocol`, `enum`, `actor`
- Per-language, per-type badge customization through settings
  (`typeDeco.<language>.<type>`). Badges are limited to 2 characters; an empty
  value hides the badge for that type.
- Regex-based detection that does not depend on any language server, so badges
  appear regardless of whether a language extension is installed or the project
  has finished indexing.
