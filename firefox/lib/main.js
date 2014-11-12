var buttons       = require('sdk/ui/button/action');
var tabs          = require("sdk/tabs");
var timers        = require("sdk/timers");
var translate     = require("sdk/l10n").get;
var prefs         = require("sdk/simple-prefs").prefs;
var store         = require("sdk/simple-storage").storage;
var request       = require("sdk/request").Request;
var notifications = require("sdk/notifications");
var addon         = require("sdk/self");
var css           = require("css");
var tb            = require("toolbarbutton");
var {Cc, Ci}      = require("chrome");

var style = css.load(addon.data.url('style.css'));
var Experium = new ExperiumBase();
var loadingAnimation = new LoadingAnimation();

var secureBadge = " ! ";
var toolbarButton = tb.ToolbarButton({
    id: "experium-bar",
    label: "experium-bar",
    badge: secureBadge,
    tooltiptext: translate("loginReq"),
    onClick: handleClick
});

toolbarButton.moveTo({
    toolbarID: "nav-bar"
});

function LoadingAnimation() {
    this.timerId  = 0;
    this.current  = 0;
    this.maxCount = 8;
    this.maxDot   = 4;
}

LoadingAnimation.prototype.paintFrame = function() {
    var text = "";
    for (var i = 0; i < this.maxDot; i++) {
        text += (i == this.current) ? "." : " ";
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
    }, 100);
}

LoadingAnimation.prototype.stop = function() {
    if (!this.timerId)
        return;

    timers.clearInterval(this.timerId);
    this.timerId = 0;
}

var nameFilter = function(object, lastNameFirst) {
    return object.lastName + " " + object.middleName + " " + object.firstName;
}

function ExperiumBase() {
    this.load       = 0;
    this.intervalId;
    this.cheking    = false;
    this.counter    = {
        project: store.project || 0,
        person:  store.person || 0
    };
    this.messages = 0;
    this.last = {
        project: store.projectLast || 0,
        person:  store.personLast || 0
    };
    this.typesConfig = {
        person: {
            link:  "approval/person/",
            query: "approval?inwork=1",
            notyText: function(data) { return translate("personNew", nameFilter(data,true), data.projectName);}
        },
        project: {
            link:  "approval/project/",
            query: "approval/project?inwork=1",
            notyText: function(data) { return translate("projectNew", data.position);}
        }
    };
}

ExperiumBase.prototype.getMessage = function(type,data) {
    return this.typesConfig[type].notyText(data);
}

ExperiumBase.prototype.getLast = function(type) {
    return this.last[type];
}

ExperiumBase.prototype.setLast = function(type, jsonObj) {
    var last = 0;
    for (var key in jsonObj){
        if (jsonObj.hasOwnProperty(key)){
            if (this.last[type] && jsonObj[key].id > this.last[type]){
                showMessage(jsonObj[key], type, this.messages);
                this.messages++;
            }

            last = jsonObj[key].id;
        }
    }

    store[type + 'Last'] = this.last[type] = last;
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
    return this.getServerUrl() + this.typesConfig[type].query;
}

ExperiumBase.prototype.getRedirectController = function(type) {
    return this.typesConfig[type].link;
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

function openExperiumTab() {
    for (let tab of tabs) {
        if (Experium.isUrl(tab.url)) {
            tab.activate();
            return tab;
        }
    }
    return tabs.open(Experium.getUrl());
}

function getExperiumTab() {
    for (let tab of tabs) {
        if (Experium.isUrl(tab.url)) {
            return tab;
        }
    }
    return false;
}

function isOpenExperiumTab() {
     return Experium.isUrl(tabs.activeTab.url);
}

function handleClick(state) {
    //TODO popups
    openExperiumTab();
}

function showMessage(data, type, count) {
    var link = Experium.getUrl() + Experium.getRedirectController(type) + data.id;
    var redirect = function (link) {
        var tab = getExperiumTab();
        if (tab) {
            tab.activate();
            tab.url = link;
        } else {
            tabs.open(link);
        }
    };

    if (!isOpenExperiumTab() && prefs.showMessages) {
        //timer fix only one message for firefox add-on
        timers.setTimeout(notifications.notify.bind(this, {
                    title:   translate("messageTitle"),
                    text:    Experium.getMessage(type, data),
                    iconURL: addon.data.url("icon_message.png"),
                    onClick: redirect.bind(this,link)
                }),
            count * 5000);
    }
}

function updateIcon(isSecure) {
    if (isSecure) {
        setActive();
        setTitle(translate("title_message", Experium.getCount("person"), Experium.getCount("project")));
        setBadge((Experium.getCount("person") || '_') + ' ' + (Experium.getCount("project") || "_"));
    } else {
        setBadge(secureBadge);
        setTitle(translate("loginReq"));
        setSecure();
    }
}

function setActive() {
    toolbarButton.type = "active";
}

function setSecure() {
    toolbarButton.type = "secure";
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
        return store.token;
    }
}

function startRequest(showLoadingAnimation) {
    if (checkToken()) {
        if (Experium.load == 0) {
            Experium.load = 2;
            Experium.messages = 0;

            function stopLoadingAnimation() {
                if (showLoadingAnimation) loadingAnimation.stop();
            }

            if (showLoadingAnimation)
                loadingAnimation.start();

            var onSuccess = function (count, type, response) {
                stopLoadingAnimation();
                Experium.load = (Experium.load == 0)? 0: Experium.load-1;
                Experium.setCount(type, count);
                Experium.setLast(type, response);
                updateIcon(true);
            };

            var onError = function (type, isAuth) {
                stopLoadingAnimation();
                Experium.load = (Experium.load == 0)? 0: Experium.load-1;
                updateIcon(isAuth);
                if (!isAuth && Experium.load == 0){
                    authCheck();
                }
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
        initRequest(true);
    } else {
        timers.setTimeout(authCheck, 3000);
    }
}

function initRequest(loading) {
    if (!Experium.intervalId){
        timers.clearInterval(Experium.intervalId);
    }
    Experium.intervalId = timers.setInterval(startRequest, toMinutes(prefs.requestTimer));
    startRequest(loading);
}

initRequest(true);

tabs.on('ready', function(tab) {
    if (Experium.isUrl(tab.url)) {
        initRequest(false);
    }
});

tabs.on('activate', function(tab) {
    if (Experium.isUrl(tab.url)){
        initRequest(false);
    }
});

tabs.on('open', function(tab) {
    if (Experium.isUrl(tab.url)){
        initRequest(false);
    }
});