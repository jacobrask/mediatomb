$.when(getSID()).done (sid) ->
    ajaxDefaults['data']['sid'] = sid
    $.when(getConfig('accounts')).done (accounts) ->
        $.when(getConfig('logged_in')).done (loggedIn) ->
            if loggedIn or !accounts
                renderView 'main', ->
                    console.log 'main rendered'
            else
                $.when(
                    renderView 'login',
                    $.get '/lib/jquery.md5.js'
                ).done ->
                   handleLogin()
