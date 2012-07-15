var steam_data   = require('steam')
  , steam        = require('../steam');

var steam_api = new steam_data({ apiKey: config.steam_api_key,
                                 format: 'json' });

var MAYBE_INSERT_PLAYER = "\
INSERT OR IGNORE INTO PLAYERS ('name','steamid') VALUES (?1,?2)";

var UPDATE_PLAYER = "UPDATE PLAYERS SET name = ?1 WHERE steamid = ?2";

var GET_PLAYER = "\
SELECT id,class_id, team_id FROM players WHERE steamid = $sid";

module.exports = function(app, config, db) {

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
            var player = req.session.player;
            db.run(MAYBE_INSERT_PLAYER, player, req.session.steamid+"");
            db.run(UPDATE_PLAYER, player, req.session.steamid+"");
          });

          db.get(GET_PLAYER, { $sid: req.session.steamid+""},
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

};