CREATE TABLE IF NOT EXISTS "PLAYERS" (
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
 "name" TEXT NOT NULL check(typeof("name") = "text"),
 "steamid" TEXT NOT NULL UNIQUE check(typeof("steamid") = "text"),
 "class_id" INTEGER NOT NULL DEFAULT (0),
 "team_id" INTEGER DEFAULT (0)
)

CREATE TABLE IF NOT EXISTS "TEAMS" (
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 "soldier_id" INTEGER,
 "medic_id" INTEGER,
 "name" TEXT,

 FOREIGN KEY (soldier_id) REFERENCES PLAYERS(id),
 FOREIGN KEY (medic_id) REFERENCES PLAYERS(id)
)

CREATE TABLE IF NOT EXISTS "MATCHES" (
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 "team1_id" INTEGER,
 "team2_id" INTEGER,
 "round" INTEGER,
 "server_ip" TEXT,
 "server_port" INTEGER,
 "team1_score" INTEGER,
 "team2_score" INTEGER,

 FOREIGN KEY (team1_id) REFERENCES PLAYERS(id),
 FOREIGN KEY (team2_id) REFERENCES PLAYERS(id)
)

CREATE TABLE IF NOT EXISTS "MATCH_COMMS" (
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 "match_id" INTEGER,
 "message" TEXT,
 "post_date" INTEGER,
 "author_id" INTEGER,

 FOREIGN KEY (match_id) REFERENCES MATCHES(id),
 FOREIGN KEY (author_id) REFERENCES PLAYERS(id)
)