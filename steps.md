# v1.0.14: Scan-with-Phone Product Photos, Payment Error Messages, Header Refresh

Previous round's plan (Excel download / printer / receipt / hardware-ID) is
preserved in git history at this same path.

## Findings being fixed here

1. Adding a product photo required the picture to already be on the POS
   machine — no camera on POS hardware, so this meant transferring a file
   from a phone first. (`frontend/app/pages/products/index.vue`)
2. License/subscription payment failures showed a hardcoded generic
   message ("Payment failed. Please try again.") instead of the real
   reason from the payment provider, because the frontend read
   `error.data.message` while the backend proxies Django's
   `{"error": "..."}` body unchanged. (`frontend/app/composables/useLicense.ts`,
   `frontend/app/components/license/PaywallOverlay.vue`)
3. No way for a cashier to force the app to resync after something changed
   outside its own polling (e.g. a payment confirming on the provider's
   side, license activation landing server-side).
   (`frontend/app/components/AppHeader.vue`)

## Implementation status

- [x] Backend: `POST /api/products/image-session` (protected, desktop-
      initiated), `GET /api/image-session/:token` (public poll),
      `GET /upload/:token` + `POST /upload/:token` (public, phone-facing) —
      new `services/image_upload_session_service.go` (in-memory, 5-minute
      TTL session store) and `handlers/image_upload_handler.go` (LAN IP
      detection via stdlib `net`, self-contained mobile upload page with
      client-side JPEG compression before it ever hits the wire).
- [x] Found and fixed a routing bug while building this: the status-poll
      route was first registered at `/api/products/image-session/:token`,
      which collided with the protected `/api/products` group's route tree
      in Fiber and got auth-gated even though it was registered outside
      that group. Moved it to `/api/image-session/:token` — confirmed via
      live HTTP calls, not just reading the code.
- [x] Frontend: `useProducts.ts` gets `createImageUploadSession` /
      `getImageUploadStatus`; `products/index.vue` shows "Scan with Phone"
      as the default/primary image option (QR code via the new `qrcode`
      dependency), 2s polling drops the result into the existing
      `imagePreview` used by both add and edit flows.
- [x] `useLicense.ts` and `PaywallOverlay.vue` now read
      `error?.data?.error || error?.data?.message || <fallback>`, so the
      real backend/provider error surfaces instead of the generic string.
- [x] `AppHeader.vue`: added a Refresh button (`window.location.reload()`)
      between the theme toggle and the sound toggle.
- [x] Bumped `src-tauri/tauri.conf.json`, `Cargo.toml`, `Cargo.lock` to
      `1.0.14`; pushed `backend` and `frontend` submodules to their own
      remotes, then the parent repo with updated submodule pointers, then
      the `v1.0.14` tag — triggering the `Release Balce Inventory` GitHub
      Actions workflow (Windows/macOS/Linux matrix build) at
      https://github.com/obmsuya/balceinv-desktop/actions/runs/32880786514

## Verification performed

- `cd backend && go build ./... && go vet ./...` — clean.
- `cd frontend && pnpm build` — clean, twice (once for the phone-upload
  feature, once for the header refresh button).
- `cd src-tauri && cargo check` — clean at `v1.0.14`.
- Phone-upload feature exercised end-to-end against the real running app,
  not just built: logged into a fresh trial install, opened Add Product,
  clicked "Scan with Phone", confirmed the QR encodes a real LAN URL
  (`http://192.168.x.x:8080/upload/<token>`), opened that exact URL in a
  second browser tab standing in for the phone, POSTed a real image to the
  live endpoint, and watched the desktop's poll pick it up and populate
  `imagePreview` automatically — the full loop, not just each half in
  isolation.
- Header refresh button clicked in the live app; confirmed via the Nuxt
  DevTools boot banner logging a second time and every bootstrap API call
  (license status, permissions, products, print status) re-firing that
  it's a genuine full reload, not a cosmetic spinner. The cart's Amount
  field surviving the reload is the cart-persistence feature working
  correctly, not evidence the reload didn't happen.
- Payment error message fix verified against real production log output
  (an actual failed AzamPay checkout returning `"Invalid Vendor"`) showing
  the frontend previously discarded that message in favor of the generic
  fallback; the field-name fix (`error?.data?.error`) is a one-line change
  with no other logic branches to verify.

## Manual follow-up required

- Scan-with-phone: this session verified the mechanism with a second
  browser tab standing in for the phone (real LAN IP, real HTTP round
  trip). Nobody has scanned the QR with an actual phone camera yet — worth
  one real run to confirm the OS-level "open this link" prompt behaves as
  expected on both iOS and Android, and that a real camera photo (larger,
  different orientation/EXIF data than the synthetic test image used here)
  compresses and uploads cleanly.
- Scan-with-phone requires the phone and POS machine to be on the same
  Wi-Fi network without AP/client isolation. Worth confirming the shop's
  actual Wi-Fi setup allows this before relying on it as the default —
  if isolation is on, the QR will generate but the phone will fail to
  connect, and there's no in-app detection for that case today.
- The separate `wapangajikiganjani` Django backend (payment/license
  activation server at `backend.wapangaji.com`) has its own bug fixes from
  this same session — the `AzamPayTransaction.user=None` NOT NULL crash,
  the broken callback-forwarding key mismatch, and the Balce SMS
  notification gap. Those are a different repo/deployment, not part of
  this tag, and need their own deploy.
