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
var class_counts = [, 0, 0];

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
 "team2_id" INTEGER                                                 \
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

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.logger());
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Parameter Pre-conditions
app.param('class_id', function(req, res, next, id) {
  var id = +id;
  if (id >= 0 && id <= 2)
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
  res.render('index', {
    steam_login: 'signup'
  });
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

app.get('/credits', function(req, res) {
  res.render('credits');
});

app.get('/request', function(req, res) {
  res.render('request');
});

app.post('/request_post', function(req, res) {
    var p1;
    var p2;
    db.all("SELECT COUNT(*) FROM players WHERE steamid=$id1", {
            $id1: req.body.player[0]+""
          },
           function(err, rows) {
              if (err) {
                res.redirect('request', {
                  error: 'An error occured.'
                });
              }
      p1 = rows[0]['COUNT(*)'];
    });
    db.all("SELECT COUNT(*) FROM players WHERE steamid=$id2", {
            $id2: req.body.player[1]+""
          },
           function(err, rows) {
              if (err) {
                res.redirect('request', {
                  error: 'An error occured.'
                });
              }
      var p2 = rows[0]['COUNT(*)'];

      if (req.body.player[0] == req.body.player[1]) {
        res.writeHead(200);
        res.end("Error, you entered 2 identical SteamIDs.");
      }
      else {
        if ((p1+p2) != 2) {
        res.writeHead(200);
        res.end("Error, you didn't enter 2 registered SteamIDs.");
        }
        else {
        db.run("INSERT OR IGNORE INTO REQTEAMS ('soldier_id','medic_id') \
                                       VALUES (?1,?2)",
            req.body.player[0], req.body.player[1]+"");
            res.redirect('/request');
        }
      }
    });
});

// /:csrf?
app.get('/signup/:class_id?', require_login, function(req, res) {
  // 'Optional' flags for rendering optional results
  // These can't be left undefined or jade complains
  res.local('full_class', false);
  res.local('teammate', false);

  if (req.params.class_id || req.params.class_id === 0) {
    //&& req.params.csrf === req.session._csrf) {
    var class_id = +req.params.class_id;

    if (class_id === 0) {
      db.run("UPDATE players SET class_id = $cid WHERE steamid = $sid", {
        $cid: "" + class_id,
        $sid: req.session.steamid+""
      });
      class_counts[req.session.class_id]--;
      req.session.class_id = 0;
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

  res.render('signup', {
    player: req.session.player,
    steamid: req.session.steamid,
    class_id: req.session.class_id,

//    csrf: encodeURIComponent(req.session._csrf),

    count_solly: class_counts[1],
    count_med: class_counts[2],
    class_limit: config.max_players_per_class
  });
});

app.get('/players', function(req, res) {
  var players = []
  db.all("SELECT name, class_id, steamid FROM players WHERE class_id != 0",
         function(err, rows) {
    if (err) {
      console.log("DB Err: " + err);
      return;
    }

    res.render('players', { players: rows });
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

        console.log(req.session.steamid);
        db.get("SELECT class_id FROM players WHERE steamid = $sid", {
          $sid: req.session.steamid+""
        }, function(err, row) {
          if (err) {
            console.log('DB Err: ' + err);
            req.session.class_id = 0;
          } else {
            console.log(row);
            if (typeof row === "undefined") {
              console.log("WTF");
              req.session.class_id = 0;
            } else
              req.session.class_id = row.class_id;
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

// Tasks to run before starting the server:
async.series([
  createPlayersTable
, createTeamsTable
, createMatchTable
, createReqTeamsTable
, loadClassCounts
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
