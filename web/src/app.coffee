# first we need a session ID for all future ajax calls
$.when(getSID()).done (sid) ->
    ajaxDefaults['data']['sid'] = sid
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
