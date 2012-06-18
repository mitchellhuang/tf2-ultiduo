#!/usr/bin/python
# WIP, only inserts steamid's

import sys, random, sqlite3, os

def file_exists(filename):
	try:
		with open(filename): return True
	except:
		return False

if len(sys.argv) != 3:
        sys.exit('Usage: assignteams.py [db name] [number of players]')
else:
	dbname = sys.argv[1]
	totalplayers = int(sys.argv[2])
	print dbname, "selected."
	print "total players:", totalplayers
	connection = sqlite3.connect(dbname)
	cursor = connection.cursor()

	# select all players and store in variable
	cursor.execute("SELECT name, steamid, class_id FROM players WHERE class_id='1'")
	rawsoldiers = cursor.fetchall()
	cursor.execute("SELECT name, steamid, class_id FROM players WHERE class_id='2'")
	rawmedics = cursor.fetchall()

	if totalplayers != (len(rawsoldiers) + len(rawmedics)):
		sys.exit('ERROR, not enough data.')

	# extract steamid's only from raw soldier output
	soldiers = []
	for i in range(len(rawsoldiers)):
		soldiers.append(rawsoldiers[i][1])
	print "Soldiers\n", soldiers

	# extract steamid's only from raw medic output
	medics = []
	for i in range(len(rawmedics)):
		medics.append(rawmedics[i][1])
	print "Medics\n", medics

	# shuffle everything
	random.shuffle(soldiers)
	random.shuffle(medics)

	print "Shuffled Soldiers\n", soldiers
	print "Shuffled Medics\n", medics

	# initiate DB connection
	connection = sqlite3.connect('teams.sqlite')
	cursor=connection.cursor()

	cursor.execute('DROP TABLE teams')
	cursor.execute('CREATE TABLE teams (id INTEGER, soldier_name TEXT, soldier_id TEXT, medic_name TEXT, medic_id TEXT)')
	
	# insert shuffled data into teams.sqlite DB
	print "Inserting data to new database..."
	for n in range(len(soldiers)):
		id = n + 1
		cursor.execute("INSERT INTO teams VALUES (?, ?, ?, ?, ?)", (id, '', soldiers[n], '', medics[n]))
		connection.commit()

	# close db connections
	cursor.close()
	cursor.close()

	print "Done."

	quit()