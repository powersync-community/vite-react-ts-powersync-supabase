CREATE TABLE counters
(
    id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    stream TEXT NOT NULL
);

INSERT INTO counters(id, owner_id, stream) VALUES ('1', 1, 'test');
INSERT INTO counters(id, owner_id, stream) VALUES ('2', 1, 'test2');
INSERT INTO counters(id, owner_id, stream) VALUES ('3', 1, 'test3');
INSERT INTO counters(id, owner_id, stream) VALUES ('4', 1, 'test4');

CREATE PUBLICATION powersync FOR TABLE counters;