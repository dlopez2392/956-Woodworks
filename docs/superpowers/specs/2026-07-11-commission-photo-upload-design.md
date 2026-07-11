# Commission Photo Upload — Design Spec

**Date:** 2026-07-11
**Site:** 956woodworks.com (static, Vercel, DC export + runtime scripts)
**Status:** Approved design → ready for implementation plan

## Goal

Let a client attach inspiration photos (room shots, existing furniture, sketches,
reference stains) directly in the commission form, so they arrive with the
inquiry instead of relying on a separate "text me your photos" step. Research on
custom-furniture sites flags in-form photo upload as near-essential for
commission conversion.

## Constraint that shaped the approach

Web3Forms file attachments are a **paid Pro** feature; this site is on the free
plan. Rather than add a recurring fee, photos are uploaded client-side to a
**free image host** and delivered as links in the commission email. Decision
made by the site owner (danlo): free image-host path over paying for Pro.

## Approach

1. Client selects/drops photos in the commission form.
2. Each photo uploads from the browser to a free image host and returns a hosted
   URL.
3. On submit, `form.js` appends those URLs to the commission message (and a
   dedicated `photo_links` field) and sends through Web3Forms exactly as today.

**Host:** ImgBB (primary — single free API key, simplest). Cloudinary unsigned
upload is the fallback if ImgBB has browser cross-origin (CORS) issues; the
front-end is identical either way. The host adapter is a single function so
swapping is a one-place change.

## User experience

- An **optional** upload zone below the message box, styled to match the form:
  gold dashed border, upload glyph, copy *"Drag photos here or tap to add —
  optional."*
- Mobile: the file input uses `accept="image/*"` so tapping offers camera or
  photo library.
- Selected photos render as a row of small **thumbnails**, each with a **×** to
  remove it.
- Uploads run in the **background on selection** (not on submit), with a subtle
  per-thumbnail progress/spinner, so photos are ready by the time the client
  hits Send.
- On Send: `form.js` awaits any in-progress uploads (bounded by a timeout),
  collects the ready URLs, appends them, and submits.

## Limits & validation

- Image types only: jpg, jpeg, png, webp, heic.
- Max **5** photos; ~**10 MB** each.
- Friendly inline messages for wrong type / too big / over the count. Rejected
  files are not added; valid ones still proceed.

## Submission integration

Current payload fields: `access_key, subject, from_name, name, email,
piece_type, budget, message`. Add:

- `photo_links` — newline-joined hosted URLs (empty string if none).
- Also append the links to the end of `message` so they're visible in the email
  regardless of how Web3Forms renders custom fields.

Everything else about the form (validation, success/error feedback, reset,
Call/Text/DM buttons) is unchanged.

## Failure handling

Photos are optional and must never block the inquiry.

- If an individual upload fails, mark that thumbnail with a gentle error and let
  the client remove/retry; the form can still be sent without it.
- If uploads are still pending at Send, show a brief "finishing photo uploads…"
  state, then send with whatever succeeded.
- If the host is unreachable entirely, the client sees a soft note ("couldn't
  attach photos — you can text them instead at 956-292-1696") and the text
  inquiry still goes through.

## Configuration / dependency

- **ImgBB API key** (public upload key) stored as a constant in `form.js`, same
  pattern as the existing Web3Forms `ACCESS_KEY`. Owner provides it via a free
  ~2-minute imgbb.com signup. Build/test proceeds with a placeholder key; the
  feature activates when the real key is dropped in.
- No secrets beyond a public upload key; nothing server-side.

## Survival (DC runtime)

Built into `site/form.js` using the established pattern: injected DOM carries
stable ids, event handlers are delegated to `document`, and a slow maintenance
tick re-injects if a DC re-render ever drops the zone — identical to the budget
dropdown and photo-hint already in `form.js`.

## Out of scope (YAGNI)

- Per-photo captions/notes (kept simple: images only).
- Deleting uploaded images from the host after send (orphans on a free host are
  acceptable).
- Drag-to-reorder thumbnails.
- Uploads on the care pages or anywhere but the commission form.

## Verification plan

- Local: inject renders and survives DC re-render; select/drag/drop adds
  thumbnails; oversize/wrong-type/over-count rejected with messages; background
  upload completes; remove works; submit appends links; Web3Forms receives the
  inquiry with working photo links (end-to-end with a real key).
- Confirm host browser CORS works (else switch to Cloudinary).
- Mobile: camera/library picker opens; layout holds at 390px.
- Regression: existing form fields, validation, and success/reset still work.
- Nothing deploys to production without owner review.
