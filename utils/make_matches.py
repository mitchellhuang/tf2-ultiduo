import sqlite3, sys, random

# SQL Queries:

# Fetches all teams signed up together
GET_TEAMS = """
SELECT id FROM TEAMS
"""

INSERT_MATCH = """
INSERT INTO MATCHES (soldier_id, medic_id, round) VALUES (?, ?, 1)
""";

if len(sys.argv) != 2:
  print "Usage: %s [db_file]" % sys.argv[0]
  sys.exit(-1)

db = sqlite3.connect(sys.argv[1])
cur = db.cursor()

cur.execute(GET_TEAMS)
teams = cur.fetchall()

if len(teams) % 2 == 1:
  print "There are an odd number of teams"

# Return values for individual player ids come back as individual tuples
# like (123,). Unpack these before making teams:
teams = [n for (n,) in teams]

random.shuffle(teams)

matches = zip(teams[::2], teams[1::2])

cur.executemany(INSERT_MATCH, matches)
