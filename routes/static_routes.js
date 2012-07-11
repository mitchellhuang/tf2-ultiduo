/* Routes for static jade files.  These may be able to be straight up placed
 * in the static directory, but the jade compiler is rather sketchy.
 * Any performance issues should be cleared up by the reverse proxy... */
module.exports = function(app) {
  app.get('/', function(req, res) { res.render('index'); });
  app.get('/rules', function(req, res) { res.render('rules'); });
  app.get('/time', function(req, res) { res.render('time'); });
  app.get('/admins', function(req, res) { res.render('admins'); });
  app.get('/credits', function(req, res) { res.render('credits'); });
  app.get('/request', function(req, res) { res.render('request'); });
};