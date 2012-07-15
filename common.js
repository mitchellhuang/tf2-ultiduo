var steam = require('steam');

exports.require_login = function require_login(req, res, next) {
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