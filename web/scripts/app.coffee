$ ->
    # loads scripts without global ajax settings
    # the MT web server won't return static files with query strings
    loadScript = (script, callback) ->
        tmpData = $.ajaxSettings['data']
        $.ajaxSettings['data'] = undefined
        $.get script, ->
            $.ajaxSettings['data'] = tmpData
            callback()

    renderView = (view, callback) ->
        loadScript '/views/' + view + '.js', ->
            $('#main').html templates[view]()
            callback()

    $.ajaxSetup
        url: '/content/interface'
        data:
            return_type: 'json'

    # get session id from cookie or server
    getSID = (callback) ->
        if $.cookie('session_id')?
            callback $.cookie 'session_id'
        else
            $.ajax
                data:
                    req_type: 'auth'
                    action: 'get_sid'
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
                data:
                    req_type: 'auth',
                    action: 'get_config'
                success: (json) ->
                    config = json['config']
                    $.cookie 'config', JSON.stringify config
                    callback config[key]

    getSID (sid) ->
        $.ajaxSetup
            data:
                sid: sid
        getConfig 'accounts', (accounts) ->
            getConfig 'logged_in', (loggedIn) ->
                if loggedIn or !accounts
                    renderView 'main', ->
                        console.log 'main rendered'
                else
                    renderView 'login', ->
                        # load md5 plugin to compare password hashes
                        loadScript '/scripts/jquery.md5.js', ->
                            handleLogin()

    handleLogin = ->
        $('#login').submit ->
            $.ajax
                data:
                    req_type: 'auth'
                    action: 'get_token'
                success: (json) ->
                    token = json['token']
                    username = $('#username').val()
                    password = $('#password').val()
                    passwordMd5 = $.md5(token + password)
                    $.ajax
                        data:
                            req_type: 'auth'
                            action: 'login'
                            username: username
                            password: passwordMd5
                        success: (json) ->
                            console.log json
            false
