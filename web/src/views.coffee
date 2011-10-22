views = []

views['main'] = ->
    for container in @containers
        h2 ->
            a href: '#', ->
                text container.title

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

views['error'] = ->
    p @msg
