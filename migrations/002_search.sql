CREATE VIRTUAL TABLE posts_fts USING fts5(
  title,
  body_md,
  content = 'posts',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO posts_fts (rowid, title, body_md) SELECT id, title, body_md FROM posts;

CREATE TRIGGER posts_fts_insert AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts (rowid, title, body_md) VALUES (new.id, new.title, new.body_md);
END;

CREATE TRIGGER posts_fts_delete AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts (posts_fts, rowid, title, body_md)
  VALUES ('delete', old.id, old.title, old.body_md);
END;

CREATE TRIGGER posts_fts_update AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts (posts_fts, rowid, title, body_md)
  VALUES ('delete', old.id, old.title, old.body_md);
  INSERT INTO posts_fts (rowid, title, body_md) VALUES (new.id, new.title, new.body_md);
END;
