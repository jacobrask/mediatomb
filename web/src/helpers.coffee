# setup defaults
ajaxDefaults =
    data:
        return_type: 'json'
$.ajaxSetup
    url: '/content/interface'

renderView = (view) ->
    $.Deferred ->
        $(document).ready =>
            $('#main').html CoffeeKup.render(views[view])
            this.resolve()
    .promise()
    
# get session id from cookie or server
getSID = ->
    $.Deferred ->
        if $.cookie('session_id')?
            this.resolve($.cookie('session_id'))
        else
            $.ajax(
                data: $.extend
                    req_type: 'auth'
                    action: 'get_sid'
                    ajaxDefaults['data']
            ).done (json) =>
                $.cookie 'session_id', json['sid']
                this.resolve(json['sid'])
    .promise()

# get config object from cookie or server    
getConfig = ->
    $.Deferred ->
        if $.cookie('config')?
            config = JSON.parse $.cookie 'config'
            this.resolve(config)
        else
            $.ajax(
                data: $.extend
                    req_type: 'auth'
                    action: 'get_config'
                    ajaxDefaults['data']
            ).done (json) =>
                config = json['config']
                $.cookie 'config', JSON.stringify config
                this.resolve(config)
    .promise()
