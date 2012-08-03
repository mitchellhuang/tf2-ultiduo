$(document).ready(function() {
  $('#toggle_players').click(function() {
    var $players = $('table.matches ul');
    $players.toggle();
    if ($players.is(':visible')) {
      $(this).text('Hide Players');
    } else {
      $(this).text('Show Players');
    }
  });
});