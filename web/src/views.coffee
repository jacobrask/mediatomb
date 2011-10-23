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
        if @containers
            for container in @containers
                li '.folder', 'data-db-id': container.id, ->
                    a href: '#', ->
                        text container.title
        else if @items
            for item in @items
                li '.item', 'data-db-id': item.id, ->
                    a href: '#', ->
                        text item.title
