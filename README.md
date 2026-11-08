# nextstep

A Kanban dashboard for tracking job and internship applications and seeing when it’s time to follow up.

**[Open nextstep](https://mynextstep.pages.dev/)** to start tracking applications in your browser.

## Track an opportunity

1. Select **+** in the column where you want to add the opportunity.
2. Add the company, position, opportunity type, and any relevant location, contact details, or notes.
3. Choose a follow-up date or select **No reminder**. The date defaults to seven calendar days from today.
4. Open a card to edit its details or view its history. Use **Mark done** to record a follow-up, or **Schedule another follow-up** to record it and set the next reminder.

Use **+** in **Interested** to save an opportunity before applying. Enter the company, position, and opportunity type, with optional location, application deadline, posting and recruiter details, and notes.

Drag a card into a recruitment column to change its stage. Dropping it into **Interview** opens the form with its saved application details and fields for the interview date, time, location or meeting link, and notes. Save to apply the change. Use **+** in **Interview** to add an opportunity at that stage.

The dashboard calendar shows follow-ups and interviews for today and the next six days. Select **Open calendar** to browse by month, or select an event to open its application.

Follow-up is calculated from the browser's local date. On the due date, a card appears in **Follow-up**. After a follow-up is recorded, the card returns to its recruitment column and shows how many follow-ups have been recorded. Closed applications stay in **Completed**.

## Browser storage

nextstep saves applications, reminders, and history in the browser. Your board stays with the browser profile and site address where you created it. Clearing site data removes your board, and entries from localhost don’t carry over to the live site.

## Local development

nextstep uses React, TypeScript, Tailwind CSS, and Vite. To run it locally, use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The date and status rules live in `src/model.ts`.

## Verify

```sh
npm test
npm run build
```

## Supabase setup

1. Install the client with `npm install @supabase/supabase-js` if it is missing from the project dependencies.
2. In the Supabase SQL Editor, run [the applications migration](supabase/001_applications.sql). It creates the table and limits access to the account that owns each application.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and restart Vite. In Supabase Auth URL Configuration, allow your local app URL (typically `http://localhost:5173`) as a redirect URL.
4. Test sign-up and sign-in locally. Save an application and open it in a second browser with the same account. Then sign in with another account and verify that it cannot see the first account’s applications.
5. To enable accounts on Cloudflare Pages, set the same two build environment variables, set the Supabase Auth Site URL to the live site, allow it as a redirect URL, and redeploy.

Choose **Continue as guest** on the sign-in screen to use a board saved in this browser. Existing browser entries are available in guest mode. Guest and account boards are separate. Without Supabase configuration, nextstep opens directly in browser storage mode.
