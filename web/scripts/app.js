(function() {
  var ajaxDefault, getConfig, getSID, handleLogin, renderView;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  ajaxDefault = {
    data: {
      return_type: 'json'
    }
  };
  $.ajaxSetup({
    url: '/content/interface'
  });
  renderView = function(view) {
    return $.Deferred(function() {
      return $.when($.get('/views/' + view + '.js').done(__bind(function() {
        $('#main').html(templates[view]());
        return this.resolve();
      }, this)));
    }).promise();
  };
  getSID = function(callback) {
    if ($.cookie('session_id') != null) {
      return callback($.cookie('session_id'));
    } else {
      return $.ajax({
        data: $.extend({
          req_type: 'auth',
          action: 'get_sid'
        }, ajaxDefault['data']),
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
        data: $.extend({
          req_type: 'auth',
          action: 'get_config'
        }, ajaxDefault['data']),
        data: data,
        success: function(json) {
          config = json['config'];
          $.cookie('config', JSON.stringify(config));
          return callback(config[key]);
        }
      });
    }
  };
  handleLogin = function() {
    return $('#login').submit(function() {
      $.ajax({
        data: $.extend({
          req_type: 'auth',
          action: 'get_token'
        }, ajaxDefault['data']),
        success: function(json) {
          var data, password, passwordMd5, token, username;
          token = json['token'];
          username = $('#username').val();
          password = $('#password').val();
          passwordMd5 = $.md5(token + password);
          data = $.extend({
            req_type: 'auth',
            action: 'login',
            username: username,
            password: passwordMd5
          }, ajaxDefault['data']);
          return $.ajax({
            data: data,
            success: function(json) {
              return console.log(json);
            }
          });
        }
      });
      return false;
    });
  };
  $(function() {
    return getSID(function(sid) {
      ajaxDefault['data']['sid'] = sid;
      return getConfig('accounts', function(accounts) {
        return getConfig('logged_in', function(loggedIn) {
          if (loggedIn || !accounts) {
            return renderView('main', function() {
              return console.log('main rendered');
            });
          } else {
            return $.when(renderView('login', $.get('/scripts/jquery.md5.js'))).done(function() {
              return handleLogin();
            });
          }
        });
      });
    });
  });
}).call(this);
