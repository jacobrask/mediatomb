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
                    ajaxDefault['data']
            ).done (json) =>
                $.cookie 'session_id', json['sid']
                this.resolve(json['sid'])
    .promise()

# get config key from cookie or server    
getConfig = (key) ->
    $.Deferred ->
        if $.cookie('config')?
            config = JSON.parse $.cookie 'config'
            this.resolve(config[key])
        else
            $.ajax(
                data: $.extend
                    req_type: 'auth'
                    action: 'get_config'
                    ajaxDefault['data']
            ).done (json) =>
                config = json['config']
                $.cookie 'config', JSON.stringify config
                this.resolve(config[key])
    .promise()

handleLogin = ->
    $('#login').submit ->
        $.ajax(
            data: $.extend
                req_type: 'auth'
                action: 'get_token'
                ajaxDefault['data']
        ).done (json) ->
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
                    ajaxDefault['data']
            ).done (json) ->
                console.log json
        false
