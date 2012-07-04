import sqlite3, sys, random

# SQL Queries:

# Fetches all teams signed up together
GET_TEAMS = """
SELECT p1.id, p2.id
FROM PLAYERS p1, PLAYERS p2
WHERE p1.team_id = p2.id AND p2.team_id = p1.id
  AND p1.class_id = 1 AND p2.class_id = 2
"""

# Fetches all player ids playing in the tournament but not on a team
GET_RANDOMS = """
SELECT id FROM PLAYERS
WHERE class_id = %d
      AND NOT id IN (SELECT p1.id
FROM PLAYERS p1, PLAYERS p2
WHERE p1.team_id = p2.id AND p2.team_id = p1.id
  AND ((p1.class_id = 1 AND p2.class_id = 2)
    OR (p1.class_id = 2 AND p2.class_id = 1)))
"""

GET_SOLDIERS = GET_RANDOMS % (1)
GET_MEDICS = GET_RANDOMS % (2)

INSERT_TEAM = "INSERT INTO TEAMS (soldier_id, medic_id) VALUES (?, ?)";

if len(sys.argv) != 3:
  print "Usage: %s [db_file] [num_players]" % sys.argv[0]
  sys.exit(-1)

teams = []

db = sqlite3.connect(sys.argv[1])
cur = db.cursor()

# Get teams as a list of tuples of player ids for all the
# user-specified teams
cur.execute(GET_TEAMS)
teams = cur.fetchall()

# Get remaining soldiers and medics
cur.execute(GET_SOLDIERS)
soldiers = cur.fetchall()

cur.execute(GET_MEDICS)
medics = cur.fetchall()

# Return values for individual player ids come back as individual tuples
# like (123,). Unpack these before making teams:
soldiers = [n for (n,) in soldiers]
medics = [n for (n,) in medics]

# shuffle players!
random.shuffle(soldiers)
random.shuffle(medics)

# Combine list of random teams with user specified teams
teams += zip(soldiers, medics)

# Write to DB
cur.executemany(INSERT_TEAM, teams)

print "Create %d teams" % (len(teams))

db.commit()
cur.close()
