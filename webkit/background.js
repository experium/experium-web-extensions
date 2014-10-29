var animationFrames = 36;
var animationSpeed = 10;
var requestTimer = 1000;
var pollIntervalMin = 5;  // 5 minutes
var pollIntervalMax = 60;  // 1 hour
var rotation = 0;
var loadingAnimation = new LoadingAnimation();

var canvas = document.getElementById('canvas');
var loggedInImage = document.getElementById('logged_in');
var canvasContext = canvas.getContext('2d');
var oldChromeVersion = !chrome.runtime;

var activeIcon = "icon_active.png";
var secureIcon = "icon_secure.png";
var colorBadge = "#2598d5";
var colorSecureBadge = "#bfbfbf";

function getExperiumUrl() {
  return "http://experium-interface.loc:9500/";
}

function getLastId() {
    return localStorage.lastId;
}

function getUpdateUrl(type) {
    switch (type){
        case 'project': return 'http://msmeta6.experium.ru/SupportSrv/SupportSrv.svc/Support/approval/project?inwork=1';
        case 'person':  return 'http://msmeta6.experium.ru/SupportSrv/SupportSrv.svc/Support/approval?inwork=1';
        default:        return false;
    }

}

function isExperiumUrl(url) {
  return url.indexOf(getExperiumUrl()) == 0;
}

function isExperiumNavigateUrl( url) {
    return  url.indexOf(getExperiumUrl() + "#/approval/") == 0;
}

function LoadingAnimation() {
    this.timerId_ = 0;
    this.maxCount_ = 8;  // Total number of states in animation
    this.current_ = 0;  // Current state
    this.maxDot_ = 4;  // Max number of dots in animation
}

LoadingAnimation.prototype.paintFrame = function() {
    var text = "";
    for (var i = 0; i < this.maxDot_; i++) {
        text += (i == this.current_) ? "." : " ";
    }
    if (this.current_ >= this.maxDot_)
        text += "";
    chrome.browserAction.setBadgeBackgroundColor({color:colorSecureBadge});
    chrome.browserAction.setBadgeText({text:text});
    this.current_++;
    if (this.current_ == this.maxCount_)
        this.current_ = 0;
}

LoadingAnimation.prototype.start = function() {
    if (this.timerId_)
        return;

    var self = this;
    this.timerId_ = window.setInterval(function() {
        self.paintFrame();
    }, 100);
}

LoadingAnimation.prototype.stop = function() {
    if (!this.timerId_)
        return;

    window.clearInterval(this.timerId_);
    this.timerId_ = 0;
}

function goToIndex() {
    if (!localStorage.hasOwnProperty('token')) {
        //chrome.tabs.create({url: getExperiumUrl()});
    }

    chrome.tabs.getAllInWindow(undefined, function(tabs) {
        for (var i = 0, tab; tab = tabs[i]; i++) {
            if (tab.url && isExperiumUrl(tab.url)) {
                chrome.tabs.update(tab.id, {selected: true});
                startRequest({scheduleRequest:false, showLoadingAnimation:false});
                return;
            }
        }
        chrome.tabs.create({url: getExperiumUrl()});
    });
}

function updateIcon() {
    if (!localStorage.token) {
        chrome.browserAction.setIcon({path: secureIcon});
        chrome.browserAction.setBadgeBackgroundColor({color:colorSecureBadge});
        chrome.browserAction.setBadgeText({text:"!"});
        chrome.browserAction.setTitle({ title: chrome.i18n.getMessage("noToken") });
        localStorage.personUnread = null;
        localStorage.projectUnread = null;
    } else {
        chrome.browserAction.setTitle({ title: chrome.i18n.getMessage("extTitle") });
        var count = (parseInt(localStorage.personUnread) || "-") + " " + (parseInt(localStorage.projectUnread) || "-");
        chrome.browserAction.setIcon({path: activeIcon});
        chrome.browserAction.setBadgeBackgroundColor({color:colorBadge});
        chrome.browserAction.setBadgeText({
            text:  count  != 0 ? count.toString() : ""
        });
    }
}

function scheduleRequest() {
    var randomness = Math.random() * 2;
    var exponent = Math.pow(2, localStorage.requestFailureCount || 0);
    var multiplier = Math.max(randomness * exponent, 1);
    var delay = Math.min(multiplier * pollIntervalMin, pollIntervalMax);
    delay = Math.round(delay);

    if (oldChromeVersion) {
        if (requestTimerId) {
            window.clearTimeout(requestTimerId);
        }
        requestTimerId = window.setTimeout(onAlarm, delay*60*1000);
    } else {
        chrome.alarms.create('refresh', {periodInMinutes: delay});
    }
}

function startRequest(params) {
    if (params && params.scheduleRequest) scheduleRequest();

    function stopLoadingAnimation() {
        if (params && params.showLoadingAnimation) loadingAnimation.stop();
    }

    if (params && params.showLoadingAnimation)
        loadingAnimation.start();

    checkToken(startLoad.bind(null,stopLoadingAnimation));
}

