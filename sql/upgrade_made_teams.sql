
-- team_id points to a player's team instead of their teammate now
UPDATE players
SET team_id = COALESCE(
      (SELECT id
       FROM TEAMS
       WHERE TEAMS.soldier_id = players.id OR TEAMS.medic_id = players.id
       ),
       0);

-- update teams table to have a name row
ALTER TABLE TEAMS
ADD "name" TEXT;

-- Create default team names
UPDATE TEAMS
SET name = ("Team #" || id)

-- update matches table
ALTER TABLE MATCHES
ADD "round" INTEGER;

ALTER TABLE MATCHES
ADD "server_ip" TEXT;

ALTER TABLE MATCHES
ADD "server_port" INTEGER;

ALTER TABLE MATCHES
ADD "server_password" INTEGER;

ALTER TABLE MATCHES
ADD "team1_score" INTEGER;

ALTER TABLE MATCHES
ADD "team2_score" INTEGER;
