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

db.run('CREATE TABLE IF NOT EXISTS "PLAYERS"                        \
(                                                                   \
 "id" INTEGER PRIMARY KEY  AUTOINCREMENT NOT NULL ,                 \
 "name" TEXT NOT NULL check(typeof("name") = "text"),               \
 "steamid" TEXT NOT NULL UNIQUE check(typeof("steamid") = "text"),  \
 "class_id" INTEGER NOT NULL DEFAULT (0)                            \
)');

var class_counts = [0, 0, 0];

function loadClassCounts(callback) {
  db.get('SELECT                                                    \
(SELECT COUNT(*) FROM [PLAYERS] WHERE class_id=1) as count_solly,   \
(SELECT COUNT(*) FROM [PLAYERS] WHERE class_id=2) as count_med',
         function(err, row) {
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

app.get('/time', function(req, res) {
  res.render('time');
});

app.get('/credits', function(req, res) {
  res.render('credits');
});

app.get('/signup/:class_id?', require_login, function(req, res) {
  var class_id = +req.params.class_id;
  res.local('full_class', false);
  if (req.params.class_id
   && class_counts[class_id] < config.max_players_per_class) {
    db.run("UPDATE players SET class_id = $cid WHERE steamid = $sid", {
      $cid: "" + class_id,
      $sid: req.session.steamid
    });

    class_counts[req.session.class_id]--;
    class_counts[class_id]++;

    req.session.class_id = class_id;
  } else {
    res.local('full_class', true);
    res.local('full_class_name', class_id === 1? "soldier" : "medic");
  }

  res.render('signup', {
    player: req.session.player,
    steamid: req.session.steamid,
    class_id: req.session.class_id,

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

        db.run("INSERT OR IGNORE INTO PLAYERS ('name','steamid') \
                                       VALUES (?1,?2)",
               req.session.player, req.session.steamid);

        db.get("SELECT class_id FROM players WHERE steamid = $sid", {
          $sid: req.session.steamid
        }, function(err, row) {
          if (err) {
            console.log('DB Err: ' + err);
            req.session.class_id = 0;
          } else {
            if (typeof row === "undefined")
              req.session.class_id = 0;
            else
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
async.parallel([
  loadClassCounts
], function(err) {
  if (err) {
    console.log("Error starting ultiduo server:\n" + err);
    return;
  }

  app.listen(config.port, function(){
    console.log("Ultiduo Voting listening on port %d in %s mode."
                , app.address().port, app.settings.env);
  });
});
