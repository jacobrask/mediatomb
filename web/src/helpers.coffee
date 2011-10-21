# setup defaults
ajaxDefaults =
    data:
        return_type: 'json'
$.ajaxSetup
    url: '/content/interface'

renderView = (view) ->
    $.Deferred ->
        $.get('/lib/views/' + view + '.js').done =>
            $(document).ready =>
                $('#main').html templates[view]()
                this.resolve()
    .promise()
    
# get session id from cookie or server
getSID = ->
    $.Deferred ->
        if $.cookie('session_id')?
            this.resolve($.cookie('session_id'))
        else
            $.ajax(
                data: $.extend
                    req_type: 'auth'
                    action: 'get_sid'
                    ajaxDefaults['data']
            ).done (json) =>
                $.cookie 'session_id', json['sid']
                this.resolve(json['sid'])
    .promise()

# get config object from cookie or server    
getConfig = ->
    $.Deferred ->
        if $.cookie('config')?
            config = JSON.parse $.cookie 'config'
            this.resolve(config)
        else
            $.ajax(
                data: $.extend
                    req_type: 'auth'
                    action: 'get_config'
                    ajaxDefaults['data']
            ).done (json) =>
                config = json['config']
                $.cookie 'config', JSON.stringify config
                this.resolve(config)
    .promise()

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
