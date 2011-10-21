# setup defaults
ajaxDefault =
    data:
        return_type: 'json'
$.ajaxSetup
    url: '/content/interface'

renderView = (view) ->
    $.Deferred ->
        $.when $.get('/views/' + view + '.js').done =>
            $('#main').html templates[view]()
            this.resolve()
    .promise()
    
# get session id from cookie or server
getSID = (callback) ->
    if $.cookie('session_id')?
        callback $.cookie 'session_id'
    else
        $.ajax
            data: $.extend
                req_type: 'auth'
                action: 'get_sid'
                ajaxDefault['data']
            success: (json) ->
                $.cookie 'session_id', json['sid']
                callback json['sid']

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

$ ->
    getSID (sid) ->
        ajaxDefault['data']['sid'] = sid
        getConfig 'accounts', (accounts) ->
            getConfig 'logged_in', (loggedIn) ->
                if loggedIn or !accounts
                    renderView 'main', ->
                        console.log 'main rendered'
                else
                    $.when(
                        renderView 'login',
                        $.get '/scripts/jquery.md5.js'
                    ).done ->
                       handleLogin()
