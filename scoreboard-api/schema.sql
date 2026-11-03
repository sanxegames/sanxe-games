-- Salón de la Dimisión · tabla de puntuaciones (Cloudflare D1)
CREATE TABLE IF NOT EXISTS scores (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  game   TEXT    NOT NULL,
  name   TEXT    NOT NULL,   -- 3 iniciales A-Z0-9
  score  INTEGER NOT NULL,
  reason INTEGER,            -- índice en la lista de motivos de salida del juego
  lv     INTEGER,            -- nivel/viaje/etapa (opcional)
  ts     INTEGER NOT NULL,   -- ms epoch
  nonce  TEXT    NOT NULL UNIQUE,
  iph    TEXT                -- hash de IP con sal diaria, solo para limitar abusos (se borra a las 48 h)
);
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores (game, score DESC, ts ASC);
CREATE INDEX IF NOT EXISTS idx_scores_iph ON scores (iph, ts);
