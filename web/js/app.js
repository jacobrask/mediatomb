/*MT*
    
    MediaTomb - http://www.mediatomb.cc/
    
    app.js - this file is part of MediaTomb.
    
    Copyright (C) 2005 Gena Batyan <bgeradz@mediatomb.cc>,
                       Sergey 'Jin' Bostandzhyan <jin@mediatomb.cc>
    
    Copyright (C) 2006-2010 Gena Batyan <bgeradz@mediatomb.cc>,
                            Sergey 'Jin' Bostandzhyan <jin@mediatomb.cc>,
                            Leonhard Wimmer <leo@mediatomb.cc>
    
    Copyright (C) 2011 Jacob Rask <jacob@jacobrask.net>

    MediaTomb is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License version 2
    as published by the Free Software Foundation.
    
    MediaTomb is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    version 2 along with MediaTomb; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.
    
    $Id$
*/

// get SID from cookie or server
var getSID = function(callback) {
    if ($.cookie('sid') !== null) {
        return callback($.cookie('sid'));
    } else {
        $.ajax({
            data: {
                req_type: 'auth',
                action: 'get_sid'
            },
            success: function(json) {
                return callback(json['sid']);
            }
        });
    }
}

// get login status from server
var checkLoginStatus = function(callback) {
    $.ajax({
        data: {
            req_type: 'auth',
            action: 'get_sid'
        },
        success: function(json) {
            return callback(json['logged_in']);
        }
    });
}

// get browse context (db or fs) from cookie
var getBrowseContext = function(callback) {
    if ($.cookie('context') === null) {
        return callback('db');
    } else {
        return callback($.cookie('context'));
    }
}

var showUI = function() {
    $('#topDiv').show();
    $('#treeDiv').show();
    $('#context_switcher').show();
    $('#statusDiv').show();
    /*if (ACCOUNTS) {
        $('#logout_link').show();
    }*/
}
var showLogin = function() {
    $('#loginDiv').show();
    $('#leftLoginDiv').show();
}

// do this if a user is logged in
var isLoggedIn = function() {
    getBrowseContext(function(context) {
        $('#context_switcher > button[value=' + context + ']').addClass('selected');
        $('#context_switcher > button').click(function(ev) {
            ev.preventDefault();
            setUIContext($(this).value);
        });
        $(document).keypress(function(ev) {
            userActivity(ev);
        });
        $(document).mousedown(function(ev) {
            mouseDownHandler(ev);
        });
    });
    showUI();
    itemInit();
    treeInit();
}

$(document).ready(function() {
    $.ajaxSetup({
        url: '/content/interface',
        data: {
            return_type: 'json',
            sid: SID
        }
    });
    getSID(function(sid) {
        SID = sid;
    });
    checkLoginStatus(function(loggedIn) {
        LOGGED_IN = loggedIn;
    });

    // determine whether to show login form or ui.
    getSID(function(sid) {
        if (sid === null) {
            checkLoginStatus(function(loggedIn) {
                if (!loggedIn) {
                    showLogin();
                } else {
                    isLoggedIn();
                }
            });
        } else {
            isLoggedIn();
        }
    });
});
var INACTIVITY_TIMEOUT = 5000,
    INACTIVITY_TIMEOUT_SHORT = 1000,
    use_inactivity_timeout_short = false;

var SID = $.cookie('SID');
var TYPE;     // database or filesystem
var ACCOUNTS; // accounts enabled or disabled
var LOGGED_IN;// logged in?
              // is set by checkSID();
var loggedIn = false;

// TODO FIXME
TYPE = $.cookie('TYPE');
lastNodeDbWish = $.cookie('lastNodeDb');
lastNodeFsWish = $.cookie('lastNodeFs');
var cookieViewItems = $.cookie('viewItems');
if (cookieViewItems) {
    viewItems = cookieViewItems;
}
if (TYPE!="db" && TYPE!="fs") TYPE="db";
var rightDocument = document;
getConfig();    
// END FIXME

function isTypeDb()
{
    return (TYPE == "db");
}

function appendImgNode(document, node, alt, icon)
{
    var img = document.createElement("img");
    img.setAttribute("src", icon.src);
    img.setAttribute("alt", alt);
    if (showTooltips) {
        img.setAttribute("title", alt);
    }
    img.setAttribute("width", icon.width);
    img.setAttribute("height", icon.height);
    node.appendChild(img);
}

var timer;

function errorCheck(xml, noredirect) {
    if (!xml) {
        return false;
    }
    var $rootEl = $(xml).find('root');
    var $errorEl = $(xml).find('error');
    var error = false;
    var redirect = false;
    var uiDisabled = false;
    if ($errorEl.length > 0) {
        var code = $errorEl.attr('code');
        var mainCode = Math.floor(code / 100);
        
        // 2xx - object not found
        // 3xx - login exception (not logged in or login error)
        // 4xx - session error (no valid session)
        // 5xx - storage exception
        // 8xx - general error (no more accurate code available (yet))
        // 900 - UI disabled
        
        if (mainCode == 4)
            redirect = '/';
        else if (mainCode == 9)
            uiDisabled = true;
        else if (mainCode != 2)
            error = $errorEl.text();
    }
    
    if (uiDisabled) {
        window.location = "/disabled.html";
        return false;
    }
    
    if (redirect) {
        $.cookie('SID', null);
        if (SID && ! noredirect) {
            SID = null;
            window.location = redirect;
        }
        return false;
    }
    
    // clears current task if no task element
    updateCurrentTask($(xml).find('task')[0]);
    
    var $updateIDsEl = $(xml).find('update_ids');
    if ($updateIDsEl.length > 0) {
        handleUIUpdates($updateIDsEl);
    }

    if (error) {
        alert(error);
        return false;
    }
    return true;
}

function handleUIUpdates($updateIDsEl) {
    if ($updateIDsEl.attr('pending') === '1') {
        setStatus("updates_pending");
        addUpdateTimer();
        last_update = new Date().getTime();
    } else if ($updateIDsEl.attr('updates') !== '1') {
        setStatus("no_updates");
        clearUpdateTimer();
        last_update = new Date().getTime();
    } else {
        var updateIDStr = $updateIDsEl.text();
        var savedlastNodeDbID = lastNodeDb;
        var savedlastNodeDbIDParent;
        if (savedlastNodeDbID != 'd0') {
            savedlastNodeDbIDParent = getTreeNode(savedlastNodeDbID).getParent().getID();
        }
        selectNodeIfVisible('d0');
        var updateAll = false;
        if (updateIDStr != 'all') {
            var updateIDsArr = updateIDStr.split(",");
            for (var i = 0; i < updateIDsArr.length; i++) {
                if (updateIDsArr[i] == 0) {
                    updateAll = true;
                }
            }
        } else {
            updateAll = true;
        }
        if (!updateAll) {
            for (var i = 0; i < updateIDsArr.length; i++) {
                var node = getTreeNode('d' + updateIDsArr[i]);
                if (node)
                {
                    var parNode = node.getParent();
                    if (parNode)
                    {
                        parNode.childrenHaveBeenFetched=false;
                        parNode.resetChildren();
                        fetchChildren(parNode, true);
                    }
                }
            }
        }
        else
        {
            var node = getTreeNode('d0');
            node.childrenHaveBeenFetched=false;
            node.resetChildren();
            fetchChildren(node, true);
        }
        var savedlastNodeDb = getTreeNode(savedlastNodeDbID);
        if (savedlastNodeDb)
            selectNodeIfVisible(savedlastNodeDbID);
        else if (savedlastNodeDbIDParent)
        {
            savedlastNodeDb = getTreeNode(savedlastNodeDbIDParent);
            if (savedlastNodeDb)
                selectNodeIfVisible(savedlastNodeDbIDParent);
        }
        setStatus("no_updates");
        if (timer)
        {
            window.clearTimeout(timer);
            timer = false;
        }
        last_update = new Date();
    }
}

function formToArray(form, args)
{
    for (var i = 0; i < form.length; ++i)
    {
        var element = form.elements[i];
        
        if (element.type && ((element.type != 'submit' && element.type != "radio" && element.type != "checkbox") || element.checked) && ! element.disabled)
            args[element.name] = element.value;
    }
}

var status_updates_pending = false;
var status_loading = false;

function setStatus(status) {
    if (status == "idle" && status_loading) {
        status_loading = false;
        $('#statusWorking').hide();
        if (status_updates_pending) {
            $('statusUpdatesPending').show();
        }
        else {
            $('statusIdle').show();
        }
    } else if (status == "loading" && ! status_loading) {
        status_loading = true;
        if (status_updates_pending) {
            $('statusUpdatesPending').hide();
        } else {
            $('statusIdle').hide();
        }
        $('#statusWorking').show();
    } else if (status == "updates_pending" && ! status_updates_pending) {
        status_updates_pending = true;
        if (!status_loading) {
            $('statusIdle').hide();
            $('statusUpdatesPending').show();
        }
    } else if (status == "no_updates" && status_updates_pending) {
        status_updates_pending = false;
        if (!status_loading) {
            $('statusUpdatesPending').hide();
            $('statusIdle').show();
        }
    }
}

function getUpdates(force) {
    if (loggedIn) {
        var updates = force ? 'get' : 'check';
        $.ajax({
            async: false,
            data: {
                req_type: 'void',
                updates: updates
            },
            success: function(json) {
                // if (! errorCheck(xml)) return;
                last_update = new Date().getTime();
            }
        });
    }
}

function userActivity(event) {
    clearUpdateTimer();
    addUpdateTimer();
    return true;
}

var last_update = new Date().getTime();

function mouseDownHandler(event) {
    userActivity(event);
    var now = new Date().getTime();
    if (last_update + 3000 < now)
    {
        getUpdates(false);
        last_update = now;
    }
}

function addUpdateTimer()
{
    if (! timer)
    {
        timer = window.setTimeout("getUpdates(true)", (use_inactivity_timeout_short ? INACTIVITY_TIMEOUT_SHORT : INACTIVITY_TIMEOUT));
        if (use_inactivity_timeout_short)
            use_inactivity_timeout_short = false;
    }
}

function clearUpdateTimer()
{
    if (timer)
    {
        window.clearTimeout(timer);
        timer = false;
    }
}

function action(action) {
    $.ajax({
        data: {
            req_type: 'action',
            action: action
        }
    });

}

var iconPath = '/icons/';

var iconNewItem = {src: iconPath + 'document-new.png', width: 30, height: 20};
var iconAdd = {src: iconPath + 'stock-add.png', width: 30, height: 20};
var iconEdit = {src: iconPath + 'stock_edit.png', width: 30, height: 20};
var iconRemoveThis = {src: iconPath + 'remove_this.png', width: 30, height: 20};
var iconRemoveAll = {src: iconPath + 'remove_all.png', width: 30, height: 20};
var iconAddAutoscan = {src: iconPath + 'add_as_autoscan.png', width: 30, height: 20};
var iconEditAutoscan = {src: iconPath + 'add_as_autoscan.png', width: 30, height: 20};

