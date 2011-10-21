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
