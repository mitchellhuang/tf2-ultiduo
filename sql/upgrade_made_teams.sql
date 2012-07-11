-- team_id points to a player's team instead of their teammate now
UPDATE players
SET team_id = COALESCE(
      (SELECT id
       FROM TEAMS
       WHERE TEAMS.soldier_id = players.id OR TEAMS.medic_id = players.id
       ),
       0);

-- Create default team names
UPDATE TEAMS
SET name = ("Team #" || id)