# Paperdesk Classroom 0.7 — GitHub + Render

This standalone edition needs Node.js 24 or newer. It has no ChatGPT sign-in
or OpenAI API requirement. All PDF renderer assets are included locally.

## Deploy

1. Extract the ZIP. Put the contents of Paperdesk-Classroom into the root of
   a GitHub repository (package.json and render.yaml should be at its root).
2. In Render, create a Blueprint and connect that repository. The included
   render.yaml configures a Node web service and a 1 GB persistent disk.
   This configuration uses paid Render resources; review the displayed price
   before creating it. It does not modify your existing website.
3. Open the service's Environment settings and retrieve TEACHER_PASSWORD
   (or replace its generated value with your own strong password). Enter
   that password in Paperdesk when starting a class. Students use the join
   code/link and do not need the teacher password.
4. After the service is healthy, add classroom.mathbytyler.com in Render's
   Custom Domains settings and follow its displayed DNS instructions.

Manual service setup instead of Blueprint:
- Runtime: Node 24+
- Build: npm install --omit=dev
- Start: node server.mjs --host 0.0.0.0
- Health check: /api/config
- Persistent disk mounted at /var/data
- PAPERDESK_DATA=/var/data
- TEACHER_PASSWORD=<your strong password>
- Render supplies PORT automatically.

Keep one service instance with this SQLite storage configuration. Back up
/var/data/classroom.sqlite using a SQLite-aware backup before maintenance.
Do not rely on an ephemeral filesystem for classroom storage.
Existing data from the ChatGPT-hosted edition is not included in this ZIP.
Teacher annotations stored in a browser are origin-specific: export any
annotated PDFs you want to keep before switching domains. New rooms start
fresh. The clean-screen window must be opened from the teacher window on
the same site/browser profile.

## Local use

Run npm start (or Start-Classroom.cmd on Windows), then open
http://127.0.0.1:4170/. No npm dependencies need downloading for local use.

## What's changed

- Drawing tools are in a vertical toolbar to the right of the PDF workspace.
- Each drawing tool starts at width 0.5; widths change in 0.1 increments.
- Hold Alt and drag to zoom into a rectangle, then release. Your selected
  drawing tool stays selected. Zoom box in the toolbar offers the same
  function without a keyboard. Fit page resets the view; Escape cancels
  an in-progress zoom rectangle. Tiny selections are ignored; zoom caps at 10x.
- Eraser trims portions of lines, shapes, pen strokes, and highlights.
  Set Width for the eraser brush diameter; increase it to erase larger areas.
  One eraser drag is one undo step. Erasing affects annotations, not the PDF
  page's original printed content. Trimmed shapes become vector fragments.
- Existing Bamboo input lifecycle and stroke stabilization are retained.

## Validation

Run npm test. Automated checks cover input handling, stabilization, partial
erasing, frame geometry, graph parsing, and hosted adapter access controls.
This release was checked with code tests; please test the toolbar, zoom box,
eraser, and physical tablet in your browser before using it for a lesson.
