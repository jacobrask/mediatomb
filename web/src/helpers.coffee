# setup defaults
ajaxDefaults =
    data:
        return_type: 'json'

ajaxMT = (ajaxData) ->
    $.Deferred ->
        $.ajax(
            url: '/content/interface'
            data: $.extend(ajaxData, ajaxDefaults['data'])
        ).done((data) =>
            error = hasError(data)
            if error
                @reject(error)
            else
                @resolve(data)
        ).fail( =>
            renderView('error', { msg: 'The MediaTomb server cannot be reached. Please make sure it is running.' })
            @reject()
        )
    .promise()

hasError = (data) ->
    if data['error']
        # server returns a 3 character code, we only need 1st
        code = Math.floor(data['error']['code'] / 100)
        # session error, fatal
        if code is 4
            $.cookie('session_id', null)
            $.when(renderView('login')).done(
                showMsg($('#login fieldset'), data['error']['text'])
            )
        # ui disabled, fatal
        else if code is 9
            renderView('error', { msg: 'The MediaTomb UI has been disabled in the server configuration.' })
        # pass any other error except 'not found' to ajax success handler
        else if code is not 2
            return data['error']['text']
    else
        return false

renderView = (view, data) ->
    $.Deferred ->
        $(document).ready =>
            $('#main').html CoffeeKup.render(views[view], data)
            @resolve()
    .promise()
    
# get session id from cookie or server
getSID = ->
    $.Deferred ->
        if $.cookie('session_id')?
            @resolve($.cookie('session_id'))
        else
            ajaxMT(
                req_type: 'auth'
                action: 'get_sid'
            ).done (json) =>
                $.cookie 'session_id', json['sid']
                @resolve(json['sid'])
    .promise()

# get config object from cookie or server    
getConfig = ->
    $.Deferred ->
        if $.cookie('config')?
            config = JSON.parse $.cookie 'config'
            @resolve(config)
        else
            ajaxMT(
                req_type: 'auth'
                action: 'get_config'
            ).done (json) =>
                config = json['config']
                $.cookie 'config', JSON.stringify config
                @resolve(config)
    .promise()
