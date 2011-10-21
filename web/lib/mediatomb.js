(function() {
  var ajaxDefault, getConfig, getSID, handleLogin, renderView;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  renderView = function(view) {
    return $.Deferred(function() {
      return $.get('/lib/views/' + view + '.js').done(__bind(function() {
        return $(document).ready(__bind(function() {
          $('#main').html(templates[view]());
          return this.resolve();
        }, this));
      }, this));
    }).promise();
  };
  getSID = function() {
    return $.Deferred(function() {
      if ($.cookie('session_id') != null) {
        return this.resolve($.cookie('session_id'));
      } else {
        return $.ajax({
          data: $.extend({
            req_type: 'auth',
            action: 'get_sid'
          }, ajaxDefault['data'])
        }).done(__bind(function(json) {
          $.cookie('session_id', json['sid']);
          return this.resolve(json['sid']);
        }, this));
      }
    }).promise();
  };
  getConfig = function(key) {
    return $.Deferred(function() {
      var config;
      if ($.cookie('config') != null) {
        config = JSON.parse($.cookie('config'));
        return this.resolve(config[key]);
      } else {
        return $.ajax({
          data: $.extend({
            req_type: 'auth',
            action: 'get_config'
          }, ajaxDefault['data'])
        }).done(__bind(function(json) {
          config = json['config'];
          $.cookie('config', JSON.stringify(config));
          return this.resolve(config[key]);
        }, this));
      }
    }).promise();
  };
  handleLogin = function() {
    return $('#login').submit(function() {
      $.ajax({
        data: $.extend({
          req_type: 'auth',
          action: 'get_token'
        }, ajaxDefault['data'])
      }).done(function(json) {
        var password, passwordMd5, token, username;
        token = json['token'];
        username = $('#username').val();
        password = $('#password').val();
        passwordMd5 = $.md5(token + password);
        return $.ajax({
          data: $.extend({
            req_type: 'auth',
            action: 'login',
            username: username,
            password: passwordMd5
          }, ajaxDefault['data'])
        }).done(function(json) {
          return console.log(json);
        });
      });
      return false;
    });
  };
  ajaxDefault = {
    data: {
      return_type: 'json'
    }
  };
  $.ajaxSetup({
    url: '/content/interface'
  });
  $.when(getSID).done(function(sid) {
    ajaxDefault['data']['sid'] = sid;
    return $.when(getConfig('accounts')).done(function(accounts) {
      return $.when(getConfig('logged_in')).done(function(loggedIn) {
        if (loggedIn || !accounts) {
          return renderView('main', function() {
            return console.log('main rendered');
          });
        } else {
          return $.when(renderView('login', $.get('/lib/jquery.md5.js'))).done(function() {
            return handleLogin();
          });
        }
      });
    });
  });
}).call(this);
