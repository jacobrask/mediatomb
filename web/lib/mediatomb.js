(function() {
  var addLoginHandlers, addMainHandlers, ajaxDefaults, errorCheck, getConfig, getSID, renderView, showMsg, views;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  ajaxDefaults = {
    data: {
      return_type: 'json'
    }
  };
  $.ajaxSetup({
    url: '/content/interface',
    success: function(data) {
      return errorCheck(data);
    }
  });
  errorCheck = function(data) {
    var code;
    if (data['error']) {
      console.log(data['error']['code']);
      code = Math.floor(data['error']['code'] / 100);
      if (code === 4) {
        $.cookie('session_id', null);
        return location.reload(false);
      } else if (code === 9) {
        return renderView('disabled');
      } else if (code === !2) {
        return console.log(data['error']['text']);
      }
    }
  };
  renderView = function(view) {
    return $.Deferred(function() {
      return $(document).ready(__bind(function() {
        $('#main').html(CoffeeKup.render(views[view]));
        return this.resolve();
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
  views = [];
  views['login'] = function() {
    return form({
      id: 'login'
    }, function() {
      return fieldset(function() {
        legend('Log in');
        label(function() {
          text('Username');
          return input({
            id: 'username',
            type: 'text'
          });
        });
        label(function() {
          text('Password');
          return input({
            id: 'password',
            type: 'password'
          });
        });
        return button('Login');
      });
    });
  };
  views['main'] = function() {
    a({
      href: '#'
    }, 'MediaTomb');
    return a({
      href: '#'
    }, 'Files');
  };
  $.when(getSID()).done(function(sid) {
    ajaxDefaults['data']['sid'] = sid;
    return $.when(getConfig()).done(function(config) {
      if ((config['logged_in'] != null) || !config['accounts']) {
        return $.when(renderView('main')).done(function() {
          return addMainHandlers();
        });
      } else {
        return $.when(renderView('login', $.get('/lib/jquery.md5.js'))).done(function() {
          return addLoginHandlers();
        });
      }
    });
  });
  showMsg = function($container, text) {
    var $msgTag;
    $msgTag = $('<p>').text(text).addClass('msg');
    if ($container.find('.msg').length > 0) {
      return $container.find('.msg').replaceWith($msgTag);
    } else {
      return $container.prepend($msgTag);
    }
  };
  addLoginHandlers = function() {
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
            return renderView('main');
          } else {
            return showMsg($(this).children(':first'), json['error']['text']);
          }
        }, this));
      }, this));
      return false;
    });
  };
  addMainHandlers = function() {
    return console.log('abc');
  };
}).call(this);