function startLoad(stopLoadingAnimation) {
    if (localStorage.hasOwnProperty('token') && localStorage.load == 0) {
        var onSuccess = function (count,type) {
            stopLoadingAnimation();
            updateUnreadCount(count, type);
            localStorage.load = (localStorage.load == 0)? 0: localStorage.load-1;
        };

        var onError = function () {
            stopLoadingAnimation();
            delete localStorage.projectUnread;
            updateIcon();
            localStorage.load = (localStorage.load == 0)? 0: localStorage.load-1;
        };

        localStorage.load = 2;

        getInboxCount(
            onSuccess,
            onError,
            'project'
        );

        getInboxCount(
            onSuccess,
            onError,
            'person'
        );
    } else if (localStorage.load == 0) {
        stopLoadingAnimation();
        updateIcon();
        if(!window.cheking) authCheck();
    }
}

function restartRequest() {
    if (localStorage.hasOwnProperty('token')) {
        window.cheking = false;
        startRequest({scheduleRequest: false, showLoadingAnimation:true});
    } else {
        setTimeout(authCheck,requestTimer);
    }
}

function authCheck() {
    window.cheking = true;
    checkToken(restartRequest);
}

function checkToken(callback) {
    chrome.cookies.get({url: getExperiumUrl(),name: "token"}, function(cookie) {
        if (cookie) {
            localStorage.token = cookie.value;
        } else {
            delete localStorage.token;
        }
        callback();
    });
}

function drawIconAtRotation() {
    canvasContext.save();
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.translate(
        Math.ceil(canvas.width/2),
        Math.ceil(canvas.height/2));
    canvasContext.rotate(2*Math.PI*ease(rotation));
    canvasContext.drawImage(loggedInImage,
        -Math.ceil(canvas.width/2),
        -Math.ceil(canvas.height/2));
    canvasContext.restore();

    chrome.browserAction.setIcon({imageData:canvasContext.getImageData(0, 0,
        canvas.width,canvas.height)});
}

function getInboxCount(onSuccess, onError, type) {
    var xhr = new XMLHttpRequest();

    function handleSuccess(count) {
        localStorage.requestFailureCount = 0;
        if (onSuccess)
            onSuccess(count,type);
    }

    var invokedErrorCallback = false;
    function handleError() {
        ++localStorage.requestFailureCount;
        delete localStorage.token;
        if (onError && !invokedErrorCallback)
            onError();
        invokedErrorCallback = true;
    }

    try {
        xhr.onreadystatechange = function() {
            if (xhr.readyState != 4)
                return;

            if (xhr.response) {
                var response = JSON.parse(xhr.response);

                if (response.length) {
                    handleSuccess(response.length);
                    return;
                }
            }

            handleError();
        };

        xhr.onerror = function(error) {
            handleError();
        };
        xhr.open("GET", getUpdateUrl(type), true);
        xhr.setRequestHeader('Authorization', localStorage.token);
        xhr.send(null);
    } catch(e) {
        handleError();
    }
}

function updateUnreadCount(count, type) {
    var changed = localStorage[type+'Unread'] != count;
    localStorage[type+'Unread'] = count;
    updateIcon();
    if (changed)
        animateFlip();
}

function ease(x) {
    return (1-Math.sin(Math.PI/2+x*Math.PI))/2;
}

function animateFlip() {
    rotation += 1/animationFrames;
    drawIconAtRotation();

    if (rotation <= 1) {
        setTimeout(animateFlip, animationSpeed);
    } else {
        rotation = 0;
        updateIcon();
    }
}

function onInit() {
    localStorage.requestFailureCount = 0;  // used for exponential backoff
    localStorage.load = 0;
    startRequest({scheduleRequest:true, showLoadingAnimation:true});
    if (!oldChromeVersion) {
        // TODO(mpcomplete): We should be able to remove this now, but leaving it
        // for a little while just to be sure the refresh alarm is working nicely.
        chrome.alarms.create('watchdog', {periodInMinutes:5});
    }
}

function onAlarm(alarm) {
    if (alarm && alarm.name == 'watchdog') {
        onWatchdog();
    } else {
        startRequest({scheduleRequest:true, showLoadingAnimation:false});
    }
}

function onWatchdog() {
    chrome.alarms.get('refresh', function(alarm) {
        if (!alarm) {
            startRequest({scheduleRequest:true, showLoadingAnimation:false});
        }
    });
}

if (oldChromeVersion) {
    updateIcon();
    onInit();
} else {
    chrome.runtime.onInstalled.addListener(onInit);
    chrome.alarms.onAlarm.addListener(onAlarm);
}

var filters = {
    // TODO(aa): Cannot use urlPrefix because all the url fields lack the protocol
    // part. See crbug.com/140238.
    url: [{urlContains: getExperiumUrl().replace(/^https?\:\/\//, '')}]
};

function onNavigate(details) {
    if (details.url && isExperiumUrl(details.url)) {
        startRequest({scheduleRequest:false, showLoadingAnimation:false});
    }
}

if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
    chrome.webNavigation.onReferenceFragmentUpdated) {
    chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate, filters);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(
        onNavigate, filters);
} else {
    chrome.tabs.onUpdated.addListener(function(_, details) {
        onNavigate(details);
    });
}

chrome.browserAction.onClicked.addListener(goToIndex);

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(function() {
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
    updateIcon();
  });
} else {
  chrome.windows.onCreated.addListener(function() {
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
    updateIcon();
  });
}
