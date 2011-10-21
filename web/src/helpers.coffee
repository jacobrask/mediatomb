renderView = (view) ->
    $.Deferred ->
        $.when $.get('/lib/views/' + view + '.js').done =>
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
            $.ajax
                data: $.extend
                    req_type: 'auth'
                    action: 'get_sid'
                    ajaxDefault['data']
                success: (json) =>
                    $.cookie 'session_id', json['sid']
                    this.resolve(json['sid'])
    .promise()

# get config key from cookie or server    
getConfig = (key, callback) ->
    if $.cookie('config')?
        config = JSON.parse $.cookie 'config'
        callback config[key]
    else
        $.ajax
            data: $.extend
                req_type: 'auth'
                action: 'get_config'
                ajaxDefault['data']
            data: data
            success: (json) ->
                config = json['config']
                $.cookie 'config', JSON.stringify config
                callback config[key]

handleLogin = ->
    $('#login').submit ->
        $.ajax
            data: $.extend
                req_type: 'auth'
                action: 'get_token'
                ajaxDefault['data']
            success: (json) ->
                token = json['token']
                username = $('#username').val()
                password = $('#password').val()
                passwordMd5 = $.md5(token + password)
                data = $.extend
                    req_type: 'auth'
                    action: 'login'
                    username: username
                    password: passwordMd5
                    ajaxDefault['data']
                $.ajax
                    data: data
                    success: (json) ->
                        console.log json
        false
