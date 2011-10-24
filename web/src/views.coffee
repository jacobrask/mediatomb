views = partials = {}

views['main'] = ->
    nav class: 'tree'
    section class: 'items'

views['login'] = ->
    form '#login', ->
        fieldset ->
            label ->
                text 'Username' unless Modernizr.input.placeholder
                input '#username', type: 'text', placeholder: 'Username'
            label ->
                text 'Password' unless Modernizr.input.placeholder
                input '#password', type: 'password', placeholder: 'Password'
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
