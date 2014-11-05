var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var timers = require("sdk/timers");
var _ = require("sdk/l10n").get;
var prefs = require("sdk/simple-prefs").prefs;
var store = require("sdk/simple-storage").storage;
var request = require("sdk/request").Request;
var css = require("css");
//var style = css.load('./css/style.css');
var style = css.load('resource://jid1-djoid8yzzksqlq-at-jetpack/experium-addon/data/style.css');
var tb = require("toolbarbutton");
var {Cc, Ci} = require("chrome");

var Experium = new ExperiumBase();
var loadingAnimation = new LoadingAnimation();

var toolbarButton = tb.ToolbarButton({
    id: "experium-bar",
    label: "experium-bar",
    badge: "!",
    tooltiptext: _("loginReq"),
    onClick: handleClick
});

toolbarButton.moveTo({
    toolbarID: "nav-bar"
});

function LoadingAnimation() {
    this.timerId = 0;
    this.current = 0;
    this.maxCount = 8;
    this.maxDot = 4;
}

LoadingAnimation.prototype.paintFrame = function() {
    var text = "";
    for (var i = 0; i < this.maxDot; i++) {
        text += (i <= this.current) ? "." : "";
    }
    setBadge(text);
    this.current++;
    if (this.current == this.maxCount)
        this.current = 0;
}

LoadingAnimation.prototype.start = function() {
    if (this.timerId)
        return;

    var self = this;
    this.timerId = timers.setInterval(function() {
        self.paintFrame();
    }, 300);
}

LoadingAnimation.prototype.stop = function() {
    if (!this.timerId)
        return;

    timers.clearInterval(this.timerId);
    this.timerId = 0;
}

function ExperiumBase() {
    this.load = 0;
    this.intervalId;
    this.cheking = false;
    this.counter = {
        project: store.project || 0,
        person: store.person || 0
    };
    this.last = {
        project: store.projectLast || 0,
        person: store.personLast || 0
    };
}

ExperiumBase.prototype.getLast = function(type) {
    return this.last[type];
}

ExperiumBase.prototype.setLast = function(type, id) {
    store[type+'Last'] = this.last[type] = id;
}

ExperiumBase.prototype.getCount = function(type) {
    return this.counter[type];
}

ExperiumBase.prototype.setCount = function(type, count) {
    store[type] = this.counter[type] = count;
}

ExperiumBase.prototype.getUrl = function() {
    return prefs.baseUrl;
}

ExperiumBase.prototype.getServerUrl = function() {
    return prefs.serverUrl;
}

ExperiumBase.prototype.getRequestUrl = function(type) {
    var q = '';
    switch(type) {
        case "person":
            q = "approval?inwork=1";
            break;
        case "project":
            q = "approval/project?inwork=1";
            break;
    }
    return this.getServerUrl() + q;
}

ExperiumBase.prototype.isUrl = function(url) {
    return url.indexOf(prefs.baseUrl) != -1;
}

ExperiumBase.prototype.isCookie = function(url) {
    return prefs.baseUrl.indexOf(url) != -1;
}

function toMinutes(timer) {
    return parseInt(timer) * 60 * 1000;
}

function listTabs() {
    var tabs = require("sdk/tabs");
    for (let tab of tabs) {
        if (Experium.isUrl(tab.url)) {
            tab.activate();
            return;
        }
    }
    tabs.open(Experium.getUrl());
}

function handleClick(state) {
    listTabs();
}

function updateIcon(isSecure) {
    if (isSecure) {
        setActive();
        setTitle(_("title_message", Experium.getCount('person'), Experium.getCount('project')));
        setBadge((Experium.getCount('person') || '_') + ' ' + (Experium.getCount('project') || '_'));
    } else {
        setBadge('!');
        setTitle(_("loginReq"));
        setSecure();
    }
}

function setActive() {
    toolbarButton.type = 'active';
}

function setSecure() {
    toolbarButton.type = 'secure';
}

function setBadge(counter) {
    toolbarButton.badge = counter;
}

function setTitle(title) {
    toolbarButton.tooltiptext = title;
}

function checkToken() {
    var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var uri = ios.newURI("http://experium-interface.loc:9500/#/", null, null);
    var cookieSvc = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);
    var cookies = cookieSvc.getCookieString(uri, null);
    var cookieMgr = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);

    var token = null;
    for (var e = cookieMgr.enumerator; e.hasMoreElements();) {
        var cookie = e.getNext().QueryInterface(Ci.nsICookie);
        if(Experium.isCookie(cookie.host) && cookie.name == 'token') {
            token = cookie.value;
        }
    }

    if (token) {
        store.token = "Token "+token;
        return true;
    } else {
        delete store.token;
        return false;
    }
}

function startRequest(showLoadingAnimation) {
    if (checkToken()) {
        if (Experium.load == 0) {
            Experium.load = 2;

            function stopLoadingAnimation() {
                if (showLoadingAnimation) loadingAnimation.stop();
            }

            if (showLoadingAnimation)
                loadingAnimation.start();

            var onSuccess = function (count,type,response) {
                stopLoadingAnimation();
                Experium.load = (Experium.load == 0)? 0: Experium.load-1;
                Experium.setCount(type, count);
                updateIcon(true);
            };

            var onError = function (type, isAuth) {
                stopLoadingAnimation();
                Experium.load = (Experium.load == 0)? 0: Experium.load-1;
                updateIcon(isAuth);
                if(!isAuth && Experium.load == 0) authCheck();
            };

            getResponse(onSuccess, onError, 'project');
            getResponse(onSuccess, onError, 'person');
        }
    } else {
        timers.clearInterval(Experium.intervalId);
        Experium.intervalId = null;
        if (!Experium.cheking) {
            //start new timer
            authCheck();
            updateIcon(false);
        }
    }
}

function getResponse(onSuccess, onError, type) {
    function handleResponse(response) {
        if (response.status == 200 && response.json) {
            onSuccess(response.json.length, type, response.json);
        } else {
            if (response.status == 401 || response.status == 403)
                onError(type,false);
            else
                onError(type,true);
        }
    }

    var query = request({
        url: Experium.getRequestUrl(type),
        onComplete: handleResponse
    });

    query.headers.Authorization = store.token;
    query.get();
}

function authCheck() {
    Experium.cheking = true;
    if (checkToken()) {
        Experium.cheking = false;
        initRequest();
    } else {
        timers.setTimeout(authCheck, 3000);
    }
}

function initRequest() {
    if (!Experium.intervalId){
        timers.clearInterval(Experium.intervalId);
    }
    Experium.intervalId = timers.setInterval(startRequest, toMinutes(prefs.requestTimer));
    startRequest(true);
}

initRequest();

tabs.on('ready', function(tab) {
    if (Experium.isUrl(tab.url)){
        initRequest();
    }
});

tabs.on('activate', function(tab) {
    if (Experium.isUrl(tab.url)){
        initRequest();
    }
});

tabs.on('open', function(tab) {
    if (Experium.isUrl(tab.url)){
        initRequest();
    }
});