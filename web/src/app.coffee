# setup defaults
ajaxDefault =
    data:
        return_type: 'json'
$.ajaxSetup
    url: '/content/interface'

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
                    $.get '/lib/jquery.md5.js'
                ).done ->
                   handleLogin()
