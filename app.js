/*  TF2 Ultiduo Tournament

    An app server to manage the signup and running of a tf2 ultiduo tournament.

    Originally designed for a reddit tournament.

    Author: Gcommer
*/

// Module imports
var express    = require('express')
  , connect    = require('connect')
  , sqlite     = require('sqlite3')
  , steam_data = require('steam')
  , steam      = require('./steam.js')
  , async      = require('async')
  , sanitizer  = require('sanitizer')
  , invite     = require('./invite_players.js')
  , _          = require('underscore');

var app = module.exports = express.createServer();

// Load config settings for the mode we're running in
// (should be 'development' or 'production')
var config = require('./config.' + app.settings.env + '.js');

var steam_api = new steam_data({ apiKey: config.steam_api_key,
                                 format: 'json' });

// Load the sqlite database and setup the our tables, if they don't already
// exist
var db = new sqlite.Database(config.db_file);

// running tallies of number of players who have selected:
// soldier or medic respectively. These are loaded once and kept
// in memory so we don't have to query the db every time
var class_counts = [, 0, 0, 0];

function loadClassCounts(callback) {
  db.get('SELECT                                                    \
(SELECT COUNT(*) FROM [PLAYERS] WHERE class_id=1) as count_solly,   \
(SELECT COUNT(*) FROM [PLAYERS] WHERE class_id=2) as count_med',
         function(err, row) {
           if (err) callback(err);
//           if (row === undefined) callback(new Error("No results returned"));
           if (row === undefined || !row) {
             console.log("No players!");
             callback(null);
             return;
           }
           class_counts[1] = row.count_solly;
           class_counts[2] = row.count_med;

           callback(null);
         });
}

// Configuration
app.configure(function(){
  var pubdir = __dirname + '/public';
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'ultiduo949172463r57276'
                          , key: 'express.sid'
                          , store: new connect.middleware.session.MemoryStore()
                          // Cookies expire in 5 days (or when server restarts)
                          , cookie: { m02axAge: 5 * 24 * 60 * 60 * 1000 } }));
  app.use(express.compiler({ src: pubdir, enable: ['less']}));
  //app.use(connect.csrf());
  app.use(app.router);
  app.use(express.static(pubdir));
});

