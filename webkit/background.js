var animationFrames = 36;
var animationSpeed = 10;
var requestTimer = 3000;
var rotation = 0;
var loadingAnimation = new LoadingAnimation();

var canvas = document.getElementById('canvas');
var loggedInImage = document.getElementById('logged_in');
var canvasContext = canvas.getContext('2d');

var onClickRedirect = {};
var typesConfig = {
    person: {
        link: '#/approval/person/',
        query: 'approval?approved=0&canceled=0&inwork=1&rejected=0',
        notyText: function(data) {
            return chrome.i18n.getMessage('projectNew', [nameFilter(data,true), data.projectName]);
        }
    },
    project: {
        link: '#/approval/project/',
        query: 'approval/project?approved=0&canceled=0&inwork=1&rejected=0',
        notyText: function(data) {
            return chrome.i18n.getMessage('projectNew', [data.position]);
        }
    }
};

var activeIcon = 'icon_active.png';
var secureIcon = 'icon_secure.png';
var colorBadge = '#2598d5';
var colorSecureBadge = '#bfbfbf';
var secureBadge = ' ! ';
function getExperiumUpdateTimer() {
    return (localStorage.updateTimer || config.updateTimer) * 60 * 1000;
}

function getExperiumUrl() {
    return localStorage.baseUrl || config.baseUrl;
}

function getExperiumServerUrl() {
    return localStorage.serverUrl || config.serverUrl;
}

function getExperiumShowMessages() {
    var checked = localStorage.showMessages || config.showMessages;
    return checked === 'true';
}

function getUpdateUrl(type) {
    return getExperiumServerUrl() + typesConfig[type].query;
}

function getRedirectController(type) {
    return getExperiumUrl() + typesConfig[type].link;
}

function getTranslateMessage(type, data) {
    return typesConfig[type].notyText(data);
}

function nameFilter(data) {
    return data.lastName + " " + data.middleName + " " + data.firstName;
}

function isExperiumUrl(url) {
  return url.indexOf(getExperiumUrl()) == 0;
}

function isExperiumNavigateUrl(url) {
    return  url.indexOf(getExperiumUrl() + '#/approval/') == 0;
}

function resetStorage() {
    delete localStorage.personUnread;
    delete localStorage.projectUnread;
    delete localStorage.personUnreadLast;
    delete localStorage.projectUnreadLast;
    delete localStorage.token;
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
        text += (i == this.current_) ? '.' : ' ';
    }
    if (this.current_ >= this.maxDot_)
        text += "";

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
    chrome.tabs.getAllInWindow(undefined, function(tabs) {
        for (var i = 0, tab; tab = tabs[i]; i++) {
            if (tab.url && isExperiumUrl(tab.url)) {
                chrome.tabs.update(tab.id, {selected: true});
                startRequest(false);
                return;
            }
        }
        chrome.tabs.create({
            url: getExperiumUrl()
        });
    });
}


function updateIcon(noError) {
    if (noError) {
        chrome.browserAction.setTitle({
            title: chrome.i18n.getMessage('extTitle', [(parseInt(localStorage.personUnread) || '_'), (parseInt(localStorage.projectUnread) || '_')])
        });
        chrome.browserAction.setIcon({
            path: activeIcon
        });
        chrome.browserAction.setBadgeBackgroundColor({
            color:colorBadge
        });
    } else {
        chrome.browserAction.setIcon({
            path: secureIcon
        });
        chrome.browserAction.setBadgeBackgroundColor({
            color: colorSecureBadge
        });
        chrome.browserAction.setTitle({
            title: chrome.i18n.getMessage('noToken')
        });
    }

    if ((localStorage.personUnread || localStorage.projectUnread ) && localStorage.token) {
        var count = (parseInt(localStorage.personUnread) || '_') + ' ' + (parseInt(localStorage.projectUnread) || '_');
        chrome.browserAction.setBadgeText({
            text:  count
        });
    } else {
        setSecure();
    }
}

function setSecure() {
    chrome.browserAction.setBadgeText({
        text: secureBadge
    });
}

function startRequest(showAnimation) {
    function stopLoadingAnimation() {
        if (showAnimation) loadingAnimation.stop();
    }

    function startLoadingAnimation() {
        if (showAnimation) loadingAnimation.start();
    }

    checkToken(startLoad.bind(null, startLoadingAnimation, stopLoadingAnimation));
}

function startLoad(startLoadingAnimation, stopLoadingAnimation) {
    if (localStorage.hasOwnProperty('token')) {
        if (localStorage.load == 0) {
            stopLoadingAnimation();
            startLoadingAnimation();
            var onSuccess = function (count, type, response) {
                stopLoadingAnimation();
                updateUnreadCount(count, type);
                updateUnreadLast(response, type);
                localStorage.load = (localStorage.load == 0) ? 0 : localStorage.load - 1;
                updateIcon(true);
            };

            var onError = function (type, isAuth) {
                stopLoadingAnimation();
                updateIcon(false);
                localStorage.load = (localStorage.load == 0) ? 0 : localStorage.load - 1;
            };

            localStorage.load = 2;
            getInboxCount(onSuccess, onError, 'project');
            getInboxCount(onSuccess, onError, 'person');
        }
    } else {
        stopLoadingAnimation();
        updateIcon(false);
        if (!localStorage.checking) {
            authCheck();
        }
    }
}

