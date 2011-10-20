$ ->
    # loads scripts without global ajax settings
    loadScript = (script, callback) ->
        tmpData = $.ajaxSettings['data']
        $.ajaxSettings['data'] = undefined
        $.get script, ->
            $.ajaxSettings['data'] = tmpData
            callback()

    $.ajaxSetup
        url: '/content/interface'
        data:
            return_type: 'json'

    getSID = (callback) ->
        if $.cookie 'session_id'
            callback $.cookie 'session_id'
        else
            $.ajax
                data:
                    req_type: 'auth'
                    action: 'get_sid'
                success: (json) ->
                    $.cookie 'session_id', json['sid']
                    callback json['sid']

    getSID (sid) ->
        $.ajaxSetup
            data:
                sid: sid

    loadScript '/views/login.js', ->
        $('body').html templates.login()

