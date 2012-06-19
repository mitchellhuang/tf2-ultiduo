#!/usr/bin/python
# Inserts name and steamid of both players to a team
# Execute from the command line
# Usage: shuffle.py [db name] [number of players]

import sys, random, sqlite3

if len(sys.argv) != 3:
        sys.exit('Usage: shuffle.py [db name] [number of players]')
else:
	dbname = sys.argv[1]
	totalplayers = int(sys.argv[2])
	print dbname, "selected."
	print "Total players:", totalplayers
	connection = sqlite3.connect(dbname)
	cursor = connection.cursor()

	# select all players and store in variable
	cursor.execute("SELECT name, steamid FROM players WHERE class_id='1'")
	rawsoldiers = cursor.fetchall()
	cursor.execute("SELECT name, steamid FROM players WHERE class_id='2'")
	rawmedics = cursor.fetchall()

	if totalplayers != (len(rawsoldiers) + len(rawmedics)):
		sys.exit('ERROR, not enough data.')

	soldiernumbers = []
	for i in range(totalplayers/2):
		soldiernumbers.append(i)

	print "Shuffling soldiers..."
	random.shuffle(soldiernumbers)

	medicnumbers = []
	for i in range(totalplayers/2):
		medicnumbers.append(i)

	print "Shuffling medics..."
	random.shuffle(medicnumbers)

	# initiate DB connection
	connection = sqlite3.connect('teams.sqlite')
	cursor=connection.cursor()

	cursor.execute('DROP TABLE IF EXISTS teams')
	cursor.execute('CREATE TABLE teams (id INTEGER, soldier_name TEXT, soldier_id TEXT, medic_name TEXT, medic_id TEXT)')
	
	# insert shuffled data into teams.sqlite DB
	print "Inserting data to new database..."
	for n in range(totalplayers/2):
		id = n + 1
		cursor.execute("INSERT INTO teams VALUES (?, ?, ?, ?, ?)", (id, rawsoldiers[soldiernumbers[n]][0], rawsoldiers[soldiernumbers[n]][1], rawmedics[medicnumbers[n]][0], rawmedics[medicnumbers[n]][1]))
		connection.commit()

	# close db connections
	cursor.close()
	cursor.close()

	print "Done."

	quit()