# TODO - Fix sidebar submenu & Integrations Center (/dashboard/automation/integrations)

- [x] 1. Pastikan route `/dashboard/automation/integrations` ada (file sudah ada).
- [x] 2. Identifikasi masalah: `app/dashboard/automation/integrations/page.tsx` masih UI Scheduled Jobs.
- [ ] 3. Replace `app/dashboard/automation/integrations/page.tsx` jadi "Integrations Center".
- [ ] 4. Implement fitur YouTube yang benar dan real backend:
  - [ ] Connect Channel: redirect via `lib/youtube.getAuthUrl()`
  - [ ] Handle callback via query params (`code/state`), call `lib/youtube.exchangeCode()`
  - [ ] Sync Now via `lib/youtube.triggerFullSync()`
  - [ ] Read connected channel/videos/logs via `lib/youtube.ts`
  - [ ] Disconnect via `lib/youtube.disconnectYouTube()` (jika UI tersedia)
- [ ] 5. Sisanya (Google Account, AI Providers, Storage, Social Media, Automation, Notifications, Developer API, Webhooks) dibuat sebagai UI framework tanpa dummy data.
- [ ] 6. Pastikan TypeScript compile & route render.
