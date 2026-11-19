-- Key/value store for versioned JSON documents (settings today; more tables arrive with their
-- milestones: applications, workspaces, layouts, ... — see plan.md §17).
CREATE TABLE user_settings (
    key        TEXT    PRIMARY KEY NOT NULL,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;