function restartRequest() {
    if (localStorage.hasOwnProperty('token')) {
       delete localStorage.checking;
        initRequest(true);
    } else {
        if (localStorage.timeoutId) {
            clearTimeout(localStorage.timeoutId);
            delete localStorage.timeoutId;
        }
        localStorage.timeoutId = setTimeout(authCheck, requestTimer);
    }
}

function authCheck() {
    localStorage.checking = true;
    checkToken(restartRequest);
}

function checkToken(callback) {
    try {
        chrome.cookies.get({url: getExperiumUrl(), name: 'token'}, function (cookie) {
            if (cookie) {
                localStorage.token = cookie.value;
            } else {
                resetStorage();
                setSecure();
            }
            callback();
        });
    } catch (e) {
        console.log('Wrong url');
    }
}

function drawIconAtRotation() {
    canvasContext.save();
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.translate(
        Math.ceil(canvas.width / 2),
        Math.ceil(canvas.height / 2));
    canvasContext.rotate(2 * Math.PI * ease(rotation));
    canvasContext.drawImage(loggedInImage,
        -Math.ceil(canvas.width / 2),
        -Math.ceil(canvas.height / 2));
    canvasContext.restore();

    chrome.browserAction.setIcon({
        imageData:canvasContext.getImageData(0, 0, canvas.width, canvas.height)
    });
}

function getInboxCount(onSuccess, onError, type) {
    var xhr = new XMLHttpRequest();

    function handleSuccess(count, response) {
        localStorage.requestFailureCount = 0;
        if (onSuccess) {
            onSuccess(count,type,response);
        }
    }

    var invokedErrorCallback = false;
    function handleError(status) {
        ++localStorage.requestFailureCount;
        var isAuth = true;
        if (status == 401 || status == 403) {
            isAuth = false;
            resetStorage();
        }

        if (onError && !invokedErrorCallback) {
            onError(type, isAuth);
        }

        invokedErrorCallback = true;
    }

    try {
        xhr.onreadystatechange = function() {
            if (xhr.readyState != 4)
                return;
            if (xhr.response) {
                var response = JSON.parse(xhr.response);

                if (response.length >= 0) {
                    handleSuccess(response.length, response);
                    return;
                }
            }

            handleError(xhr.status);
        };

        xhr.onerror = function(error) {
            handleError(error.status);
        };
        xhr.open("GET", getUpdateUrl(type), true);
        xhr.setRequestHeader('Authorization', localStorage.token);
        xhr.send(null);
    } catch(e) {
        handleError(0);
    }
}

function updateUnreadCount(count, type) {
    var changed = localStorage[type + 'Unread'] != count;
    if (localStorage.hasOwnProperty(type + 'Unread') && changed) {
        animateFlip();
    }
    console.log(count);
    localStorage[type + 'Unread'] = count;
}

function updateUnreadLast(response, type) {
    var last = 0;
    for (var key in response) {
        if (response.hasOwnProperty(key)) {
            if (localStorage.hasOwnProperty(type + 'UnreadLast') && response[key].id > localStorage[type + 'UnreadLast']) {
                showMessage(response[key], type);
            }
            last = response[key].id;
        }
    }

    localStorage[type + 'UnreadLast'] = last;
}

function showMessage(data, type) {
    var redirect = function (id, type) {
        var link = getRedirectController(type) + id;
        chrome.tabs.getAllInWindow(undefined, function(tabs) {
            for (var i = 0, tab; tab = tabs[i]; i++) {
                if (tab.url && isExperiumUrl(tab.url)) {
                    chrome.tabs.update(tab.id, {selected: true, url: link});
                    return;
                }
            }
            chrome.tabs.create({url: link});
        });
        delete onClickRedirect[id];
    };

    chrome.tabs.getAllInWindow(undefined, function(tabs) {
        for (var i = 0, tab; tab = tabs[i]; i++) {
            if (tab.url && isExperiumUrl(tab.url) && tab.active) {
                return;
            }
        }

        if (getExperiumShowMessages() && chrome.notifications) {
            chrome.notifications.create(data.id.toString(),
                {
                    type:    'basic',
                    iconUrl: 'icon_message.png',
                    title:   chrome.i18n.getMessage(''),
                    message: getTranslateMessage(type, data)
                },
                function (id) {
                    onClickRedirect[id] = redirect.bind(this, data.id, type);
                }
            );
        }
    });
}

chrome.notifications.onClicked.addListener(function(id) {
    onClickRedirect[id]();
});

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
        updateIcon(true);
    }
}

function initRequest(loading) {
    if (localStorage.intervalId) {
        clearTimeout(localStorage.intervalId);
        delete localStorage.intervalId;
    }

    localStorage.intervalId = setTimeout(startRequest, getExperiumUpdateTimer());
    startRequest(loading);
}

function onInit() {
    localStorage.requestFailureCount = 0;
    localStorage.load = 0;
    delete localStorage.checking;
    updateIcon(false);
    initRequest(true);
}

onInit(true);

var filters = {
    // TODO(aa): Cannot use urlPrefix because all the url fields lack the protocol
    // part. See crbug.com/140238.
    url: [{urlContains: getExperiumUrl().replace(/^https?\:\/\//, '')}]
};

function onNavigate(details) {
    if (details.url && isExperiumUrl(details.url)) {
        initRequest(false);
    }
}

if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
    chrome.webNavigation.onReferenceFragmentUpdated) {
    chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate, filters);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(
        onNavigate, filters);
} else {
    chrome.tabs.onUpdated.addListener( function(_, details) {
        onNavigate(details);
    });
}

chrome.browserAction.onClicked.addListener(goToIndex);

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener( function() {
      onInit();
  });
}
