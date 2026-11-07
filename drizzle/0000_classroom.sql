CREATE TABLE rooms (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  teacher_hash TEXT NOT NULL,
  owner TEXT NOT NULL
);
CREATE TABLE slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  label TEXT NOT NULL,
  graph TEXT,
  object_key TEXT NOT NULL
);
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  slide INTEGER NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  time INTEGER NOT NULL,
  object_key TEXT NOT NULL
);
CREATE INDEX slides_room ON slides(room);
CREATE INDEX submissions_room ON submissions(room);
CREATE INDEX rooms_owner ON rooms(owner);
