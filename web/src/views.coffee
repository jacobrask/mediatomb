views = []

views['login'] = ->
    form id: 'login', ->
        fieldset ->
            legend 'Log in'
            label ->
                text 'Username'
                input id: 'username', type: 'text'
            label ->
                text 'Password'
                input id: 'password', type: 'password'
            button 'Login'

views['main'] = ->
    a href: '#', 'MediaTomb'
    a href: '#', 'Files'

views['disabled'] = ->
    p 'The MediaTomb UI has been disabled in the server configuration.'

views['session_error'] = ->
    p 'Your session has expired or is invalid.'
    a href: '/', 'Login'
