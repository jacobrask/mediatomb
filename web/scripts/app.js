(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  $(function() {
    var getConfig, getSID, handleLogin, loadScript, renderView;
    loadScript = function(script) {
      return $.Deferred(function() {
        var tmpData;
        tmpData = $.ajaxSettings['data'];
        $.ajaxSettings['data'] = void 0;
        return $.get(script, __bind(function() {
          $.ajaxSettings['data'] = tmpData;
          return this.resolve();
        }, this));
      }).promise();
    };
    renderView = function(view) {
      return $.Deferred(function() {
        return $.when(loadScript('/views/' + view + '.js')).done(__bind(function() {
          $('#main').html(templates[view]());
          return this.resolve();
        }, this));
      }).promise();
    };
    $.ajaxSetup({
      url: '/content/interface',
      data: {
        return_type: 'json'
      }
    });
    getSID = function(callback) {
      if ($.cookie('session_id') != null) {
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
    getConfig = function(key, callback) {
      var config;
      if ($.cookie('config') != null) {
        config = JSON.parse($.cookie('config'));
        return callback(config[key]);
      } else {
        return $.ajax({
          data: {
            req_type: 'auth',
            action: 'get_config'
          },
          success: function(json) {
            config = json['config'];
            $.cookie('config', JSON.stringify(config));
            return callback(config[key]);
          }
        });
      }
    };
    getSID(function(sid) {
      $.ajaxSetup({
        data: {
          sid: sid
        }
      });
      return getConfig('accounts', function(accounts) {
        return getConfig('logged_in', function(loggedIn) {
          if (loggedIn || !accounts) {
            return renderView('main', function() {
              return console.log('main rendered');
            });
          } else {
            return $.when(renderView('login', loadScript('/scripts/jquery.md5.js'))).done(function() {
              return handleLogin();
            });
          }
        });
      });
    });
    return handleLogin = function() {
      return $('#login').submit(function() {
        $.ajax({
          data: {
            req_type: 'auth',
            action: 'get_token'
          },
          success: function(json) {
            var password, passwordMd5, token, username;
            token = json['token'];
            username = $('#username').val();
            password = $('#password').val();
            passwordMd5 = $.md5(token + password);
            return $.ajax({
              data: {
                req_type: 'auth',
                action: 'login',
                username: username,
                password: passwordMd5
              },
              success: function(json) {
                return console.log(json);
              }
            });
          }
        });
        return false;
      });
    };
  });
}).call(this);
