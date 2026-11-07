# Nextstep

A local dashboard for tracking job and internship applications. The top cards summarize the pipeline. The board shows Interested, Applied, Follow Up, In Contact, Interview, and Completed.

## Run locally

Requires Node.js 24 LTS and npm. In this directory, run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Select **New application** to add your first opportunity.

## Track an opportunity

1. Select **New application** or use the plus button in a column.
2. Add the company and position, and set the opportunity type, recruitment status, contact details, and notes.
3. Schedule a follow-up for a specific date or a number of calendar days after the contact date.
4. Open a card to edit its stage, reschedule its reminder, or view its history. Use the checkmark to complete a follow-up.

Follow Up is calculated from the browser's local date. On the due date, a card appears there with its recruitment status visible. Completing the reminder or rescheduling it for a future date returns the card to its recruitment column. Completed applications stay in Completed. The app updates due reminders while the board is open and recalculates them when reopened.

## Storage and architecture

This MVP uses React, TypeScript, Tailwind CSS, and Vite. The browser stores applications and history locally on the app's origin. Data is specific to that browser profile and origin, and clearing site data removes it. Use the same local URL when returning to the app.

The date and status rules live in `src/model.ts`. Browser storage keeps this first release runnable with one process. Spring Boot and PostgreSQL are deferred until shared, cross-device storage is needed.

## Verify

```sh
npm test
npm run build
```
