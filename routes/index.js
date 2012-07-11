/* Load in other groups of routes */
module.exports = function(app, config, db) {
  require('./static_routes')(app);


};