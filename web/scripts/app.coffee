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
            if accounts
                renderView 'login', ->
                    console.log 'login rendered'
            else
                renderView 'main', ->
                    console.log 'main rendered'

