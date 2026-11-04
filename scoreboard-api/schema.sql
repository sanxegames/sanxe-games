-- SalÃ³n de la DimisiÃ³n Â· tabla de puntuaciones (Cloudflare D1)
CREATE TABLE IF NOT EXISTS scores (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  game   TEXT    NOT NULL,
  name   TEXT    NOT NULL,   -- 3 iniciales A-Z0-9
  score  INTEGER NOT NULL,
  reason INTEGER,            -- Ã­ndice en la lista de motivos de salida del juego
  lv     INTEGER,            -- nivel/viaje/etapa (opcional)
  ts     INTEGER NOT NULL,   -- ms epoch
  nonce  TEXT    NOT NULL UNIQUE,
  team   TEXT,               -- bancada elegida (izq, cizq, cder, der), opcional
  iph    TEXT                -- hash de IP con sal diaria, solo para limitar abusos (se borra a las 48 h)
);
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores (game, score DESC, ts ASC);
CREATE INDEX IF NOT EXISTS idx_scores_iph ON scores (iph, ts);

-- Contador de visitantes Ãºnicos por dÃ­a (sin cookies): se guarda un hash anÃ³nimo por dÃ­a para no contar dos veces; se borra a los 2 dÃ­as.
CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h));
CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);

-- MÃ©tricas anÃ³nimas: solo contadores por dÃ­a (partidas, finales, compartidos, retos, visitas y orÃ­genes).
CREATE TABLE IF NOT EXISTS ev (day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, k));

-- Mensajes del formulario de contacto (anÃ³nimo; el contacto de respuesta es opcional). Se borran a los 180 dÃ­as y el hash de IP a las 48 h.
CREATE TABLE IF NOT EXISTS contact (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    INTEGER NOT NULL,
  kind  TEXT    NOT NULL,
  msg   TEXT    NOT NULL,
  reply TEXT,
  iph   TEXT
);
CREATE INDEX IF NOT EXISTS idx_contact_iph ON contact (iph, ts);

-- Iniciales bloqueadas por moderaciÃ³n.
CREATE TABLE IF NOT EXISTS blocked (name TEXT PRIMARY KEY);

-- Guerra de bancadas: bancada elegida al guardar la puntuación (izq, cizq, cder, der) y caché de la clasificación.
-- Migración en una base ya creada: ALTER TABLE scores ADD COLUMN team TEXT;
CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, ts INTEGER NOT NULL);
