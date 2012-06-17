/*  TF2 Ultiduo Tournament

    An app server to manage the signup and running of a tf2 ultiduo tournament.

    Originally designed for a reddit tournament.

    Author: Gcommer
*/

// Module imports
var express    = require('express')
  , connect    = require('connect')
  , less       = require('less')
  , sqlite     = require('sqlite3')
  , steam_data = require('steam')
  , steam      = require('./steam.js');

var app = module.exports = express.createServer();

// Load config settings for the mode we're running in
// (should be 'development' or 'production')
var config = require('./config.' + app.settings.env + '.js');

var steam_api = new steam_data({ apiKey: config.steam_api_key,
                                 format: 'json' });

// Load the sqlite database and setup the our tables, if they don't already
// exist
var db = new sqlite.Database(config.db_file);

db.run('CREATE TABLE IF NOT EXISTS "PLAYERS"                  \
(                                                               \
 "id" INTEGER PRIMARY KEY  AUTOINCREMENT NOT NULL ,             \
 "name" TEXT NOT NULL check(typeof("name") = "text"),           \
 "steamid" TEXT NOT NULL UNIQUE check(typeof("steamid") = "text"),   \
 "class_id" INTEGER NOT NULL DEFAULT (0)                           \
)');

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
                          , cookie: { maxAge: 5 * 24 * 60 * 60 * 1000 } }));
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

// Routes
app.get('/', function(req, res) {
    res.render('index', {
      steam_login: 'signup'
    });
});

app.get('/signup', function(req, res) {
  if (req.session.player) {
    console.log(req.session.player + " is class " + req.session.class_id);
    res.render('vote', {
      player: req.session.player,
      steamid: req.session.steamid,
      class_id: req.session.class_id
    });
  } else {
    var steam_login = steam.genURL('http://' + req.headers.host + '/verify',
                                   req.headers.host);
    res.redirect(steam_login);
  }
});

// Page to choose to play soldier (1) or Medic (2)
app.get('/play_:class_id(0|1|2)', function(req, res) {
  if (req.session.steamid) {
    db.run("UPDATE players SET class_id = $cid WHERE steamid = $sid", {
             $cid: ""+req.params.class_id,
             $sid: req.session.steamid
    });
    req.session.class_id = +req.params.class_id;
  }
  res.redirect('/signup');
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
VALUES (?1,?2)", req.session.player, req.session.steamid);

        db.get("SELECT class_id FROM players WHERE steamid = '"
               + req.session.steamid + "'", function(err, row) {
          if (err) {
            console.log('DB Err: ' + err);
            req.session.class_id = 0;
          }
          else {
            console.log("db row:  " + row);
            if (typeof row === "undefined")
              req.session.class_id = 0;
            else
              req.session.class_id = row.class_id;
          }
          res.redirect('/signup');
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

app.listen(config.port, function(){
  console.log("Ultiduo Voting listening on port %d in %s mode"
            , app.address().port, app.settings.env);
});
