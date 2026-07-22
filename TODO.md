# Bug Fix Plan - COMPLETED

## 1. lib/content.ts ✅

- [x] Add `metadata` field to `ContentItem` interface
- [x] Add `findIncompleteWizardProjects()` function to query projects with wizard data

## 2. hooks/use-new-video-wizard.ts ✅

- [x] Add `channel_id` to `ProjectData` interface
- [x] Add `loadFromDatabase(contentId)` method to hydrate from DB
- [x] Import `getContentById` from content lib
- [x] Save `channel_id` to content_items payload
- [x] Export `loadFromDatabase` from hook return

## 3. components/dashboard/new-video-wizard.tsx ✅

- [x] Fix StepProject: fetch real YouTube connection with `getConnection()`
- [x] Populate channel dropdown from real connected channel (channel_id + channel_title)
- [x] Auto-select connected channel by default
- [x] Use `channel_id` value for Select instead of hardcoded "Main Channel"

## 4. Commit & Push

- [ ] Commit and push changes
