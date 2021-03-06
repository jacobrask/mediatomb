# prepend a message paragraph containing <text> to <$container>
showMsg = ($container, text) ->
    $msgTag =
        $('<p>')
            .text(text)
            .addClass('msg')
    if $container.find('.msg').length > 0
        $container
            .find('.msg')
            .replaceWith($msgTag)
    else
        $container.prepend($msgTag)

addLoginHandlers = ->
    $('#login').submit ->
        # fetch authentication token
        ajaxMT(
            req_type: 'auth'
            action: 'get_token'
        ).done (json) =>
            token = json['token']
            username = $('#username').val()
            password = $('#password').val()
            passwordMd5 = $.md5(token + password)
            # try to login
            ajaxMT(
                req_type: 'auth'
                action: 'login'
                username: username
                password: passwordMd5
            ).done (json) =>
                if json['success']
                    addMainHandlers()
                else
                    showMsg($(this).children(':first'), json['error']['text'])
        false

addMainHandlers = ->
    renderView('main')
    $.when(treeFetchChildren(0)).done (data) ->
        $('.tree').append(renderPartial('tree', data))

    $('.folders > li > a').live 'click', (ev) ->
        ev.preventDefault()
        $li = $(@).parent()
        if $li.has('ul').length > 0
            $li.children('ul').remove()
        else
            $.when(treeFetchChildren($li.data('id'))).done (data) ->
                $li.append(renderPartial('tree', data))

# first we need a session ID for all future ajax calls
$.when(getSID()).done (sid) ->
    ajaxDefaults['data']['sid'] = sid
    # then decide whether to show login or ui
    $.when(getConfig()).done (config) ->
        if config['logged_in']? or !config['accounts']
            addMainHandlers()
        else
            renderView 'login',
            $.when($.get '/lib/jquery.md5.js').done ->
               addLoginHandlers()