var iconFirst = {src: iconPath + 'go-first.png', width: 32, height: 20};
var iconPrevious = {src: iconPath + 'go-previous.png', width: 32, height: 20};
var iconNext = {src: iconPath + 'go-next.png', width: 32, height: 20};
var iconLast = {src: iconPath + 'go-last.png', width: 32, height: 20};
var iconArrowReplacement = {src: iconPath + 'blank.png', width: 32, height: 20};

var iconContainer = {src: iconPath + 'folder_open.png', width: 24, height: 29};
var iconContainerAutoscanTimed = {src: iconPath + 'autoscan_timed_folder_open.png', width: 24, height: 29};
var iconContainerAutoscanTimedConfig = {src: iconPath + 'autoscan_timed_config_folder_open.png', width: 24, height: 29};
var iconContainerAutoscanInotify = {src: iconPath + 'autoscan_inotify_folder_open.png', width: 24, height: 29};

var iconContainerAutoscanInotifyConfig = {src: iconPath + 'autoscan_inotify_config_folder_open.png', width: 24, height: 29};

var treeImagePath = '/icons/nanotree/images/';
var iconTreeClosed = treeImagePath + 'folder_closed.png';
var iconTreeOpen = treeImagePath + 'folder_open.png';
var iconTreeAutoscanTimedClosed = treeImagePath + 'autoscan_timed_folder_closed.png';
var iconTreeAutoscanTimedOpen = treeImagePath + 'autoscan_timed_folder_open.png';
var iconTreeAutoscanTimedConfigClosed = treeImagePath + 'autoscan_timed_config_folder_closed.png';
var iconTreeAutoscanTimedConfigOpen = treeImagePath + 'autoscan_timed_config_folder_open.png';

var iconTreeAutoscanInotifyOpen = treeImagePath + 'autoscan_inotify_folder_open.png';
var iconTreeAutoscanInotifyClosed = treeImagePath + 'autoscan_inotify_folder_closed.png';
var iconTreeAutoscanInotifyConfigOpen = treeImagePath + 'autoscan_inotify_config_folder_open.png';
var iconTreeAutoscanInotifyConfigClosed = treeImagePath + 'autoscan_inotify_config_folder_closed.png';
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_md5(s){ return binl2hex(core_md5(str2binl(s), s.length * chrsz));}
function b64_md5(s){ return binl2b64(core_md5(str2binl(s), s.length * chrsz));}
function str_md5(s){ return binl2str(core_md5(str2binl(s), s.length * chrsz));}
function hex_hmac_md5(key, data) { return binl2hex(core_hmac_md5(key, data)); }
function b64_hmac_md5(key, data) { return binl2b64(core_hmac_md5(key, data)); }
function str_hmac_md5(key, data) { return binl2str(core_hmac_md5(key, data)); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
  return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Calculate the HMAC-MD5, of a key and some data
 */
function core_hmac_md5(key, data)
{
  var bkey = str2binl(key);
  if(bkey.length > 16) bkey = core_md5(bkey, key.length * chrsz);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = core_md5(ipad.concat(str2binl(data)), 512 + data.length * chrsz);
  return core_md5(opad.concat(hash), 512 + 128);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert a string to an array of little-endian words
 * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
 */
function str2binl(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (i%32);
  return bin;
}

/*
 * Convert an array of little-endian words to a string
 */
function binl2str(bin)
{
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (i % 32)) & mask);
  return str;
}

/*
 * Convert an array of little-endian words to a hex string.
 */
function binl2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((i%4)*8  )) & 0xF);
  }
  return str;
}

/*
 * Convert an array of little-endian words to a base-64 string
 */
