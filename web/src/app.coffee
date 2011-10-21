# first we need a session ID for all future ajax calls
$.when(getSID()).done (sid) ->
    ajaxDefaults['data']['sid'] = sid
    # then decide whether to show login or ui
    $.when(getConfig()).done (config) ->
        if config['logged_in']? or !config['accounts']
            renderView 'main', ->
                console.log 'main rendered'
        else
            $.when(
                renderView 'login',
                $.get '/lib/jquery.md5.js'
            ).done ->
               handleLogin()

# prepend a message paragraph containing <text> to <$container>
showMsg = ($container, text) ->
    $msgTag =
        $('<p>')
            .text(text)
            .addClass('msg')
    if $container.find('.msg').length > 0
        $container
            .find('.msg')
            .replaceWith($msgTag)
    else
        $container.prepend($msgTag)

handleLogin = ->
    $('#login').submit ->
        $.ajax(
            data: $.extend
                req_type: 'auth'
                action: 'get_token'
                ajaxDefaults['data']
        ).done (json) =>
            token = json['token']
            username = $('#username').val()
            password = $('#password').val()
            passwordMd5 = $.md5(token + password)
            $.ajax(
                data: $.extend
                    req_type: 'auth'
                    action: 'login'
                    username: username
                    password: passwordMd5
                    ajaxDefaults['data']
            ).done (json) =>
                if json['success']
                    showMsg($(this).children(':first'), 'logged in')
                else
                    showMsg($(this).children(':first'), json['error']['text'])
        false
