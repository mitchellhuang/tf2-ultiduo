import sqlite3, sys

# SQL Queries:

# Fetches all teams signed up together
UPDATE_IP = """
UPDATE matches SET server_ip = ? WHERE round = ?
"""

GET_MATCHES = """
SELECT id FROM matches WHERE round = ?
"""

UPDATE_PORT = """
UPDATE matches SET server_port = ? WHERE id = ?
""";

if len(sys.argv) != 5:
  print "Usage: %s [db_file] [match_round] [ip] [base_port]" % sys.argv[0]
  sys.exit(-1)

round = int(sys.argv[2])

db = sqlite3.connect(sys.argv[1])
cur = db.cursor()

cur.execute(UPDATE_IP, (sys.argv[3], round))

cur.execute(GET_MATCHES, (round,))
matches = cur.fetchall()

# Return values for individual player ids come back as individual tuples
# like (123,). Unpack these before making teams:
port = int(sys.argv[4])
for match_id in (n for (n,) in matches):
  cur.execute(UPDATE_PORT, (port, match_id))
  port += 1

db.commit()
cur.close()