function binl2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * ( i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * ((i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * ((i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}

function authenticate() {
    // fetch authentication token
    $.ajax({
        data: {
            req_type: 'auth',
            action: 'get_token'
        },
        success: callback
    });
    function callback(json) {
        var token = json['token'];

        var username = document.login_form.username.value;
        var password = document.login_form.password.value;
        
        // create authentication password
        password = hex_md5(token + password);
        // try to login
        $.ajax({
            data: {
                req_type: 'auth',
                action: 'login',
                username: username,
                password: password
            },
            success: function(json) {
                // if (!errorCheck(xml)) {
                //     return;
                // }
                $('#loginDiv').hide();
                $('#leftLoginDiv').hide();
                $('#statusDiv').show();
                $('#treeDiv').show();
                $('#context_switcher').show();
                if (ACCOUNTS) {
                    $('#logout_link').show();
                }
                loggedIn = true;
                isLoggedIn();
                updateTreeAfterLogin();
            }
        });
    }
}
function logout() {
    $.ajax({
        async: false,
        data: {
            req_type: 'auth',
            action: 'logout'
        },
        success: function(json) {
            // errorCheck(json);
            $.cookie('SID', null);
            SID = null;
            window.location = '/';
        }
    });
}

function getConfig() {
    $.ajax({
        async: false,
        data: {
            req_type: 'auth',
            action: 'get_config'
        },
        success: callback
    });
    function callback(json) {
        // errorCheck(json, true);
        var cfg = json['config'];
        if (cfg) {
            // update global configuration settings
            ACCOUNTS = cfg['accounts'];
            pollIntervalTime = cfg['poll-interval'] * 1000;
            pollWhenIdle = cfg['poll-when-idle'];
            showToolTips = cfg['show-tooltips'];
            if (pollWhenIdle) {
                startPollInterval();
            }
            // pagination settings defaults
            if (cfg['items-per-page']) {
                itemOptions = cfg['items-per-page']['option'];
                if (viewItems === undefined) {
                    viewItems = cfg['items-per-page']['default'];
                }
                if (viewItemsMin === undefined) {
                    viewItemsMin = cfg['items-per-page']['option'][0];
                }
            }
            if (cfg['have-inotify']) {
                $('#scan_mode_inotify').show()
                $('#scan_mode_inotify_label').show()
            }
            if (cfg['actions']) {
                _.forEach(cfg['actions'], function(action) {
                    $('action_' + action).show();
                });
            }
        }
    }
}
/**
* Original Author of this file: Martin Mouritzen. (martin@nano.dk)
* 
* some changes (c) 2006 by Leonhard Wimmer (leo@mediatomb.org)
*
* according to http://nanotree.sourceforge.net/ this file is published under
* the LGPL License
*
* (Lack of) Documentation:
*
*
* If a finishedLoading method exists, it will be called when the tree is loaded.
* (good to display a div, etc.).
*
*
* You have to set the variable rootNode (as a TreeNode).
*
* You have to set a container element, this is the element in which the tree will be.
*
*
* TODO: 
* Save cookies better (only 1 cookie for each tree). Else the page will totally cookieclutter.
*
***********************************************************************
* Configuration variables.
************************************************************************/

// Should the rootNode be displayed.
var showRootNode = true;

// Should the nodes be sorted? (You can either specify a number, then it will be sorted by that, else it will
// be sorted alphabetically (by name).
var sortNodes = true;

// This is IMPORTANT... use an unique id for each document you use the tree in. (else they'll get mixed up).
var documentID = window.location.href;

// being read from cookie.
var nodesOpen = new Array();

// RootNode of the tree.
var rootNode;

// Container to display the Tree in.
var container;

// Shows/Hides subnodes on startup
var showAllNodesOnStartup = false;

// Is the roots dragable?
var dragable = false;

//set to the document/window the tree is in (needed for frame handling).
var treeDocument;
var treeWindow;


/************************************************************************
* The following is just instancevariables.
************************************************************************/
var href = '';

// rootNodeCallBack name (if null, it's not selectable).
var rootNodeCallBack = null;

// selectedNode
var selectedNode = null;

var states = '';
var statearray = new Array();

var treeNodeEdited = null;

var editaborted = false;

var floatDragElement = null;
var colouredElement = null;
var draggedNodeID = null;
var lastDraggedOnNodeID = null;


/**
* The TreeNode Object
* @param id unique id of this treenode
* @param name The title of this node
* @param icon The icon if this node (Can also be an array with 2 elements, the first one will represent the closed state, and the next one the open state)
* @param param A parameter, this can be pretty much anything. (eg. an array with information).
* @param orderNumber an orderNumber If one is given the nodes will be sorted by this (else they'll be sorted alphabetically (If sorting is on).
*/
function TreeNode(id,name,icon,param,orderNumber) {
    this.id = id;
    this.children = new Array();
    this.name = (name == null ? 'unset name' : name);
    this.icon = (icon == null ? '' : icon);
    this.parent = null;
    this.handler = null;
    this.param = (param == null ? '' : param);
    this.orderNumber = (orderNumber == null ? -1 : orderNumber);
    
    this.openeventlisteners = new Array();
    this.editeventlisteners = new Array();
    this.moveeventlisteners = new Array();
    this.haschildren = false;
    this.editable = false;
    this.linestring = '';
    
    this.nextSibling = null;
    this.prevSibling = null;
    
    this.childrenHaveBeenFetched = false;

    this.getID = function() {
        return this.id;
    }
    this.setName = function(newname) {
        this.name = newname;
    }
    this.getName = function() {
        return this.name;
    }
    this.getParam = function() {
        return this.param;
    }
    this.setIcon = function(icon) {
        this.icon = icon;
    }
    this.getIcon = function() {
        if (typeof(this.icon) == 'object') {
            return this.icon[0];
        }
        return this.icon;
    }
    this.getOpenIcon = function() {
        if (typeof(this.icon) == 'object') {
            return this.icon[1];
        }
        return this.icon;
    }
    this.hasIcon = function () {
        return this.icon != '';
    }
    this.getOrderNumber = function() {
        return this.orderNumber;
    }
    this.addOpenEventListener = function(event) {
        this.openeventlisteners[this.openeventlisteners.length] = event;
    }
    this.gotOpenEventListeners = function() {
        return (this.openeventlisteners.length > 0);
    }
    this.addEditEventListener = function(event) {
        this.editeventlisteners[this.editeventlisteners.length] = event;
    }
    this.gotEditEventListeners = function() {
        return (this.editeventlisteners.length > 0);
    }
    this.addMoveEventListener = function(event) {
        this.moveeventlisteners[this.moveeventlisteners.length] = event;
    }
    this.gotMoveEventListeners = function() {
        return (this.moveeventlisteners.length > 0);
    }
    this.addChild = function(childNode) {
        var possiblePrevNode = this.children[this.children.length - 1]
        if (possiblePrevNode) {
            possiblePrevNode.nextSibling = childNode;
            childNode.prevSibling = possiblePrevNode;
            //alert(childNode.prevSibling);
        }
        
        this.children[this.children.length] = childNode;
        childNode.setParent(this);

        if (sortNodes) {
            function sortByOrder(a,b) {
                var order1 = a.getOrderNumber();
                var order2 = b.getOrderNumber();
                if (order1 == -1 || order2 == -1) {
                    return a.getName().toLowerCase() > b.getName().toLowerCase() ? 1 : -1;
                }
                else {
                    if (order1 == order2) {
                        // If they got the same order number, then we'll sort by their title.
                        return a.getName().toLowerCase() > b.getName().toLowerCase() ? 1 : -1;
                    }
                    else {
                        return order1 - order2;
                    }
                }
            }
            this.children.sort(sortByOrder);
        }
    }
    this.removeChild = function(childNode) {
        var found = false;
        for (var i=0;i<this.children.length;i++) {
            if (found) {
                this.children[i] = this.children[i + 1];
            }
            if (this.children[i] == childNode) {
                if (i == (this.children.length - 1)) {
                    this.children[i] = null;
                }
                else {
                    this.children[i] = this.children[i + 1];
                }
                found = true;
            }
        }
        if (found) {
            this.children.length = this.children.length-1;
        }
    }
    this.resetChildren = function() {
        this.children = new Array();
    }
    this.setHasChildren = function(hasChildren) {
        this.haschildren = hasChildren;
    }
    this.hasChildren = function() {
        if (this.haschildren == true) {
            return true;
        }
        return (this.children.length > 0);
    }
    this.getChildCount = function() {
        return this.children.length;
    }
    this.getFirstChild = function() {
        if (this.hasChildren()) {
            return this.children[0];
        }
        return null;
    }
    this.gotHandler = function() {
        return this.handler != null;
    }
    this.setHandler = function(handler) {
        this.handler = handler;
    }
    this.getHandler = function() {
        return this.handler;
    }
    this.setParent = function(parent) {
        this.parent = parent;
    }
    this.getParent = function() {
        return this.parent;
    }
    this.getLineString = function() {
        return this.linestring;
    }
    this.setLineString = function(string) {
        this.linestring = string;
    }
    this.isEditable = function() {
        return this.editable;
    }
    this.setEditable = function(editable) {
        this.editable = editable;
    }
    
}


function findNodeWithID(node, nodeID) {
    if (node.getID() === nodeID) {
        return node;
    }
    else {
        if (node.hasChildren()) {
            for(var i=0;i<node.getChildCount();i++) {
                var value = findNodeWithID(node.children[i],nodeID);
                if (value != false) {
                    return value;
                }
            }
        }
        return false;
    }
}
function readStates() {
    states = $.cookie('tree' + documentID);
    if (states != null) {
        var array = states.split(';');
        for(var i=0;i<array.length;i++) {
            var singlestate = array[i].split('|');
            statearray[i] = new Array();
            statearray[i]["key"] = singlestate[0];
            statearray[i]["state"]  = singlestate[1];
        }
    }
}
function getState(nodeID) {
    for(var i=0;i<statearray.length;i++) {
        if (statearray[i]["key"] == nodeID) {
            state = statearray[i]["state"];
            if (state == null || state == '') {
                state = 'closed';
            }
            return state;
        }
    }
    return "closed";
}
function writeStates(nodeID,newstate) {
    //alert(nodeID);
    var str = '';
    var found = false;
    for(var i=0;i<statearray.length;i++) {
        if (statearray[i]["key"] == nodeID) {
            statearray[i]["state"] = newstate;
            found = true;
        }
        if (statearray[i]["state"] != null) {
            str += statearray[i]["key"] + '|' + statearray[i]["state"] + ';';
        }
    }
    if (found == false) {
        statearray[statearray.length] = new Array();
        statearray[statearray.length - 1]["key"] = nodeID;
        statearray[statearray.length - 1]["state"] = newstate;
        if (newstate != null) {
            str += nodeID + '|' + newstate + ';';
        }
    }
    $.cookie('tree' + documentID,str);
}
function showTree(path) {
    readStates();
    href = path;
    treeWindow.focus();
    treeWindow.onblur = blurSelection;
    treeWindow.onfocus = focusSelection;
    var str = '';
    str = '<div id="node' + rootNode.getID() + '" class="treetitle" style="display:' + (showRootNode == true ? 'block' : 'none') + '">';
    str += '<nobr>';
    if (rootNode.hasIcon()) {
        str += '<img src="' + rootNode.getIcon() + '" style="vertical-align:middle;' + imageStyleIcon + '">';
    }
    str += '<span style="vertical-align:middle;">&nbsp;' + rootNode.getName() + '</span>';
    str += '</nobr></div>';
    if (rootNode.hasChildren()) {
        for(i=0;i<rootNode.children.length;i++) {
            nodeContents = showNode(rootNode.children[i],(i == (rootNode.getChildCount() -1)));
            str = str + nodeContents;
        }
    }
    container.innerHTML = str;
    if (treeWindow.finishedLoading) {
        finishedLoading();
    }
}
/**
* Shows the given node, and subnodes.
*/
function showNode(treeNode,lastNode) {
    linestring = treeNode.getLineString();
    var state = getState(treeNode.getID());
    var str;
    str = '<div  ondragenter="dragEnter(\'' + treeNode.getID() + '\');" ondragleave="dragLeave();" ondragstart="startDrag(\'' + treeNode.getID() + '\');" ondrag="dragMove();" ondragend="endDrag(\'' + treeNode.getID() + '\')" id="node' + treeNode.getID() + '">';
    str += '<nobr>';
    for(var y=0;y<linestring.length;y++) {
        if (linestring.charAt(y) == 'I') {
            str += '<img src="' + href + 'images/line' + imageExtension + '" ' + imageStyle + '>';
        }
        else if (linestring.charAt(y) == 'B') {
            str += '<img src="' + href + 'images/' + imageWhite + imageExtension + '" ' + imageStyle + '>';
        }
    }
    if (treeNode.hasChildren()) {
        // If this is the first child of the rootNode, and showRootNode is false, we want to display a different icon.
        if (!showRootNode && (treeNode.getParent() == rootNode) && (treeNode.getParent().getFirstChild() == treeNode)) {
            if (!lastNode) {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + (state == 'open' ? imageMinusNoRoot : imagePlusNoRoot) + imageExtension + '" class="nanotree_children_no_root" ' + imageStyle + ' OnClick="handleNode(\'' + treeNode.getID() + '\');">';
            }
            else {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + (state == 'open' ? imageMinusLastNoRoot : imagePlusLastNoRoot) + imageExtension + '" class="nanotree_children_last_no_root" ' + imageStyle + ' OnClick="handleNode(\'' + treeNode.getID() + '\');">';
            }
        }
        else {
            if (!lastNode) {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + (state == 'open' ? imageMinus : imagePlus) + imageExtension + '" class="nanotree_children" ' + imageStyle + ' OnClick="handleNode(\'' + treeNode.getID() + '\');">';
            }
            else {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + (state == 'open' ? imageMinusLast : imagePlusLast) + imageExtension + '" class="nanotree_children_last" ' + imageStyle + ' OnClick="handleNode(\'' + treeNode.getID() + '\');">';
            }
        }
    }
    else {
        // If this is the first child of the rootNode, and showRootNode is false, we want to display a different icon.
        if (!showRootNode && (treeNode.getParent() == rootNode) && (treeNode.getParent().getFirstChild() == treeNode)) {
            if (!lastNode) {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + imageTNoRoot + imageExtension + '" class="nanotree_no_root" ' + imageStyle + '>';
            }
            else {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + imageWhite + imageExtension + '" ' + imageStyle + '>';
            }
        }
        else {
            if (!lastNode) {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + 't' + imageExtension + '" ' + imageStyle + '>';
            }
            else {
                str += '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + imageLastnode + '.png" class="nanotree_last" ' + imageStyle + '>';
            }
        }
    }
    iconStartImage = treeNode.getIcon();
    if (state != 'closed') {
        if (treeNode.hasChildren()) {
            iconStartImage = treeNode.getOpenIcon();
        }
    }
    
    str += '<img id="iconimage' + treeNode.getID() + '" src="' + iconStartImage + '" style="vertical-align:middle;' + imageStyleIcon + '" OnClick="selectNode(\'' + treeNode.getID() + '\')" OnDblClick="handleNode(\'' + treeNode.getID() + '\')">';
    str += '&nbsp;<span unselectable="ON" style="vertical-align:bottom;" class="treetitle" ID="title' + treeNode.getID() + '" OnDblClick="handleNode(\'' + treeNode.getID() + '\')" OnClick="selectNode(\'' + treeNode.getID() + '\')">';
    str += treeNode.getName();
    str += '</span>';
    str += '</nobr>';
    str += '</div>';

    if (treeNode.hasChildren()) {
        if (state == 'open') {
            str += '<div id="node' + treeNode.getID() + 'sub" style="display:block;">';
            fireOpenEvent(treeNode);
        }
        else {
            str += '<div id="node' + treeNode.getID() + 'sub" style="display:' + (showAllNodesOnStartup == true ? 'block;' : 'none;') + ';">';
        }
        var subgroupstr = '';
        var newChar = '';

        if (!lastNode) {
            newChar = 'I';
        }
        else {
            newChar = 'B';
        }
        for(var z=0;z<treeNode.getChildCount();z++) {
            treeNode.children[z].setLineString(linestring + newChar);
        }
        for(var z=0;z<treeNode.getChildCount();z++) {
            subgroupstr += showNode(treeNode.children[z],(z == (treeNode.getChildCount() -1)));
        }
        str += subgroupstr;
        str += '</div>';
    }
    else {
        str += '<div id="node' + treeNode.getID() + 'sub" style="display:none;">';
        str += '</div>';
    }
    return str;
}

function startDrag(nodeID) {
    if (!dragable) {
        return;
    }
    draggedNodeID = nodeID;
    
    var srcObj = treeWindow.event.srcElement;
    while(srcObj.tagName != 'DIV') {
        srcObj = srcObj.parentElement;
    }
    floatDragElement = treeDocument.createElement('DIV');

    floatDragElement.innerHTML = srcObj.innerHTML;
    floatDragElement.childNodes[0].removeChild(floatDragElement.childNodes[0].childNodes[0]);
    
    treeDocument.body.appendChild(floatDragElement);
    floatDragElement.style.zIndex = 100;
    floatDragElement.style.position = 'absolute';
    floatDragElement.style.filter='progid:DXImageTransform.Microsoft.Alpha(1,opacity=60);';
}
function findSpanChild(element) {
    if (element.tagName == 'SPAN') {
        return element;
    }
    else {
        if (element.childNodes) {
            for(var i=0;i<element.childNodes.length;i++) {
                var value = findSpanChild(element.childNodes[i]);
                if (value != false) {
                    return value;
                }
            }
            return false;
        }
    }
}
function dragEnter(nodeID) {
    if (!dragable) {
        return;
    }
    lastDraggedOnNodeID = nodeID;
    
    if (colouredElement) {
        findSpanChild(colouredElement).className = 'treetitle';
    }
    colouredElement = treeWindow.event.srcElement;
    while(colouredElement.tagName != 'DIV') {
        colouredElement = colouredElement.parentElement;
        if (colouredElement.tagName == 'BODY') {
            // Something gone seriously wrong.
            alert('Drag failure, reached <BODY>!');
            return;
        }
    }	
    findSpanChild(colouredElement).className = 'treetitleselectedfocused';
}
function dragLeave() {
    if (!dragable) {
        return;
    }
}
function endDrag(nodeID) {
    if (!dragable) {
        return;
    }
    if (lastDraggedOnNodeID != null) {
        fireMoveEvent(getTreeNode(lastDraggedOnNodeID),draggedNodeID,lastDraggedOnNodeID);
    }
}
function dragProceed() {
    if (!dragable) {
        return;
    }
    var dragged = getTreeNode(draggedNodeID);
    var newparent = getTreeNode(lastDraggedOnNodeID);

    var oldparent = dragged.getParent();
    
    oldparent.removeChild(dragged);
    newparent.addChild(dragged);
    
    refreshNode(oldparent);
    refreshNode(newparent);
    
    _dragClean()
}
function dragCancel() {
    if (!dragable) {
        return;
    }
    _dragClean()
}
/**
* Don't call this yourself.
*/
function _dragClean() {
    if (!dragable) {
        return;
    }
    if (colouredElement) {
        findSpanChild(colouredElement).className = 'treetitle';
    }
    
    floatDragElement.parentElement.removeChild(floatDragElement);
    floatDragElement = null;
    colouredElement = null;
    draggedNodeID = null;
    lastDraggedOnNodeID = null;
}
function dragMove() {
    if (!dragable) {
        return;
    }
    floatDragElement.style.top = treeWindow.event.clientY;
    floatDragElement.style.left = treeWindow.event.clientX;
}
function editEnded() {
    if (treeNodeEdited != null) {
        var editTitle = treeDocument.getElementById('title' + treeNodeEdited.getID());
        var input = editTitle.childNodes[0];
    
        var newValue = input.value;
        
        if (newValue == treeNodeEdited.getName()) {
            editTitle.innerHTML = newValue;
            treeNodeEdited = null;
            return;
        }
    
        fireEditEvent(treeNodeEdited,newValue);
        
        if (!editaborted) {
            treeNodeEdited.setName(newValue);
            editTitle.innerHTML = newValue;
        }
    
        treeNodeEdited = null;
    }
}
function selectNode(nodeID) {
    var treeNode = getTreeNode(nodeID);

    if (selectedNode != null && selectedNode != nodeID) {
        
        var oldNodeTitle = treeDocument.getElementById('title' + selectedNode);
        if (oldNodeTitle)
            oldNodeTitle.className = 'treetitle';
    }
    if (selectedNode == null || selectedNode != nodeID)
    {
        selectedNode = nodeID;
        var nodetitle = $('#title' + selectedNode);
        nodetitle.className = 'treetitleselectedfocused';
    }
    
    if (treeNode.gotHandler()) {
        eval(treeNode.getHandler() + '(getTreeNode(' + nodeID + '));');
    }
    else {
        standardClick(treeNode);
    }
}
function refreshNode(treeNode) {
    var submenu = treeDocument.getElementById('node' + treeNode.getID() + 'sub');
    var str = '';
    for(var i=0;i<treeNode.getChildCount();i++) {
        var parent = treeNode.getParent();
        if (!parent) {
            treeNode.children[i].setLineString(treeNode.getLineString() + 'B');
        }
        else {
            if (parent.children[parent.children.length - 1] == treeNode) {
                treeNode.children[i].setLineString(treeNode.getLineString() + 'B');
            }
            else {
                treeNode.children[i].setLineString(treeNode.getLineString() + 'I');
            }
        }
        str += showNode(treeNode.children[i],i == (treeNode.getChildCount() - 1));
    }
    var actionimage = treeDocument.getElementById('handler' + treeNode.getID());
    if (treeNode.getChildCount() == 0) {
        // TreeNode haven't got any children, make sure the right image is displayed.
        if (actionimage.className && actionimage.className.indexOf('_last') == -1) {
            actionimage.src = href + 'images/t' + imageExtension;
        }
        else {
            actionimage.src = href + 'images/' + imageLastnode + imageExtension;
        }
        actionimage.onclick = null;
        
        // Close the submenu
        if (submenu) {
            submenu.style.display = 'none';
        }
    }
    else {
        // We have children, make sure to display the + and - icon.
        if (actionimage.className && actionimage.className.indexOf('_children') != -1) {
            // The TreeNode has already got children, and displays them.
        }
        else {
            if (actionimage.className && actionimage.className.indexOf('_last') == -1) {
                actionimage.outerHTML = '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + imagePlus + imageExtension + '" class="nanotree_children" ' + imageStyle + ' OnClick="handleNode(\'' + treeNode.getID() + '\');">';
            }
            else {
                actionimage.outerHTML = '<img id="handler' + treeNode.getID() + '" src="' + href + 'images/' + imagePlusLast + '" class="nanotree_children_last" ' + imageStyle + ' OnClick="handleNode(\'' + treeNode.getID() + '\');">';
            }
        }
    }
    submenu.innerHTML = str;
}
function handleNode(nodeID) {
    var treeNode = getTreeNode(nodeID);	
    if (!treeNode.hasChildren()) { // No reason to handle a node without children.
        return;
    }
    
    var submenu = treeDocument.getElementById('node' + nodeID + 'sub');
    
    var iconimageholder = treeDocument.getElementById('iconimage' + nodeID);
    var actionimage = treeDocument.getElementById('handler' + nodeID);

    // This will be used if showRootNode is set to false.
    var firstChildOfRoot = false;
    if (actionimage.className && actionimage.className.indexOf('_no_root') != -1) {
        firstChildOfRoot = true;
    }
    
    if (submenu.style.display == 'none') {
        writeStates(nodeID,'open');
        fireOpenEvent(treeNode);
        submenu.style.display = 'block';

        iconimageholder.src = treeNode.getOpenIcon();
    
        if (actionimage.className && actionimage.className.indexOf('_last') == -1) {
            actionimage.src = href + 'images/' + ((firstChildOfRoot) ? imageMinusNoRoot : imageMinus) + imageExtension;
        }
        else {
            actionimage.src = href + 'images/' + ((firstChildOfRoot) ? imageMinusLastNoRoot : imageMinusLast) + imageExtension;
        }
    }
    else {
        writeStates(nodeID,'closed');
        submenu.style.display = 'none';
        
        iconimageholder.src = treeNode.getIcon();
        
        if (actionimage.className && actionimage.className.indexOf('_last') == -1) {
            actionimage.src = href + 'images/' + ((firstChildOfRoot) ? imagePlusNoRoot : imagePlus) + imageExtension;
        }
        else {                                                                   
            actionimage.src = href + 'images/' + ((firstChildOfRoot) ? imagePlusLastNoRoot : imagePlusLast) + imageExtension;
        }
    }
}
function fireOpenEvent(treeNode) {
    if (treeNode.gotOpenEventListeners()) {
        for(var i=0;i<treeNode.openeventlisteners.length;i++) {
            eval(treeNode.openeventlisteners[i] + '(\'' + treeNode.getID() + '\');');
        }
    }
}
function fireEditEvent(treeNode,newVal) {
    if (treeNode.gotEditEventListeners()) {
        for(var i=0;i<treeNode.editeventlisteners.length;i++) {
            eval(treeNode.editeventlisteners[i] + '(\'' + treeNode.getID() + '\',\'' + escape(newVal) + '\');');
        }
    }
}
function fireMoveEvent(treeNode,draggedNodeID,droppedOnNodeID) {
    if (treeNode.gotMoveEventListeners()) {
        for(var i=0;i<treeNode.moveeventlisteners.length;i++) {
            eval(treeNode.moveeventlisteners[i] + '(' + draggedNodeID + ',' + droppedOnNodeID + ');');
        }
    }
}
function blurSelection() {
    if (selectedNode != null) {
        var oldNodeTitle = treeDocument.getElementById('title' + selectedNode);
        if (oldNodeTitle)
            oldNodeTitle.className = 'treetitleselectedblured';
    }
}
function focusSelection() {
    if (selectedNode != null) {
        var oldNodeTitle = treeDocument.getElementById('title' + selectedNode);
        if (oldNodeTitle)
            oldNodeTitle.className = 'treetitleselectedfocused';
    }
}
function expandNode() {
    var state = getState(selectedNode);
    if (state == 'open') {
        var currentTreeNode = getTreeNode(selectedNode);
        if (currentTreeNode.hasChildren()) {
            if (currentTreeNode.children[0])
                selectNode(currentTreeNode.children[0].getID());
        }
    }
    else {
        handleNode(selectedNode);
    }
}
function subtractNode() {
    var state = getState(selectedNode);
    if (state == 'closed') {
        var currentTreeNode = getTreeNode(selectedNode);
        var parent = currentTreeNode.getParent();
        if (parent != null && parent != rootNode) {
            selectNode(parent.getID());
        }
    }
    else {
        handleNode(selectedNode);
    }
}
function selectPrevNode() {
    var currentTreeNode = getTreeNode(selectedNode);
    if (currentTreeNode.prevSibling != null) {

        var state = getState(currentTreeNode.prevSibling.getID());

        if (state == 'open' && currentTreeNode.prevSibling.hasChildren()) {
            // We have to find the last open child of the previoussiblings children.
            var current = currentTreeNode.prevSibling.children[currentTreeNode.prevSibling.children.length - 1];
            var currentstate = 'open';
            while (current.hasChildren() && (getState(current.getID()) == 'open')) {
                current = current.children[current.children.length - 1];
            }
            selectNode(current.getID());
        }
        else {
            selectNode(currentTreeNode.prevSibling.getID());
        }
    }
    else {
        if (currentTreeNode.getParent() != null && currentTreeNode.getParent() != rootNode) {
            selectNode(currentTreeNode.getParent().getID());
        }
    }
}
function selectNextNode() {
    var currentTreeNode = getTreeNode(selectedNode);

    var state = getState(selectedNode);
    if (state == 'open' && currentTreeNode.hasChildren()) {
        selectNode(currentTreeNode.children[0].getID());
    }	
    else {
        if (currentTreeNode.nextSibling != null) {
            selectNode(currentTreeNode.nextSibling.getID());
        }
        else {
            // Continue up the tree until we either hit null, or a parent which has a child.
            var parent = currentTreeNode;
            while ((parent = parent.getParent()) != rootNode) {
                if (parent.nextSibling != null) {
                    selectNode(parent.nextSibling.getID());
                    break;
                }
            }
        }
    }
}
function keyDown(event) {
    if (treeWindow.event) {
        event = treeWindow.event;
    }
    if (event.keyCode == 38) { // Up
        selectPrevNode();
        return false;
    }
    else if (event.keyCode == 40) { // Down
        selectNextNode();
        return false;
    }
    else if (event.keyCode == 37) { // left
        subtractNode();
        return false;
    }
    else if (event.keyCode == 39) { // right
        expandNode();
        return false;
    }
    // 13: enter
    // 32: space
    // 33: PgUp
    // 34: PgDown
}

var iconArray = new Array(iconTreeClosed,iconTreeOpen);
var autoscanTimedIconArray = new Array(iconTreeAutoscanTimedClosed, iconTreeAutoscanTimedOpen);
var autoscanTimedConfigIconArray = new Array(iconTreeAutoscanTimedConfigClosed, iconTreeAutoscanTimedConfigOpen);
var autoscanInotifyIconArray = new Array(iconTreeAutoscanInotifyClosed, iconTreeAutoscanInotifyOpen);
var autoscanInotifyConfigIconArray = new Array(iconTreeAutoscanInotifyConfigClosed, iconTreeAutoscanInotifyConfigOpen);
var lastNodeDb = 'd0';
var lastNodeFs = 'f0';
var lastNodeDbWish;
var lastNodeFsWish;

var imageExtension = '.png';
var imageStyle = 'style="width:24px;height:26px;vertical-align:middle;"';
var imageStyleIcon = "width:24px;height:26px;";
var imageLastnode = 'lastnode';
var imageWhite = 'white';
var imageTNoRoot = 't_no_root';
var imageMinus = 'minus';
var imageMinusNoRoot = 'minus_no_root';
var imageMinusLastNoRoot = 'minus_last_no_root';
var imageMinusLast = 'minus_last';
var imagePlusNoRoot = 'plus_no_root';
var imagePlusLastNoRoot = 'plus_last_no_root';
var imagePlus = 'plus';
var imagePlusLast = 'plus_last';

sortNodes = false;
showRootNode = false;

var dbStuff =
{
    container: false,
    rootNode: false,
    treeShown: false,
    tombRootNode: false,
    refreshQueue: new Array()
};
var fsStuff =
{
    container: false,
    rootNode: false,
    treeShown: false,
    tombRootNode: false,
    refreshQueue: new Array()
};

/* nanotree.js overrides... */

function getTreeNode(nodeID) {
    var type = nodeID.substr(0,1);
    if (type == 'd')
        return findNodeWithID(dbStuff.rootNode,nodeID);
    if (type == 'f')
        return findNodeWithID(fsStuff.rootNode,nodeID);
}

/* overrides END */

function treeInit()
{
    treeDocument = document;
    treeWindow = window;
    
    documentID = "mediatombUI";
    
    var $rootContainer = $('#treeDiv');
    dbStuff.container = treeDocument.createElement("div");
    fsStuff.container = treeDocument.createElement("div");
    
    $(dbStuff.container).hide();
    $(fsStuff.container).hide();
    $rootContainer.append(dbStuff.container);
    $rootContainer.append(fsStuff.container);
    
    dbStuff.rootNode = new TreeNode(-1,"Database", iconArray);
    dbStuff.tombRootNode = new TreeNode('d0', "Database", iconArray);
    dbStuff.tombRootNode.setHasChildren(true);
    dbStuff.tombRootNode.addOpenEventListener("openEventListener");
    dbStuff.rootNode.addChild(dbStuff.tombRootNode);
    fsStuff.rootNode = new TreeNode(-2,"Filesystem", iconArray);
    fsStuff.tombRootNode = new TreeNode('f0', "Filesystem", iconArray);
    fsStuff.tombRootNode.setHasChildren(true);
    fsStuff.tombRootNode.addOpenEventListener("openEventListener");
    fsStuff.rootNode.addChild(fsStuff.tombRootNode);
    setTreeContext('db');
    treeDocument.onkeydown = keyDown;
    treeDocument.onmousedown = mouseDownHandler;
}

function updateTreeAfterLogin()
{
    if (isTypeDb() && getState(dbStuff.tombRootNode.getID()) == "open") fetchChildren(dbStuff.tombRootNode);
    if (!isTypeDb() && getState(fsStuff.tombRootNode.getID()) == "open") fetchChildren(fsStuff.tombRootNode);
    selectLastNode();
}

function setTreeContext(context) {
    var type = (context === 'db') ? dbStuff : fsStuff;
    var newContainer = type.container;
    if (container !== newContainer) {
        if (container) {
            $(container).hide();
        }
        container = newContainer;
        $(container).show();
        rootNode = type.rootNode;
    }
    if (!type.treeShown) {
        readStates();
        if (context === 'db') {
            writeStates('d0','open');
        } else if (context === 'fs') {
            writeStates('f0','open');
        }
        showTree('/icons/nanotree/');
        type.treeShown = true;
    }
    while (type.refreshQueue.length > 0) {
        refreshNode(type.refreshQueue.pop());
    }
    if (loggedIn) {
        selectLastNode();
        if (context === 'db') {
            getUpdates(true);
        } else if (context === 'fs') {
            setStatus("no_updates");
        }
    }
}

function refreshOrQueueNode(node)
{
    var id = node.getID();
    var type = id.substr(0,1);
     if (isTypeDb())
    {
        if (type == 'd')
            refreshNode(node);
        else
            fsStuff.refreshQueue.push(node);
    }
    else
    {
        if (type == 'f')
            refreshNode(node);
        else
            dbStuff.refreshQueue.push(node);
    }
}

function selectLastNode()
{
    if (isTypeDb())
    {
        var saveLastNodeDbWish = lastNodeDbWish;
        if (lastNodeDb)
            selectNode(lastNodeDb);
        lastNodeDbWish = saveLastNodeDbWish
    }
    else
    {
        var saveLastNodeFsWish = lastNodeFsWish;
        if (lastNodeFs)
            selectNode(lastNodeFs);
        lastNodeFsWish = saveLastNodeFsWish
    }
}

function selectNodeIfVisible(nodeID)
{
    var type = nodeID.substr(0,1);
    if (isTypeDb())
    {
        if (type == 'd')
            selectNode(nodeID);
    }
    else
    {
        if (type == 'f')
            selectNode(nodeID);
    }
}

function standardClick(treeNode)
{
    userActivity();
    var id = treeNode.getID();
    if (isTypeDb())
    {
        if (id.substr(0,1) == 'd')
        {
            $.cookie('lastNodeDb', id);
            lastNodeDb = id;
            lastNodeDbWish = null;
            folderChange(id);
        }
    }
    else
    {
        if (id.substr(0,1) == 'f')
        {
            $.cookie('lastNodeFs', id);
            lastNodeFs = id;
            lastNodeFsWish = null;
            folderChange(id);
        }
    }
}

function openEventListener(id)
{
    var node = getTreeNode(id);
    if (!node.childrenHaveBeenFetched)
    {
        fetchChildren(node);
    }
}

function fetchChildren(node, uiUpdate, selectIt) {
    var id = node.getID();
    var type = id.substring(0, 1);
    id = id.substring(1);
    var linkType = (type === 'd') ? 'containers' : 'directories';
    var select_it = selectIt ? '1' : '0';
    var async = ! uiUpdate;
    $.ajax({
        async: async,
        data: {
            sid: SID,
            req_type: linkType,
            parent_id: id,
            select_it: select_it
        },
        success: callback
    });

    function callback(json) {
        var type;
        var containers = json['containers'];
        if (!containers) {
            alert("no containers tag found");
            return;
        }
        if (containers['type'] === 'filesystem') {
            type = 'f';
        } else if (containers['type'] === 'database') {
            type = 'd';
        }
        var parentId = type + containers['parent_id'];
        var node = getTreeNode(parentId);
        if (!json['success']) {
            if (containers['parent_id'] === 0) {
                alert("Oops, your database seems to be corrupt. Please report this problem.");
                return;
            }
            var parNode = node.getParent();
            parNode.childrenHaveBeenFetched=false;
            parNode.resetChildren();
            fetchChildren(parNode, true, true);
            return;
        }
        var selectIt = containers['select_it'] === '1';
        
        if (node.childrenHaveBeenFetched) {
            return;
        }
        
        var cts = containers['container'];
        if (cts.length <= 0) {
            alert("no containers found");
            return;
        }
        var doSelectLastNode = false;
        
        _.forEach(cts, function(c) {
            var id = type + c['id'];
            var expandable = c['child_count'] ? true : false;
            var autoscanType = c['autoscan_type'];
            var autoscanMode = c['autoscan_mode'];
            var thisIconArray = iconArray;
            if (autoscanType === 'ui') {
                if (autoscanMode === 'inotify') {
                    thisIconArray = autoscanInotifyIconArray;
                } else {
                    thisIconArray = autoscanTimedIconArray;
                }
            } else if (autoscanType == 'persistent') {
                if (autoscanMode == 'inotify') {
                    thisIconArray = autoscanInotifyConfigIconArray;
                } else {
                    thisIconArray = autoscanTimedConfigIconArray;
                }
            }
            var title = c['title'];
            var child = new TreeNode(id, title, thisIconArray);
            child.setHasChildren(expandable);
            try {
                node.addChild(child);
            }
            catch (e) {
                return;
            }
            child.addOpenEventListener("openEventListener");
            if (id === lastNodeDbWish) {
                lastNodeDbWish = null;
                lastNodeDb = id;
                doSelectLastNode = true;
            } else if (id === lastNodeFsWish) {
                lastNodeFsWish = null;
                lastNodeFs = id;
                doSelectLastNode = true;
            }
        });
        
        node.childrenHaveBeenFetched = true;
        refreshOrQueueNode(node);
        if (doSelectLastNode) {
            selectLastNode();
        } else if (selectIt) {
            selectNodeIfVisible(parentId);
        }
    }
}

var itemRoot;
var topItemRoot
var rightDocument;

var dbItemRoot;
var fsItemRoot;

// will be overridden by getConfigCallback() (auth.js)

var itemOptions = [],
    viewItemsMin,
    viewItems;
var defaultViewItems = 25,
    showAddPages = 3;

function itemInit()
{
    rightDocument = document;
    topRightDocument = document;
    dbItemRoot = $('#item_db_div');
    fsItemRoot = $('#item_fs_div');
    dbTopItemRoot = $('#item_db_head');
    fsTopItemRoot = $('#item_fs_head');
    itemChangeType('db');
    if (viewItems == -1) {
        viewItems = defaultViewItems;
    }
}


function itemChangeType(context) {
    itemRoot = (context === 'db') ? dbItemRoot : fsItemRoot; // XXX global
    topItemRoot = (context === 'db') ? dbTopItemRoot : fsTopItemRoot; // XXX global
    if (context === 'db') {
        $('#item_db_div').show();
    } else if (context === 'db') {
        $('#item_fs_div').show();
    }
}

var lastFolder;
var lastItemStart;

function folderChange(id)
{
    if (id == lastFolder)
        loadItems(id, lastItemStart);
    else
        loadItems(id, 0);
}

function loadItems(id, start) {
    if (start % viewItems != 0) {
        start = Math.floor((start / viewItems)) * viewItems;
    }

    lastItemStart = start;
    lastFolder = id;
    
    var type = id.substring(0, 1);
    id = id.substring(1);
    var itemLink = type == 'd' ? 'items' : 'files';
    var updates = type == 'd' ? 'check' : undefined;
    $.ajax({
        data: {
            req_type: itemLink,
            parent_id: id,
            start: start,
            count: viewItems,
            updates: updates
        },
        success: callback
    });

    function callback(json) {
        var items = json['items'];
        var useFiles = false;
        var childType = 'item';
        if (!items) {
            items = json['files'];
            if (!items) {
                alert("no items or files tag found");
                return;
            }
            useFiles = true;
            childType = 'file';
        }
        var ofId = items['parent_id'];
        if(!json['success']) {
             if (ofId === 0) {
                alert("Oops, your database seems to be corrupt. Please report this problem.");
                return;
            }
            var prefix = (useFiles ? 'f' : 'd');
            var node = getTreeNode(prefix + ofId);
            var parNode = node.getParent();
            parNode.childrenHaveBeenFetched=false;
            parNode.resetChildren();
            fetchChildren(parNode, true, true);
            return;
        }
        var isVirtual = items['virtual'];
        var autoscanType = items['autoscan_type'];
        var autoscanMode = items['autoscan_mode'];
        var path = items['location'];
        var loadItemId = (useFiles ? 'f' : 'd') + ofId;
        var totalMatches = items['total_matches'];
        var isProtected = items['protect_container'];;
        var itemsProtected = items['protect_items'];
        var totalPages = Math.ceil(totalMatches / viewItems);
        var start = parseInt(items['start']);
        var thisPage = Math.abs(start / viewItems);
        var nextPageStart = (thisPage + 1) * viewItems;
        var prevPageStart = (thisPage - 1) * viewItems;
        var showPaging = (!useFiles && totalMatches > viewItemsMin);
        var showPagingPages = (totalPages > 1);
        
        if (showPaging) {
            if (showPagingPages) {
                var pagesFrom;
                var pagesTo
                if (thisPage <= showAddPages + 1) {
                    pagesFrom = 0;
                    pagesTo = showAddPages * 2 + 1;
                } else if (thisPage < totalPages - showAddPages - 1) {
                    pagesFrom = thisPage - showAddPages;
                    pagesTo = thisPage + showAddPages;
                } else {
                    pagesFrom = totalPages - showAddPages * 2 - 2;
                    pagesTo = totalPages - 1;
                }
                
                if (pagesFrom == 2)
                    pagesFrom--;
                if (pagesFrom < 0)
                    pagesFrom = 0;
                if (pagesTo == totalPages - 3)
                    pagesTo++;
                
                if (pagesTo >= totalPages)
                    pagesTo = totalPages - 1;
            }
            
            var pagingTab1 = rightDocument.createElement("table");
            var pagingTbody1 = rightDocument.createElement("tbody");
            var pagingRow = rightDocument.createElement("tr");
            var pagingCellLeft = rightDocument.createElement("td");
            var pagingCellCenter = rightDocument.createElement("td");
            var pagingCellRight = rightDocument.createElement("td");
            pagingTab1.appendChild(pagingTbody1);
            pagingTbody1.appendChild(pagingRow);
            pagingRow.appendChild(pagingCellLeft);
            pagingRow.appendChild(pagingCellCenter);
            pagingRow.appendChild(pagingCellRight);
            
            var first = true;
            
            if (prevPageStart >= 0)
            {
                _addLink(rightDocument, pagingCellLeft, false, "javascript:loadItems('"+loadItemId+"','0');", "first", iconFirst, " ");
                _addLink(rightDocument, pagingCellLeft, false, "javascript:loadItems('"+loadItemId+"','"+prevPageStart+"');", "previous", iconPrevious, " ");
            }
            else
            {
                appendImgNode(rightDocument, pagingCellLeft, "", iconArrowReplacement);
                appendImgNode(rightDocument, pagingCellLeft, "", iconArrowReplacement);
            }
            
            if (nextPageStart < totalMatches)
            {
                _addLink(rightDocument, pagingCellRight, false, "javascript:loadItems('"+loadItemId+"','"+nextPageStart+"');", "next", iconNext, " ");
                _addLink(rightDocument, pagingCellRight, false, "javascript:loadItems('"+loadItemId+"','"+((totalPages - 1) * viewItems)+"');", "last", iconLast, " ");
            }
            else
            {
                appendImgNode(rightDocument, pagingCellRight, "", iconArrowReplacement);
                appendImgNode(rightDocument, pagingCellRight, "", iconArrowReplacement);
            }
            
            if (showPagingPages)
            {
                var pagingTab2 = rightDocument.createElement("table");
                var pagingTbody2 = rightDocument.createElement("tbody");
                pagingTab2.appendChild(pagingTbody2);
                var pagingPagesRow = rightDocument.createElement("tr");
                var pagingPagesCell = rightDocument.createElement("td");
                pagingPagesCell.setAttribute("colspan", "3");
                pagingTbody2.appendChild(pagingPagesRow);
                pagingPagesRow.appendChild(pagingPagesCell);
                
                var first = true;
                
                if (pagesFrom > 0)
                {
                    first = false;
                    var pagingLink = rightDocument.createElement("a");
                    pagingLink.setAttribute("href", "javascript:loadItems('"+loadItemId+"','0');");
                    pagingLink.appendChild(rightDocument.createTextNode(1));
                    pagingPagesCell.appendChild(pagingLink);
                    if (pagesFrom > 1)
                        pagingPagesCell.appendChild(rightDocument.createTextNode(" ..."));
                }
                
                for (var i = pagesFrom; i <= pagesTo; i++)
                {
                    if (first)
                        first = false;
                    else
                        pagingPagesCell.appendChild(rightDocument.createTextNode(" "));
                    
                    var pagingLink;
                    
                    if (i == thisPage)
                    {
                        pagingLink = rightDocument.createElement("strong");
                    }
                    else
                    {
                        pagingLink = rightDocument.createElement("a");
                        pagingLink.setAttribute("href", "javascript:loadItems('"+loadItemId+"','"+(i * viewItems)+"');");
                    }
                    pagingLink.appendChild(rightDocument.createTextNode( i + 1));
                    pagingPagesCell.appendChild(pagingLink);
                }
                
                if (pagesTo < totalPages - 1)
                {
                    var pagingLink = rightDocument.createElement("a");
                    pagingLink.setAttribute("href", "javascript:loadItems('"+loadItemId+"','"+((totalPages - 1) * viewItems)+"');");
                    pagingLink.appendChild(rightDocument.createTextNode(totalPages));
                    if (pagesTo < totalPages - 2)
                        pagingPagesCell.appendChild(rightDocument.createTextNode(" ... "));
                    else
                        pagingPagesCell.appendChild(rightDocument.createTextNode(" "));
                    pagingPagesCell.appendChild(pagingLink);
                    
                }
            }
            
        }
        
        var children = items[childType];
        var itemsEl = rightDocument.createElement("div");
        var topItemsEl = topRightDocument.createElement("div");
        itemsEl.setAttribute("class", "itemsEl");
        
        var topTopDiv  = topRightDocument.createElement("div");
        topTopDiv.setAttribute("class", "topDiv");
        topItemsEl.appendChild(topTopDiv);
        
        var contTable = topRightDocument.createElement("table");
        contTable.setAttribute("class", "contTable");
        var contTableBody = topRightDocument.createElement("tbody");
        contTable.appendChild(contTableBody);
        topTopDiv.appendChild(contTable);
        var contRow = topRightDocument.createElement("tr");
        contTableBody.appendChild(contRow);
        
        var leftDiv = topRightDocument.createElement("td");
        leftDiv.setAttribute("class", "contEntry");
        
        var contIcon = topRightDocument.createElement("img");
        leftDiv.appendChild(contIcon);
        
        var pathEl = topRightDocument.createElement("span");
        pathEl.setAttribute("class", "contText");
        leftDiv.appendChild(pathEl);
        
        var buttons = topRightDocument.createElement("td");
        buttons.setAttribute("class", "itemButtons");
        
        contRow.appendChild(leftDiv);
        contRow.appendChild(buttons);
        
        if (useFiles)
        {
            contIcon.setAttribute("src", iconContainer.src);
            contIcon.setAttribute("alt", "directory:");
            contIcon.setAttribute("width", iconContainer.width);
            contIcon.setAttribute("height", iconContainer.height);
            
            pathEl.appendChild(topRightDocument.createTextNode(" /Filesystem" + path + (path.charAt(path.length - 1) != '/' ? '/' : '')));
            
            var first = true
            first = _addLink(topRightDocument, buttons, first, "javascript:addItem('"+ofId+"');", "add", iconAdd);
            first = _addLink(topRightDocument, buttons, first, "javascript:editLoadAutoscanDirectory('"+ofId+"', true);", "add as autoscan dir", iconAddAutoscan);
        }
        else
        {
            var iconSrc = iconContainer;
            if (autoscanType == 'ui')
            {
                if (autoscanMode == 'inotify')
                    iconSrc = iconContainerAutoscanInotify;
                else
                    iconSrc = iconContainerAutoscanTimed;
            }
            
            if (autoscanType == 'persistent')
            {
                if (autoscanMode == 'inotify')
                    iconSrc = iconContainerAutoscanInotifyConfig;
                else
                    iconSrc = iconContainerAutoscanTimedConfig;
            }
            
            contIcon.setAttribute("src", iconSrc.src);
            contIcon.setAttribute("alt", "container:");
            contIcon.setAttribute("width", iconSrc.width);
            contIcon.setAttribute("height", iconSrc.height);
            
            pathEl.appendChild(topRightDocument.createTextNode(" /Database" + path + (path.charAt(path.length - 1) != '/' ? '/' : '')));
            
            var link;
            var first = true;
            var addLink = false;
            var editLink = false;
            var removeThisLink = false;
            var removeAllLink = false;
            var autoscanLink = false;
            
            if (lastNodeDb == 'd0')
            {
                addLink = true;
            }
            else if (lastNodeDb == 'd1')
            {
                editLink = true;
                autoscanLink = true;
            }
            else
            {
                if (isVirtual)
                {
                    addLink = true;
                    editLink = true;
                    if (! isProtected)
                    {
                        removeThisLink = true;
                        removeAllLink = true;
                    }
                }
                else
                if (! isProtected)
                {
                    removeThisLink = true;
                    autoscanLink = true;
                }
            }
            
            if (autoscanType != 'none')
                autoscanLink = true;
            
            if (addLink)
                first = _addLink(topRightDocument, buttons, first, "javascript:userAddItemStart();", "add Item", iconNewItem);
            if (editLink)
                first = _addLink(topRightDocument, buttons, first, "javascript:userEditItemStart('"+ofId+"');", "edit", iconEdit);
            if (removeThisLink)
                first = _addLink(topRightDocument, buttons, first, "javascript:removeItem('"+ofId+"', false);", "remove", iconRemoveThis);
            if (removeAllLink)
                first = _addLink(topRightDocument, buttons, first, "javascript:removeItem('"+ofId+"', true);", "remove all", iconRemoveAll);
            if (autoscanLink)
                first = _addLink(topRightDocument, buttons, first,  "javascript:editLoadAutoscanDirectory('"+ofId+"', false);", "change autoscan dir", iconEditAutoscan);
        }
        
        if (showPaging)
        {
            var pagingForm = rightDocument.createElement("form");
            pagingForm.setAttribute("name", "itemsPerPageForm1");
            var pagingSelect = rightDocument.createElement("select");
            pagingForm.appendChild(pagingSelect);
            pagingSelect.setAttribute("size", "1");
            pagingSelect.setAttribute("onchange", "changeItemsPerPage(1)");
            pagingSelect.setAttribute("name", "itemsPerPage1");
            
            pagingCellCenter.appendChild(pagingForm);
            
            itemsEl.appendChild(pagingTab1.cloneNode(true));
            if (showPagingPages)
                itemsEl.appendChild(pagingTab2.cloneNode(true));
            
            pagingForm.setAttribute("name", "itemsPerPageForm2");
            pagingSelect.setAttribute("onchange", "changeItemsPerPage(2)");
            pagingSelect.setAttribute("name", "itemsPerPage2");
        }
        
        var itemsTable = rightDocument.createElement("table");
        var itemsTableBody = rightDocument.createElement("tbody");
        itemsTable.appendChild(itemsTableBody);
        itemsEl.appendChild(itemsTable);
        for (var i = 0; i < children.length; i++) {
            var itemRow = rightDocument.createElement("tr");
            var item = children[i];
            var itemEntryTd = rightDocument.createElement("td");
            itemEntryTd.setAttribute("class", "itemEntry");
            var itemEntry;
            itemEntry = itemEntryTd;
            var itemLink = rightDocument.createElement("a");
            itemEntry.appendChild(itemLink);
            
            var itemButtonsTd = rightDocument.createElement("td");
            itemButtonsTd.setAttribute("class", "itemButtons");
            var itemButtons;
            itemButtons = itemButtonsTd;
            
            var itemText = rightDocument.createTextNode(useFiles ? item.firstChild.nodeValue : item['title']);
            itemLink.appendChild(itemText);
            itemRow.appendChild(itemEntryTd);
            itemRow.appendChild(itemButtonsTd);
            
            if (useFiles)
            {
                _addLink(rightDocument, itemButtons, true, "javascript:addItem(\""+item["id"]+"\");", "add", iconAdd);
            }
            else
            {
                if (!itemsProtected)
                {
                    _addLink(rightDocument, itemButtons, true, "javascript:removeItem(\""+item["id"]+"\", false);", "remove this", iconRemoveThis);
                    if (isVirtual)
                    {
                        _addLink(rightDocument, itemButtons, false, "javascript:removeItem(\""+item["id"]+"\", true);", "remove all", iconRemoveAll);
                    }
                }
                
                _addLink(rightDocument, itemButtons, false, "javascript:userEditItemStart('"+item["id"]+"');", "edit", iconEdit);
                
                itemLink.setAttribute("href", item['res']);
                
            }
            itemsTableBody.appendChild(itemRow);
        }
        
        if (showPaging)
        {
            if (showPagingPages)
                itemsEl.appendChild(pagingTab2);
            itemsEl.appendChild(pagingTab1);
        }
        
        if (useFiles) {
            $(fsItemRoot).children(':first').replaceWith(itemsEl);
            $(dbItemRoot).hide();
            $(fsItemRoot).show();
        } else {
            $(dbItemRoot).children(':first').replaceWith(itemsEl);
            $(fsItemRoot).hide();
            $(dbItemRoot).show();
        }
        $(topItemRoot).children(':first').replaceWith(topItemsEl);
        
       
        if (showPaging) {
            _addItemsPerPage(rightDocument.forms['itemsPerPageForm1'].elements['itemsPerPage1']);
            _addItemsPerPage(rightDocument.forms['itemsPerPageForm2'].elements['itemsPerPage2']);
        }
    }
}
function _addItemsPerPage(itemsPerPageEl) {
    if (itemsPerPageEl) { 
        for (var i = 0; i < itemOptions.length; i ++)
        {
            var itemCount = itemOptions[i];
            itemsPerPageEl.options[i] = new Option(
                itemCount,
                itemCount,
                false,
                itemCount == viewItems
            );
        }
    }
}

function _addLink(useDocument, addToElement, first, href, text, icon, seperator)
{
    
    var link = useDocument.createElement("a");
    addToElement.appendChild(link);
    link.setAttribute("href", href);
    
    if (icon)
        appendImgNode(useDocument, link, text, icon);
    else
        link.appendChild(useDocument.createTextNode(text));
    return false; // to set the next "first"
}

function addItem(itemId) {
    $.ajax({
        data: {
            req_type: 'add',
            object_id: itemId
        },
        success: function() {
            // if (!errorCheck(xml)) return;
            addUpdateTimer();
        }
    });
}

function userAddItemStart() {
    updateItemAddEditFields();
    $(itemRoot).hide();
    itemRoot = $('#item_add_edit_div')[0];
    $(itemRoot).show();
}

function userEditItemStart(objectId) {
    $.ajax({
        data: {
            req_type: 'edit_load',
            object_id: objectId
        },
        success: function(json) {
            // if (!errorCheck(xml)) return;
            var item = json['item'];
            updateItemAddEditFields(item);
            $(itemRoot).hide();
            itemRoot = $('#item_add_edit_div')[0];
            $(itemRoot).show();
            use_inactivity_timeout_short = true;
        }
    });
}

function updateItemAddEditFields(editItem) {
    var currentTypeOption;
    var form = rightDocument.forms['addEditItem'];
    var selectEl = form.elements['obj_type'];
    var submitEl = form.elements['submit'];
    if (editItem) {
        selectEl.disabled = false;
        submitEl.value = 'Add item...';
        currentTypeOption = selectEl.value;
        if (!currentTypeOption) {
            currentTypeOption = 'container';
        }
        form.action = 'javascript:itemAddEditSubmit();';
    } else {
        selectEl.disabled = true;
        submitEl.value = 'Update item...';
        currentTypeOption = editItem['obj_type'];
        var objectId = editItem['object_id'];
        selectEl.value = currentTypeOption;
        form.action = 'javascript:itemAddEditSubmit('+objectId+');';
    }
    
    if (!selectEl.options[0]) {
        // ATTENTION: These values need to be changed in src/cds_objects.h too.
        // Note: 'Active Item', 'External Link (URL)', 'Internal Link (Local URL)'
        // are also 'Items', so they have the item flag set too.
        var objTypeOptionsText = new Array('Container', 'Item', 'Active Item', 'External Link (URL)', 'Internal Link (Local URL)');
        var objTypeOptionsValue = new Array('container', 'item', 'active_item', 'external_url', 'internal_url');
        
        for (var i = 0; i < objTypeOptionsValue.length; ++i)
            selectEl.options[i] = new Option(
                objTypeOptionsText[i],
                objTypeOptionsValue[i],
                false, 
                (currentTypeOption && objTypeOptionsValue[i] == currentTypeOption)
                );
    }
    
    var fieldAr;
    var fieldNameAr;
    var defaultsAr;
    
    // using "if" instead of "switch" for compatibility reasons...
    if (currentTypeOption == 'container')
    {
        fieldAr = new Array('Title', 'Class');
        fieldNameAr = new Array('title', 'class');
        defaultsAr = new Array('', 'object.container');
    }
    else if (currentTypeOption == 'item')
    {
        fieldAr = new Array('Title', 'Location', 'Class', 'Description', 'Mimetype');
        fieldNameAr = new Array('title', 'location', 'class', 'description', 'mime-type');
        defaultsAr = new Array('', '', 'object.item', '', '');
    }
    else if (currentTypeOption == 'active_item')
    {
        fieldAr = new Array('Title', 'Location', 'Class', 'Description', 'Mimetype', 'Action Script', 'State');
        fieldNameAr = new Array('title', 'location', 'class', 'description', 'mime-type', 'action', 'state');
        defaultsAr = new Array('', '', 'object.item.activeItem', '', '', '', '');
    }
    else if (currentTypeOption == 'external_url')
    {
        fieldAr = new Array('Title', 'URL', 'Protocol', 'Class', 'Description', 'Mimetype');
        fieldNameAr = new Array('title', 'location', 'protocol', 'class', 'description', 'mime-type');
        defaultsAr = new Array('', '', 'http-get', 'object.item', '', '');
    }
    else if (currentTypeOption == 'internal_url')
    {
        fieldAr = new Array('Title', 'URL', 'Class', 'Description', 'Mimetype');
        fieldNameAr = new Array('title', 'location', 'class', 'description', 'mime-type');
        defaultsAr = new Array('', '', 'object.item', '', '');
    }
    
    var itemTbody = rightDocument.createElement('tbody');
    if (fieldAr && defaultsAr)
    {
        for (var i = 0; i < fieldAr.length; ++i)
        {
            var inputTr = rightDocument.createElement('tr');
            itemTbody.appendChild(inputTr);
            var inputTd = rightDocument.createElement('td');
            inputTr.appendChild(inputTd);
            inputTd.appendChild(rightDocument.createTextNode(fieldAr[i]+": "));
            
            var inputTd = rightDocument.createElement('td');
            inputTr.appendChild(inputTd);
            var inputEl = rightDocument.createElement('input');
            inputEl.setAttribute('type', 'text');
            inputEl.setAttribute('name', fieldNameAr[i]);
            if (editItem)
                inputEl.setAttribute('value', defaultsAr[i]);
            else
            {
                var obj = editItem[fieldNameAr[i]];
                inputEl.setAttribute('value', obj['value']);
                if(!obj['editable']) {
                    inputEl.setAttribute('disabled', 'disabled');
                }
            }
            
            inputTd.appendChild(inputEl);
        }
    }
    var oldNode = rightDocument.getElementById("item_add_edit_tbody");
    oldNode.parentNode.replaceChild(itemTbody, oldNode);
    itemTbody.setAttribute("id", "item_add_edit_tbody");
}

function itemAddEditSubmit(objectId) {
    itemChangeType('db');

    var req_type;
    var args = {};
    if (objectId) {
        req_type = 'edit_save';
        args['object_id'] = objectId;
    } else {
        req_type = 'add_object';
        args['parent_id'] = lastNodeDb.substr(1);
    }
    var form = rightDocument.forms['addEditItem'];

    formToArray(form, args);

    var ajaxData = {
        req_type: req_type, 
        object_id: objectId
    };
    $.extend(ajaxData, args);
    $.ajax({
        data: ajaxData,
        success: function() {
            window.setTimeout("getUpdates(true)", 800);
            folderChange(selectedNode);
        }
    });
}
function removeItem(itemId, all) {
    if (itemId == '0') {
        alert("Root container cannot be removed!");
        return;
    }
    
    if ('d'+itemId == selectedNode) {
        // current container will be removed, selecting parent...
        selectNode(getTreeNode(selectedNode).getParent().getID());
    }
    if (all)
        all_send="1";
    else
        all_send="0";
    
    use_inactivity_timeout_short = true;
    $.ajax({
        data: {
            req_type: 'remove', 
            object_id: itemId,
            all: all_send
        },
        success: function() {
            window.setTimeout("getUpdates(true)", 800);
            folderChange(selectedNode);
        }
    });
}

function changeItemsPerPage(formId) {
    var newViewItems = rightDocument.forms['itemsPerPageForm'+formId].elements['itemsPerPage'+formId].value;
    if (newViewItems != viewItems) {
        viewItems = newViewItems;
        $.cookie("viewItems", viewItems);
        folderChange(selectedNode);
    }
}

function cancelButtonPressed() {
    itemChangeType('db');
}

var autoscanId;
var autoscanFromFs;
var autoscanPersistent;

function showAutoscanDirs() {
    setUIContext('db');
    $.ajax({
        data: {
            return_type: 'xml',
            req_type: 'autoscan',
            action: 'list'
        },
        success: callback
    });
    function callback(xml) {
        if (!errorCheck(xml)) {
            return;
        }
        var $autoscansXMLel = $(xml).find('autoscans');
        var $autoscans = $($autoscansXMLel).find('autoscan');
        if ($autoscansXMLel.length <= 0 || $autoscans.lenth <= 0) {
            return;
        }
        
        var autoscanHTMLel = rightDocument.createElement("div");
        autoscanHTMLel.setAttribute("class", "itemsEl");
        var itemsTable = rightDocument.createElement("table");
        var itemsTableBody = rightDocument.createElement("tbody");
        itemsTable.appendChild(itemsTableBody);
        autoscanHTMLel.appendChild(itemsTable);
        
        $autoscans.each(function() {
            $this = $(this);
            var itemRow = rightDocument.createElement("tr");
            var itemEntryTd = rightDocument.createElement("td");
            itemEntryTd.setAttribute("class", "itemEntry");
            var itemEntry;
            itemEntry = itemEntryTd;

            
            var autoscanMode = $this.find('scan_mode').text();
            var autoscanFromConfig = $this.find('from_config').text() === '1';
            
            var icon;
            var altText;
            if (autoscanMode == "timed")
                appendImgNode(rightDocument, itemEntry, "Timed-Autoscan:", (autoscanFromConfig ? iconContainerAutoscanTimedConfig : iconContainerAutoscanTimed));
            else if (autoscanMode == "inotify")
                appendImgNode(rightDocument, itemEntry, "Inotify-Autoscan:", (autoscanFromConfig ? iconContainerAutoscanInotifyConfig : iconContainerAutoscanInotify));
            
            var itemText = rightDocument.createTextNode(" " + $this.find('location').text());
            itemEntry.appendChild(itemText);
            
            var itemButtonsTd = rightDocument.createElement("td");
            itemButtonsTd.setAttribute("class", "itemButtons");
            var itemButtons;
            itemButtons = itemButtonsTd;
            
            itemRow.appendChild(itemEntryTd);
            itemRow.appendChild(itemButtonsTd);
            
            _addLink(rightDocument, itemButtons, true, "javascript:editLoadAutoscanDirectory('"+$this.attr('objectID')+"', false);", "edit", iconEditAutoscan);
            
            itemsTableBody.appendChild(itemRow);
        });
        $(itemRoot).hide();
        itemRoot = rightDocument.getElementById('autoscan_list_div');
        itemRoot.replaceChild(autoscanHTMLel, itemRoot.firstChild);
        $(itemRoot).show();
    }
}

function editLoadAutoscanDirectory(objectId, fromFs) {
    $.ajax({
        data: {
            req_type: 'autoscan',
            action: 'as_edit_load',
            object_id: objectId,
            from_fs: fromFs
        },
        success: callback
    });
    function callback(xml) {
        if (!errorCheck(xml)) {
            return;
        }
        var $autoscan = $(xml).find('autoscan');
        
        updateAutoscanEditFields($autoscan);
        scanModeChanged(true);
        
        if (autoscanPersistent) {
            $('#autoscan_persistent_message').show();
            $('#autoscan_set_button').hide();
        } else {
            $('#autoscan_persistent_message').hide();
            $('#autoscan_set_button').show();
        }
        $(itemRoot).hide(); 
        itemRoot = $('#autoscan_div')[0];
        $(itemRoot).show();
    }
}

function updateAutoscanEditFields($autoscan) {
    autoscanId = $autoscan.find('object_id').text();
    autoscanFromFs = $autoscan.find('from_fs').text() === '1';
    var elements = rightDocument.forms['autoscanForm'].elements;
    var scan_mode_checked = 'scan_mode_' + $autoscan.find('scan_mode').text();
    var scan_level_checked = 'scan_level_' + $autoscan.find('scan_level').text();
    var persistent = $autoscan.find('persistent').text();
    if (persistent == '1') {
        autoscanPersistent = true;
    } else {
        autoscanPersistent = false;
    }
    elements[scan_mode_checked].checked = true;
    elements[scan_level_checked].checked = true;
    elements['recursive'].checked = $autoscan.find('recursive').text() === '1';
    elements['hidden'].checked = $autoscan.find('hidden').text() === '1';
    elements['interval'].value = $autoscan.find('interval').text();
}

function autoscanSubmit() {
    itemChangeType('db');
    var form = rightDocument.forms['autoscanForm'];
    var args = {};
    args['action'] = 'as_edit_save';
    args['object_id'] = autoscanId;
    args['from_fs'] = (autoscanFromFs ? '1' : '0');
    formToArray(form, args);
    if (args['scan_mode'] == 'none') {
        use_inactivity_timeout_short = true;
    }
    $.extend(args, { req_type: 'autoscan' });
    $.ajax({
        data: args,
        success: function() {
            folderChange(selectedNode);
        }
    });
}
function scanModeChanged(filled) {
    var elements = rightDocument.forms['autoscanForm'].elements;
    if (autoscanPersistent)
    {
        elements['scan_mode_none'].disabled = true;
        elements['scan_mode_timed'].disabled = true;
        elements['scan_mode_inotify'].disabled = true;
    }
    else
    {
        elements['scan_mode_none'].disabled = false;
        elements['scan_mode_timed'].disabled = false;
        elements['scan_mode_inotify'].disabled = false;
    }
    
    var scan_level_text = rightDocument.getElementById("scan_level_text");
    if (autoscanPersistent || elements['scan_mode_none'].checked)
    {
        elements['scan_level_basic'].disabled = true;
        elements['scan_level_full'].disabled = true;
        elements['recursive'].disabled = true;
        elements['hidden'].disabled = true;
        elements['interval'].disabled = true;
        scan_level_text.replaceChild(rightDocument.createTextNode("Scan Level:"), scan_level_text.firstChild);
    }
    else
    {
        elements['scan_level_basic'].disabled = false;
        elements['scan_level_full'].disabled = false;
        var scan_interval_row = rightDocument.getElementById("scan_interval_row");
        if (elements['scan_mode_inotify'].checked)
        {
            scan_level_text.replaceChild(rightDocument.createTextNode("Initial Scan:"), scan_level_text.firstChild);
            if (! filled)
                elements['scan_level_basic'].checked = true;
            $(scan_interval_row).hide();
        }
        else
        {
            scan_level_text.replaceChild(rightDocument.createTextNode("Scan Level:"), scan_level_text.firstChild);
            if (! filled)
                elements['scan_level_full'].checked = true;
            $(scan_interval_row).show();
        }
        
        elements['recursive'].disabled = false;
        elements['hidden'].disabled = false;
        if (elements['scan_mode_timed'].checked)
        {
            elements['interval'].disabled = false;
            if (elements['interval'].value == '0')
                elements['interval'].value = '1800';
        }
        else
            elements['interval'].disabled = true;
    }
}
var currentTaskID = -1;

var pollInterval;

// will be set by getConfigCallback() (auth.js)
var pollWhenIdle = false;
var pollIntervalTime = 2000;
var showTooltips = true;

function updateCurrentTask(taskEl) {
    var taskID = -1;
    if (taskEl) {
        taskID = taskEl.getAttribute('id');
    }
    if (taskID != currentTaskID) {
        currentTaskID = taskID;

        var $currentTaskTdEl = $('#currentTaskTd');
        if (taskID == -1) {
            if (! pollWhenIdle) {
                clearPollInterval();
            }
            $currentTaskTdEl.hide();
        }
        else {
            var currentTaskTxtEl = $('#currentTaskText').children(':first');
            currentTaskTxtEl.replaceData(0, currentTaskTxtEl.length, taskEl.firstChild.data);
            var $cancelCurrentTaskEl = $('#cancelCurrentTask');
            var $cancelCurrentTaskPlaceholderEl = $('#cancelCurrentTaskPlaceholder');
            if (taskEl.getAttribute("cancellable") == "1") {
                $cancelCurrentTaskPlaceholderEl.hide();
                $cancelCurrentTaskEl.show();
            } else {
                $cancelCurrentTaskEl.hide();
                $cancelCurrentTaskPlaceholderEl.show();
            }
            $currentTaskTdEl.show();
            if (!pollWhenIdle) {
                startPollInterval();
            }
        }
    }
}

function clearPollInterval()
{
    if (pollInterval)
    {
        window.clearInterval(pollInterval);
        pollInterval = false;
    }
}

function startPollInterval()
{
    if (! pollInterval)
        pollInterval = window.setInterval("getUpdates(false)", pollIntervalTime);
}

function cancelCurrentTask()
{
    if (currentTaskID != -1)
        cancelTask(currentTaskID);
}

function cancelTask(taskID) {
    $.ajax({
        data: {
            req_type: 'tasks',
            action: 'cancel',
            task_id: taskID
        }
    });
}




function setUIContext(context) {
    $('#context_switcher > button').removeClass('selected');
    $('#context_switcher > button[value=' + context + ']').addClass('selected');
    TYPE = context;
    $.cookie('TYPE', context);
    setTreeContext(context);
    itemChangeType(context);
}
