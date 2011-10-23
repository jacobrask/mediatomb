views = partials = {}

views['main'] = ->
    nav class: 'tree'
    section class: 'items'

views['login'] = ->
    form '#login', ->
        fieldset ->
            legend 'Log in'
            label ->
                text 'Username'
                input '#username', type: 'text'
            label ->
                text 'Password'
                input '#password', type: 'password'
            button 'Login'

views['error'] = ->
    p @msg

partials['tree'] = ->
    ul ->
        for container in @containers
            if container.child_count > 0
                li '.parent', 'data-db-id': container.id, ->
                    a href: '#', ->
                        text container.title
            else
                li ->
                    text container.title
