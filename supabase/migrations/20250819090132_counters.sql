CREATE TABLE counters
(
    id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO counters(id, owner_id) VALUES ('1', 1);

CREATE PUBLICATION powersync FOR TABLE counters;