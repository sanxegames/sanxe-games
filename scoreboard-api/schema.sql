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

-- Contador de visitantes únicos por día (sin cookies): se guarda un hash anónimo por día para no contar dos veces; se borra a los 2 días.
CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h));
CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);

-- Métricas anónimas: solo contadores por día (partidas, finales, compartidos, retos, visitas y orígenes).
CREATE TABLE IF NOT EXISTS ev (day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, k));
