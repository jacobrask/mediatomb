(function() {
  $(function() {
    return $.get('/views/login.js', function() {
      return $('body').html(templates.login());
    });
  });
}).call(this);
