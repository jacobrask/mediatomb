(function() {
  var addLoginHandlers, addMainHandlers, ajaxDefaults, ajaxMT, getConfig, getSID, hasError, partials, renderPartial, renderView, showMsg, treeFetchChildren, views;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  ajaxDefaults = {
    data: {
      return_type: 'json'
    }
  };
  ajaxMT = function(ajaxData) {
    return $.Deferred(function() {
      return $.ajax({
        url: '/content/interface',
        data: $.extend(ajaxData, ajaxDefaults['data'])
      }).done(__bind(function(data) {
        var error;
        error = hasError(data);
        if (error) {
          return this.reject(error);
        } else {
          return this.resolve(data);
        }
      }, this)).fail(__bind(function() {
        renderView('error', {
          msg: 'The MediaTomb server cannot be reached. Please make sure it is running.'
        });
        return this.reject();
      }, this));
    }).promise();
  };
  hasError = function(data) {
    var code;
    if (data['error']) {
      code = Math.floor(data['error']['code'] / 100);
      if (code === 4) {
        $.cookie('session_id', null);
        $.cookie('config', null);
        return $.when(getConfig()).done(function(config) {
          if ((config['logged_in'] != null) || !config['accounts']) {
            return $.when(getSID()).done(function(sid) {
              return ajaxDefaults['data']['sid'] = sid;
            });
          } else {
            renderView('login');
            return showMsg($('#login fieldset'), data['error']['text']);
          }
        });
      } else if (code === 9) {
        return renderView('error', {
          msg: 'The MediaTomb UI has been disabled in the server configuration.'
        });
      } else if (code === !2) {
        return data['error']['text'];
      }
    } else {
      return false;
    }
  };
  renderView = function(view, data) {
    return $(document).ready(__bind(function() {
      return $('#main').html(CoffeeKup.render(views[view], data));
    }, this));
  };
  renderPartial = function(partial, data) {
    return CoffeeKup.render(partials[partial], data);
  };
  getSID = function() {
    return $.Deferred(function() {
      if ($.cookie('session_id') != null) {
        return this.resolve($.cookie('session_id'));
      } else {
        return ajaxMT({
          req_type: 'auth',
          action: 'get_sid'
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
        return ajaxMT({
          req_type: 'auth',
          action: 'get_config'
        }).done(__bind(function(json) {
          config = json['config'];
          $.cookie('config', JSON.stringify(config));
          return this.resolve(config);
        }, this));
      }
    }).promise();
  };
  treeFetchChildren = function(parentId) {
    return $.Deferred(function() {
      return ajaxMT({
        req_type: 'containers',
        parent_id: parentId,
        select_it: 0
      }).done(__bind(function(json) {
        var containers;
        containers = json['containers']['container'];
        return ajaxMT({
          req_type: 'items',
          parent_id: parentId,
          start: 0,
          count: 25
        }).done(__bind(function(json) {
          var items;
          items = json['items']['item'];
          if (items.length > 0 || containers.length > 0) {
            return this.resolve({
              items: items,
              containers: containers
            });
          } else {
            return this.reject();
          }
        }, this));
      }, this));
    }).promise();
  };
  views = partials = {};
  views['main'] = function() {
    nav({
      "class": 'tree'
    });
    return section({
      "class": 'items'
    });
  };
  views['login'] = function() {
    return form('#login', function() {
      return fieldset(function() {
        label(function() {
          if (!Modernizr.input.placeholder) {
            text('Username');
          }
          return input('#username', {
            type: 'text',
            placeholder: 'Username'
          });
        });
        label(function() {
          if (!Modernizr.input.placeholder) {
            text('Password');
          }
          return input('#password', {
            type: 'password',
            placeholder: 'Password'
          });
        });
        return button('Login');
      });
    });
  };
  views['error'] = function() {
    return p(this.msg);
  };
  partials['tree'] = function() {
    if (this.containers) {
      ul('.folders', function() {
        var container, _i, _len, _ref, _results;
        _ref = this.containers;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          container = _ref[_i];
          _results.push(li({
            'data-id': container.id
          }, function() {
            return a({
              href: '#'
            }, function() {
              return text(container.title);
            });
          }));
        }
        return _results;
      });
    }
    if (this.items) {
      return ul('.items', function() {
        var item, _i, _len, _ref, _results;
        _ref = this.items;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          item = _ref[_i];
          _results.push(li({
            'data-id': item.id
          }, function() {
            if (item.res) {
              return a({
                href: item.res
              }, function() {
                return text(item.title);
              });
            } else {
              return text(item.filename);
            }
          }));
        }
        return _results;
      });
    }
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
  addLoginHandlers = function() {
    return $('#login').submit(function() {
      ajaxMT({
        req_type: 'auth',
        action: 'get_token'
      }).done(__bind(function(json) {
        var password, passwordMd5, token, username;
        token = json['token'];
        username = $('#username').val();
        password = $('#password').val();
        passwordMd5 = $.md5(token + password);
        return ajaxMT({
          req_type: 'auth',
          action: 'login',
          username: username,
          password: passwordMd5
        }).done(__bind(function(json) {
          if (json['success']) {
            return addMainHandlers();
          } else {
            return showMsg($(this).children(':first'), json['error']['text']);
          }
        }, this));
      }, this));
      return false;
    });
  };
  addMainHandlers = function() {
    renderView('main');
    $.when(treeFetchChildren(0)).done(function(data) {
      return $('.tree').append(renderPartial('tree', data));
    });
    return $('.folders > li > a').live('click', function(ev) {
      var $li;
      ev.preventDefault();
      $li = $(this).parent();
      if ($li.has('ul').length > 0) {
        return $li.children('ul').remove();
      } else {
        return $.when(treeFetchChildren($li.data('id'))).done(function(data) {
          return $li.append(renderPartial('tree', data));
        });
      }
    });
  };
  $.when(getSID()).done(function(sid) {
    ajaxDefaults['data']['sid'] = sid;
    return $.when(getConfig()).done(function(config) {
      if ((config['logged_in'] != null) || !config['accounts']) {
        return addMainHandlers();
      } else {
        return renderView('login', $.when($.get('/lib/jquery.md5.js')).done(function() {
          return addLoginHandlers();
        }));
      }
    });
  });
}).call(this);
