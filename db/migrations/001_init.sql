-- 001_init.sql — Newfoot baseline schema.
-- Anonymous, session-scoped POC (no auth). Later features add columns/tables
-- via NEW numbered migration files — never edit an applied migration.

CREATE TABLE IF NOT EXISTS sessions (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,   -- client-generated session id
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_agent    VARCHAR(512) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per captured view (front/side/back) analysis.
CREATE TABLE IF NOT EXISTS analyses (
  id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(64)  NOT NULL,
  view        ENUM('front','side','back') NOT NULL,
  metrics     JSON         NULL,   -- computed angles per metric
  findings    JSON         NULL,   -- flagged deficiencies + severity
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_analyses_session (session_id),
  CONSTRAINT fk_analyses_session FOREIGN KEY (session_id)
    REFERENCES sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per generated insole recommendation (holds both sides).
CREATE TABLE IF NOT EXISTS insole_recommendations (
  id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id    VARCHAR(64)  NOT NULL,
  foot_size_eu  DECIMAL(4,1) NULL,
  foot_size_us  DECIMAL(4,1) NULL,
  params_left   JSON         NULL,   -- insole parameter object, left
  params_right  JSON         NULL,   -- insole parameter object, right
  material      VARCHAR(32)  NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reco_session (session_id),
  CONSTRAINT fk_reco_session FOREIGN KEY (session_id)
    REFERENCES sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