//
app.helpers({
  error: false
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.logger());
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Parameter Pre-conditions
app.param('class_id', function(req, res, next, id) {
  // 0 => Not playing
  // 1    Soldier
  // 2    Medic
  // 3    Backup
  var id = +id;
  if (id >= 0 && id <= 3)
    next();
  else
    next(new Error('Invalid class id: ' + id));
});

// Middleware for pages that require a login
function require_login(req, res, next) {
  // If we're already logged in, show the page:
  if (req.session.player)
    return next();

  var realm = 'http://' + req.headers.host
    , return_to = realm + '/verify?returnto=' + req.url;
  var steam_login = steam.genURL(return_to, realm);

  res.render('login', {
    steam_url: steam_login
  });
}

// Routes
app.get('/', function(req, res) {
  res.render('index');
});

app.get('/rules', function(req, res) {
  res.render('rules');
});

app.get('/bracket', function(req, res) {
  res.render('bracket');
});

app.get('/time', function(req, res) {
  res.render('time');
});

app.get('/admins', function(req, res) {
  res.render('admins');
});

app.get('/credits', function(req, res) {
  res.render('credits');
});

app.get('/request', function(req, res) {
  res.render('request');
});

// /:csrf?
app.all('/signup/:class_id?', require_login, function(req, res) {
  // 'Optional' flags for rendering optional results
  // These can't be left undefined or jade complains
  res.local('full_class', false);
  res.local('teammate', false);
  res.local('teammate_class_id', false)

  // A list of tasks to do asynchronously before we render the page
  // this should be used for more stuff once I have time to clean this up
  var thingsToDo = [];

  if (req.params.class_id || req.params.class_id === 0) {
    //&& req.params.csrf === req.session._csrf) {
    var class_id = +req.params.class_id;

    if (class_id === 0) {
      thingsToDo.push(function(callback) {
        db.run("UPDATE players SET class_id = 0 WHERE steamid = $sid", {
          $sid: req.session.steamid+""
        }, function(err, row) {
          if (err) {
            console.log('Error removing player from tournament: ' + err);
            return callback(err);
          }

          class_counts[req.session.class_id]--;
          req.session.class_id = 0;
          callback(null);
        });
      });
    } else if (class_id === 3) {
      thingsToDo.push(function(callback) {
        db.run("UPDATE players SET class_id = 3 WHERE steamid = $sid", {
          $sid: req.session.steamid+""
        }, function(err, row) {
          if (err) {
            console.log('Error making player a backup: ' + err);
            return callback(err);
          }

          class_counts[req.session.class_id]--;
          req.session.class_id = 3;
          callback(null);
        });
      });
    } else {
      // Check that there is an available slot for the selected class:
      if (class_counts[class_id] < config.max_players_per_class) {
        db.run("UPDATE players SET class_id = $cid WHERE steamid = $sid", {
          $cid: "" + class_id,
          $sid: req.session.steamid+""
        });
        class_counts[req.session.class_id]--;
        class_counts[class_id]++;

        req.session.class_id = class_id;
      } else {
        res.local('full_class', true);
        res.local('full_class_name', class_id === 1? "soldier" : "medic");
      }
    }
  }

  // Handle a POST'd teammate field:
  if (req.body.teammate && /^\d+$/.test(req.body.teammate)) {
    // TODO: Should actually do some validation checks here
    // (aside from the above number verification)
    req.session.team_id = +req.body.teammate;
    db.run("UPDATE PLAYERS SET team_id = ?1 WHERE steamid = ?2",
           req.body.teammate, req.session.steamid+"");
  }

  var teammate_class_id = null;
  if (req.session.class_id === 1 || req.session.class_id === 2) {
    // Show players registered as the other class
    teammate_class_id = (req.session.class_id === 1)? 2:1;
    res.local('teammate_class_id', teammate_class_id);

    // Get teammate info.  This should be stored in memory with the session
    // but I am tooooo lazy
    // (This also lets us check if they are mutual teammates)
    if (req.session.team_id) {
      thingsToDo.push(function(callback) {
        db.get('SELECT * FROM players WHERE id = ?1',
               req.session.team_id,
               function(err, row) {
                 if (err) return callback(err);
                 res.local('teammate', row);
                 callback(null);
               });
      });
    }

    thingsToDo.push(function(callback) {
      db.all('SELECT id, name, steamid FROM players WHERE class_id = ?',
             teammate_class_id,
             function(err, rows) {
        if (err) return callback(err);
        res.local('teammates', rows);
        callback(null);
      });
    });
  }

  async.parallel(thingsToDo, function(err, results) {
    if (err) {
      console.log('Signup page error: ' + err);
      res.local('error', 'Error assigning teammate');
    }

    res.render('signup', {
      player: req.session.player,
      steamid: req.session.steamid,
      class_id: req.session.class_id,
      player_id: req.session.player_id,

      count_solly: class_counts[1],
      count_med: class_counts[2],
      class_limit: config.max_players_per_class
    });
  });

});

function getMatchPlayerInfo(team_id) {
  return function(callback) {
  db.get('\
SELECT m.id as match_id,                                    \
m.server_ip, m.server_port,                                 \
t1.name as team1_name,                                      \
t2.name as team2_name,                                      \
p1.name as team1_soldier_name,                              \
p1.steamid as team1_soldier_steamid,                        \
p2.name    as team1_medic_name,                             \
p2.steamid as team1_medic_steamid,                          \
p3.name    as team2_soldier_name,                           \
p3.steamid as team2_soldier_steamid,                        \
p4.name    as team2_medic_name,                             \
p4.steamid as team2_medic_steamid                           \
FROM MATCHES m                                              \
JOIN TEAMS t1 ON t1.id = m.team1_id                         \
JOIN TEAMS t2 ON t2.id = m.team2_id                         \
JOIN PLAYERS p1 ON t1.soldier_id = p1.id                    \
JOIN PLAYERS p2 ON t1.medic_id = p2.id                      \
JOIN PLAYERS p3 ON t2.soldier_id = p3.id                    \
JOIN PLAYERS p4 ON t2.medic_id = p4.id                      \
WHERE round = 1 AND m.team1_id = $tid OR m.team2_id = $tid  \
', { $tid: team_id }, function(err, row) {
     if (err) callback(err);
     callback(null, row);
   });
  };
}

function getMatchComms(round, team_id) {
  return function(callback) {
    db.all('\
SELECT mc.message, mc.post_date, p.name                      \
FROM MATCH_COMMS mc                                          \
JOIN PLAYERS p ON p.id = mc.author_id                        \
WHERE mc.match_id =                                          \
(SELECT m.id FROM MATCHES m                                  \
  WHERE (team1_id = ?1 OR team2_id = ?1) AND round = ?2)    \
', team_id, round, function(err, rows) {
      if (err) callback(err);
      callback(null, rows);
    });
  };
}

function maybePostComm(req) {
  return function(callback) {
    var data = req.body;
    if (data === undefined || req.method !== "POST") return callback(null, "");
    if (!data.match || !(/^\d+$/.test(data.match))) return callback(null, "");
    if (!data.message || data.message.length > 300) return callback(null, "");
    db.get('SELECT * FROM MATCHES WHERE id = ?1 \
AND (team1_id = ?2 OR team2_id = ?2)', data.match, req.session.team_id,
           function(err, row) {
             if (err) callback(err);
             if (row === undefined) {
               console.log("Bad match id - possible hack attempt");
               callback("Bad match id - possible hack attempt");
               return;
             }

             db.run('INSERT INTO MATCH_COMMS  \
                     (match_id, message, post_date, author_id)\
                     VALUES (?1, ?2, datetime(?3, "unixepoch"), ?4)',
                    data.match,
                    sanitizer.sanitize(sanitizer.escape(data.message)),
                     ""+Math.floor(+new Date()/1000),
                     req.session.player_id, function(err) {
                       if (err) callback(err);
                       callback(null, null);
                     });
           });
  };
}

app.all('/match', require_login, function(req, res) {
  async.series([
    getMatchPlayerInfo(req.session.team_id),
    maybePostComm(req),
    getMatchComms(config.round, req.session.team_id)
  ], function(err, results) {
    if (err) {
      console.log('DB Err: ' + err);
      res.render('match', {
        error: 'An error occurred',
        match_id: 0,
        server_ip: null, server_port: null,
        team1_name: '', team2_name: '',
        team1_soldier_name: '', team1_soldier_steamid: '',
        team1_medic_name: '', team1_medic_steamid: '',
        team2_soldier_name: '', team2_soldier_name: '',
        team2_medic_name: '', team2_medic_steamid: '',
        match_comms: []
      });
      return;
    }

    var data = results[0];
    data.match_comms = results[2];

    res.render('match', data);
  });
});

app.get('/players', function(req, res) {
  var players = []
  db.all("SELECT name, class_id, steamid FROM players WHERE class_id != 0",
         function(err, rows) {
    if (err) {
      console.log("DB Err: " + err);
      res.render('players', {
        error: "Error fetching players"
      , players: []
      });
      return;
    }

    res.render('players', { players: rows });
  });
});

app.get('/teams', function(req, res) {
  db.all("\
SELECT t.id,                                   \
       p1.name as soldier_name,                \
       p1.steamid as soldier_steamid,          \
       p2.name as medic_name,                  \
       p2.steamid as medic_steamid,            \
       (p1.team_id = p2.id) as are_friends     \
FROM TEAMS t                                   \
JOIN PLAYERS p1                                \
ON t.soldier_id = p1.id                        \
JOIN PLAYERS p2                                \
ON t.medic_id = p2.id                          \
", function(err, rows) {
    if (err) {
      console.log("Teams: DB Err: " + err);
      res.render({
        error: "Error fetching teams"
      , teams: []
      });
      return;
    }

    res.render('teams', { teams: rows });
  });
});

// Login via Steam
app.get('/verify', steam.verify, function(req, res) {
  console.log('User logged in: ' + req.steamid);
  req.session.steamid = req.steamid;

  steam_api.getPlayerSummaries({
    steamids: [req.session.steamid],
    callback: function(err, data) {
      if (!err && data && data.response && data.response.players[0]) {
        req.session.player = data.response.players[0].personaname;

        db.serialize(function() {
          db.run("INSERT OR IGNORE INTO PLAYERS ('name','steamid') \
                                        VALUES (?1,?2)",
                 req.session.player, req.session.steamid+"");

          db.run("UPDATE PLAYERS SET name = ?1 WHERE steamid = ?2",
                 req.session.player, req.session.steamid+"");
        });

        db.get("SELECT id,class_id, team_id FROM players WHERE steamid = $sid",
               { $sid: req.session.steamid+""},
               function(err, row) {
          if (err) {
            console.log('DB Err: ' + err);
            req.session.player_id = 0;
            req.session.class_id = 0;
            req.session.team_id = false;
          } else {
            if (typeof row === "undefined") {
              req.session.player_id = 0;
              req.session.class_id = 0;
              req.session.team_id = false;
            } else {
              req.session.player_id = row.id;
              req.session.class_id = row.class_id;
              req.session.team_id = row.team_id;
            }
          }
          res.redirect(req.query['returnto'] || '/');
        });

      } else {
        console.log("Login err: " + err);
        res.redirect('/');
      }
    }
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

if (process.platform.indexOf("win") === -1) {
// Gracefull shutdown
  process.on('SIGTERM', function () {
    console.log('Shutting down...');
    db.close();
    console.log('Database closed...');
    app.close();
    console.log('HTTP Server closed...');
    process.exit(0);
  });
}

// Tasks to run before starting the server:
async.series([
  loadClassCounts
], function(err) {
  if (err) {
    console.log("Error starting ultiduo server:\n  " + err);
    return;
  }

  app.listen(config.port, function(){
    console.log("Ultiduo Voting listening on port %d in %s mode."
                , app.address().port, app.settings.env);
  });
});

/*



// team_id will first be 'teammate id' for now, and will point to the
// team once team's are finished :p This is pretty terrible design, but
// for now it avoids risking messing up the database (and I don't trust
// sqlite as it is)
function createPlayersTable(callback) {
  db.run('CREATE TABLE IF NOT EXISTS "PLAYERS"                      \
(                                                                   \
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,            \
 "name" TEXT NOT NULL check(typeof("name") = "text"),               \
 "steamid" TEXT NOT NULL UNIQUE check(typeof("steamid") = "text"),  \
 "class_id" INTEGER NOT NULL DEFAULT (0),                           \
 "team_id" INTEGER NOT NULL DEFAULT (0)                             \
)', function(err) {
    if (err) callback(err);
    callback(null);
  });
}

function createTeamsTable(callback) {
  db.run('CREATE TABLE IF NOT EXISTS "TEAMS"                        \
(                                                                   \
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,                   \
 "soldier_id" INTEGER,                                              \
 "medic_id" INTEGER                                                 \
)', function(err) {
    if (err) callback(err);
    callback(null);
  });
}

function createMatchTable(callback) {
  db.run('CREATE TABLE IF NOT EXISTS "MATCHES"                      \
(                                                                   \
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,                   \
 "team1_id" INTEGER,                                                \
 "team2_id" INTEGER,                                                \
 "round" INTEGER,                                                   \
 "server_ip" TEXT,                                                  \
 "server_port" INTEGER,                                             \
 "team1_score" INTEGER,                                             \
 "team2_score" INTEGER                                              \
)', function(err) {
    if (err) callback(err);
    callback(null);
  });
}

function createMatchCommsTable(callback) {
  db.run('CREATE TABLE IF NOT EXISTS "MATCHE_COMMS"                 \
(                                                                   \
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,                   \
 "match_id" INTEGER,                                                \
 "message" TEXT,                                                    \
 "post_date" INTEGER                                                \
)', function(err) {
    if (err) callback(err);
    callback(null);
  });
}

function createReqTeamsTable(callback) {
  db.run('CREATE TABLE IF NOT EXISTS "REQTEAMS"                     \
(                                                                   \
 "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,                   \
 "soldier_id" INTEGER,                                              \
 "medic_id" INTEGER                                                 \
)', function(err) {
    if (err) callback(err);
    callback(null);
  });
}
*/