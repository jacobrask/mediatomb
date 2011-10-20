(function() {
  $(function() {
    var getSID, loadScript;
    loadScript = function(script, callback) {
      var tmpData;
      tmpData = $.ajaxSettings['data'];
      $.ajaxSettings['data'] = void 0;
      return $.get(script, function() {
        $.ajaxSettings['data'] = tmpData;
        return callback();
      });
    };
    $.ajaxSetup({
      url: '/content/interface',
      data: {
        return_type: 'json'
      }
    });
    getSID = function(callback) {
      if ($.cookie('session_id')) {
        return callback($.cookie('session_id'));
      } else {
        return $.ajax({
          data: {
            req_type: 'auth',
            action: 'get_sid'
          },
          success: function(json) {
            $.cookie('session_id', json['sid']);
            return callback(json['sid']);
          }
        });
      }
    };
    getSID(function(sid) {
      return $.ajaxSetup({
        data: {
          sid: sid
        }
      });
    });
    return loadScript('/views/login.js', function() {
      return $('body').html(templates.login());
    });
  });
}).call(this);
