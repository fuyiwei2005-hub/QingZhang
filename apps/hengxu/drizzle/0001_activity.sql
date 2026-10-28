-- Audit rows are inserted by the same transaction as the business write.
-- Existing records are deliberately not backfilled as invented history.
CREATE TABLE IF NOT EXISTS studio_activity (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 entity TEXT NOT NULL,
 record_id TEXT NOT NULL,
 action TEXT NOT NULL,
 before_json TEXT,
 after_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS studio_activity_user_id_idx ON studio_activity(user_id,id);
CREATE TRIGGER IF NOT EXISTS studio_clients_activity_insert AFTER INSERT ON studio_clients
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'client',NEW.id,'create',NULL,json_object('name',NEW.name,'contact',NEW.contact,'note',NEW.note));
END;
CREATE TRIGGER IF NOT EXISTS studio_clients_activity_update AFTER UPDATE ON studio_clients
WHEN OLD.name IS NOT NEW.name OR OLD.contact IS NOT NEW.contact OR OLD.note IS NOT NEW.note
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'client',NEW.id,'update',json_object('name',OLD.name,'contact',OLD.contact,'note',OLD.note),json_object('name',NEW.name,'contact',NEW.contact,'note',NEW.note));
END;
CREATE TRIGGER IF NOT EXISTS studio_projects_activity_insert AFTER INSERT ON studio_projects
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'project',NEW.id,'create',NULL,json_object('client_id',NEW.client_id,'title',NEW.title,'description',NEW.description,'contract_cents',NEW.contract_cents,'due_date',NEW.due_date,'status',NEW.status));
END;
CREATE TRIGGER IF NOT EXISTS studio_projects_activity_update AFTER UPDATE ON studio_projects
WHEN OLD.client_id IS NOT NEW.client_id OR OLD.title IS NOT NEW.title OR OLD.description IS NOT NEW.description OR OLD.contract_cents IS NOT NEW.contract_cents OR OLD.due_date IS NOT NEW.due_date OR OLD.status IS NOT NEW.status
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'project',NEW.id,'update',json_object('client_id',OLD.client_id,'title',OLD.title,'description',OLD.description,'contract_cents',OLD.contract_cents,'due_date',OLD.due_date,'status',OLD.status),json_object('client_id',NEW.client_id,'title',NEW.title,'description',NEW.description,'contract_cents',NEW.contract_cents,'due_date',NEW.due_date,'status',NEW.status));
END;
CREATE TRIGGER IF NOT EXISTS studio_stages_activity_insert AFTER INSERT ON studio_stages
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'stage',NEW.id,'create',NULL,json_object('project_id',NEW.project_id,'title',NEW.title,'amount_cents',NEW.amount_cents,'due_date',NEW.due_date));
END;
CREATE TRIGGER IF NOT EXISTS studio_stages_activity_update AFTER UPDATE ON studio_stages
WHEN OLD.project_id IS NOT NEW.project_id OR OLD.title IS NOT NEW.title OR OLD.amount_cents IS NOT NEW.amount_cents OR OLD.due_date IS NOT NEW.due_date
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'stage',NEW.id,'update',json_object('project_id',OLD.project_id,'title',OLD.title,'amount_cents',OLD.amount_cents,'due_date',OLD.due_date),json_object('project_id',NEW.project_id,'title',NEW.title,'amount_cents',NEW.amount_cents,'due_date',NEW.due_date));
END;
CREATE TRIGGER IF NOT EXISTS studio_entries_activity_insert AFTER INSERT ON studio_entries
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'entry',NEW.id,'create',NULL,json_object('project_id',NEW.project_id,'stage_id',NEW.stage_id,'type',NEW.type,'amount_cents',NEW.amount_cents,'date',NEW.date,'category',NEW.category,'account',NEW.account,'note',NEW.note,'deleted_at',NEW.deleted_at));
END;
CREATE TRIGGER IF NOT EXISTS studio_entries_activity_update AFTER UPDATE ON studio_entries
WHEN OLD.project_id IS NOT NEW.project_id OR OLD.stage_id IS NOT NEW.stage_id OR OLD.type IS NOT NEW.type OR OLD.amount_cents IS NOT NEW.amount_cents OR OLD.date IS NOT NEW.date OR OLD.category IS NOT NEW.category OR OLD.account IS NOT NEW.account OR OLD.note IS NOT NEW.note OR OLD.deleted_at IS NOT NEW.deleted_at
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'entry',NEW.id,CASE WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'delete' WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 'restore' ELSE 'update' END,json_object('project_id',OLD.project_id,'stage_id',OLD.stage_id,'type',OLD.type,'amount_cents',OLD.amount_cents,'date',OLD.date,'category',OLD.category,'account',OLD.account,'note',OLD.note,'deleted_at',OLD.deleted_at),json_object('project_id',NEW.project_id,'stage_id',NEW.stage_id,'type',NEW.type,'amount_cents',NEW.amount_cents,'date',NEW.date,'category',NEW.category,'account',NEW.account,'note',NEW.note,'deleted_at',NEW.deleted_at));
END;
CREATE TRIGGER IF NOT EXISTS studio_tasks_activity_insert AFTER INSERT ON studio_tasks
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'task',NEW.id,'create',NULL,json_object('project_id',NEW.project_id,'title',NEW.title,'due_date',NEW.due_date,'done',NEW.done));
END;
CREATE TRIGGER IF NOT EXISTS studio_tasks_activity_update AFTER UPDATE ON studio_tasks
WHEN OLD.project_id IS NOT NEW.project_id OR OLD.title IS NOT NEW.title OR OLD.due_date IS NOT NEW.due_date OR OLD.done IS NOT NEW.done
BEGIN
 INSERT INTO studio_activity(user_id,entity,record_id,action,before_json,after_json) VALUES(NEW.user_id,'task',NEW.id,'update',json_object('project_id',OLD.project_id,'title',OLD.title,'due_date',OLD.due_date,'done',OLD.done),json_object('project_id',NEW.project_id,'title',NEW.title,'due_date',NEW.due_date,'done',NEW.done));
END;
