(function() {
  var ajaxDefaults, getConfig, getSID, handleLogin, renderView, showMsg;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  ajaxDefaults = {
    data: {
      return_type: 'json'
    }
  };
  $.ajaxSetup({
    url: '/content/interface'
  });
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
          }, ajaxDefaults['data'])
        }).done(__bind(function(json) {
          $.cookie('session_id', json['sid']);
          return this.resolve(json['sid']);
        }, this));
      }
    }).promise();
  };
  getConfig = function() {
    return $.Deferred(function() {
      var config;
      if ($.cookie('config') != null) {
        config = JSON.parse($.cookie('config'));
        return this.resolve(config);
      } else {
        return $.ajax({
          data: $.extend({
            req_type: 'auth',
            action: 'get_config'
          }, ajaxDefaults['data'])
        }).done(__bind(function(json) {
          config = json['config'];
          $.cookie('config', JSON.stringify(config));
          return this.resolve(config);
        }, this));
      }
    }).promise();
  };
  showMsg = function($container, text) {
    var $msgTag;
    $msgTag = $('<p>').text(text).addClass('msg');
    if ($container.find('.msg').length > 0) {
      return $container.find('.msg').replaceWith($msgTag);
    } else {
      return $container.prepend($msgTag);
    }
  };
  handleLogin = function() {
    return $('#login').submit(function() {
      $.ajax({
        data: $.extend({
          req_type: 'auth',
          action: 'get_token'
        }, ajaxDefaults['data'])
      }).done(__bind(function(json) {
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
          }, ajaxDefaults['data'])
        }).done(__bind(function(json) {
          if (json['success']) {
            return showMsg($(this).children(':first'), 'logged in');
          } else {
            return showMsg($(this).children(':first'), json['error']['text']);
          }
        }, this));
      }, this));
      return false;
    });
  };
  $.when(getSID()).done(function(sid) {
    ajaxDefaults['data']['sid'] = sid;
    return $.when(getConfig()).done(function(config) {
      if ((config['logged_in'] != null) || !config['accounts']) {
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
}).call(this);
