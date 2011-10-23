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
    if @containers
        ul '.folders', ->
            for container in @containers
                li 'data-id': container.id, ->
                    a href: '#', ->
                        text container.title
    if @items
        ul '.items', ->
            for item in @items
                    li 'data-id': item.id, ->
                        if item.res
                            a href: item.res, ->
                                text item.title
                        else
                            text item.filename
