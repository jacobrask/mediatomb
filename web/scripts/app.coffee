$ ->
    $.get '/views/login.js', ->
        $('body').html templates.login()
