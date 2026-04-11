-- Compliance log table for agent-routing-enforcer
-- This schema is auto-initialized by the wizard if the table doesn't exist.

CREATE TABLE IF NOT EXISTS compliance_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key     TEXT    NOT NULL,
  trigger_type    TEXT    NOT NULL,
  trigger_detail  TEXT,
  decision        TEXT    NOT NULL,
  agent           TEXT,
  violation       INTEGER NOT NULL DEFAULT 0,
  timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_session  ON compliance_log(session_key);
CREATE INDEX IF NOT EXISTS idx_compliance_trigger  ON compliance_log(trigger_type);
CREATE INDEX IF NOT EXISTS idx_compliance_agent    ON compliance_log(agent);
CREATE INDEX IF NOT EXISTS idx_compliance_time     ON compliance_log(timestamp);
