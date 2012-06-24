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

	# select all players steamid and store in variable
	cursor.execute("SELECT steamid FROM players WHERE class_id='1'")
	soldiers = list(zip(*cursor.fetchall())[0])
	cursor.execute("SELECT steamid FROM players WHERE class_id='2'")
	medics = list(zip(*cursor.fetchall())[0])

	if totalplayers != (len(soldiers) + len(medics)):
		sys.exit('ERROR, not enough data. Or something went wrong.')

	print "Shuffling soldiers..."
	random.shuffle(soldiers)
	print soldiers

	print "Shuffling medics..."
	random.shuffle(medics)
	print medics

	cursor.execute('DROP TABLE IF EXISTS teams')
	cursor.execute('CREATE TABLE teams (id INTEGER, soldier_id TEXT, medic_id TEXT)')
	
	# insert shuffled data into teams.sqlite DB
	print "Inserting data to new database..."
	for n in range(totalplayers/2):
		id = n + 1
		cursor.execute("INSERT INTO teams VALUES (?, ?, ?)", (id, soldiers[n], medics[n]))
		connection.commit()

	# close db connections
	cursor.close()

	print "Done."

	quit()