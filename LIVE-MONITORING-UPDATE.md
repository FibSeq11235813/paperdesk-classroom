# Live Student Monitoring Update

Merged into the user-provided current Paperdesk Classroom 0.7.x build.

## Teacher features
- Live roster in the Class panel.
- Connected / Idle / Disconnected status.
- Current revealed slide for each student.
- Live thumbnails of student slide/ink work.
- Graph-work preview when a student is using the Graph desk.
- Click any student card to inspect a larger live preview.
- Disconnected students stay in the roster with their last known work until the class ends.

## Sync design
- Each browser receives a private per-room student participant token.
- Presence heartbeats reuse the existing HTTP polling architecture.
- Whiteboard work is versioned. The teacher downloads a full board only when its work version changes.
- Slide work syncs as structured annotation data rather than repeated screenshots.
- Graph work uses a compressed JPEG preview because it has a separate rendering model.
- Teacher roster/work endpoints require the teacher token; student updates require the participant token.

## Files changed
- `server.mjs`
- `public/index.html`
- `public/classroom.mjs`
- `public/classroom.css`
- `package.json` (0.7.1)

## Verification
- Existing test suite: 20/20 passing.
- API smoke test: room creation, slide reveal, student registration, authenticated heartbeat, teacher-only roster, board sync, and board retrieval all passed.
