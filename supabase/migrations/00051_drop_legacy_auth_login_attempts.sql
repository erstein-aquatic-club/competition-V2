-- Drop legacy table: auth_login_attempts
-- Not referenced anywhere in the codebase
-- RLS policy blocks all access anyway
DROP TABLE IF EXISTS auth_login_attempts;
