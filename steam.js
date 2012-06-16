/* A simple interface to login to Steam via OpenID, written because none of
 * node.js's libraries work.
 * 
 * Translated from a PHP script previously used, MIT Licensed by ichimonai.com
 *
 * Usage:
 *   genURL : given a url to return to and an OpenID realm, returns a url to
 *            be used as a link to steam's login page
 *   verify : Express middleware which handles the return from Steam's
 *              login page
 */

var _ = require('underscore')
  , querystring = require('querystring')
  , https = require('https');

var STEAM_LOGIN = 'https://steamcommunity.com/openid/login'
  , VALID_ID = /^http:\/\/steamcommunity.com\/openid\/id\/(\d{17,25})/
  , VALID_LOGIN = /is_valid:true/;

exports.genURL = _.memoize(function(return_to, realm) {
  var params = {
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': return_to,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  };
  return STEAM_LOGIN + '?' + querystring.stringify(params);
}, function(return_to, realm) { return [return_to, realm]; });

exports.verify = function(req, res, next) {
  // Start off with some basic params
  var params = {
    'openid.assoc_handle': req.query['openid.assoc_handle'],
    'openid.signed': req.query['openid.signed'],
    'openid.sig': req.query['openid.sig'],
    'openid.ns': 'http://specs.openid.net/auth/2.0'
  };
		
  // Get all the params that were sent back and resend them for validation
  var signed = req.query['openid.signed'].split(',');
  signed.forEach(function(param) {
    var val = req.query['openid.' + param];
    params['openid.' + param] = val;
  });
  params['openid.mode'] = 'check_authentication';

  // For some reason, encodeURIComponent here breaks steam's response...
  var data = querystring.stringify(params);

  // Verify data with Steam
  var request_opts = {
    host: 'steamcommunity.com',
    path: '/openid/login',
    method: 'POST',
    headers: {
      'accept-language': 'en',
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': data.length
    }
  };

  var steam_req = https.request(request_opts, function(steam_res) {
    var data = '';
    steam_res.on('data', function(chunk) {
      data += chunk;
    });

    steam_res.on('end', function() {
      var id = req.query['openid.claimed_id'].match(VALID_ID);
      if (data.match(VALID_LOGIN) && id) {
        req.steamid = id[1];
        next();
      }
      else {
        next(new Error('Invalid login'));
      }
    });
  });

  steam_req.on('error', function(e) {
    console.log('ERR: ' + e);
    next(new Error('OpenID Error'));
  });

  steam_req.end(data);
};