var common = require('../common');

module.exports = function(app, config, db) {

  function admin_only(req, res, next) {
    if (!req.session.player)
      return common.require_login(req, res, next);

    if (config.admins.indexOf(req.session.steamid) != -1)
      return next();
    else
      // TODO: Nicer error messages!
      return next(new Error("You aren't an admin!!"));
  }

  app.get('/admin', admin_only, function(req, res) {
    res.render('admin');
  });

  app.get('/admin/matches', admin_only, function(req, res) {
    db.get("SELECT          \
m.id,                     \
t1.name as team1_name,    \
t2.name as team2_name,    \
team1_score,              \
team2_score,              \
round                     \
FROM MATCHES m            \
JOIN TEAMS t1 ON t1.id = m.team1_id  \
JOIN TEAMS t2 ON t2.id = m.team2_id  \
ORDER BY team1_score DESC", function(err, rows) {
      if (err) {
        res.render('bracket', {
          error: 'Error fetching matches',
          matches: []
        });
      }

      res.render('bracket', { matches: rows });
    });
  });

  app.get('/admin/match/:match_id?', admin_only, function(req, res) {
    res.render('admin/match', { match: req.match });
  });

  app.get('/admin/match_comms/:match_id', admin_only, function(req, res) {
    db.all('\
SELECT mc.message, mc.post_date, p.name                      \
FROM MATCH_COMMS mc                                          \
JOIN PLAYERS p ON p.id = mc.author_id                        \
WHERE mc.match_id = ?                                        \
', req.params.match_id, function(err, rows) {
      if (err) {
        res.render('admin/match_comms', {
          error: 'Error fetching match comms',
          match_id: 'Invalid',
          matche_comms: []
        });
      }

      res.render('admin/match_comms', {
        match_comms: rows,
        match_id: req.params.match_id
      });
    });
  });
};