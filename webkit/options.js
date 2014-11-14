var reg = '^(http|https)://([A-Z0-9_./:-]+)/$';

function save_options() {
    var baseUrl = document.getElementById('baseUrl').value;
    var serverUrl = document.getElementById('serverUrl').value;
    var updateTimer = document.getElementById('updateTimer').value;
    var showMessages = document.getElementById('showMessages').checked;

    var status = document.getElementById('status');
    var invalid = false;

    document.getElementById('updateTimer_group').setAttribute("class","form-group");
    if (!parseInt(updateTimer) || !(parseInt(updateTimer) > 0)) {
        status.textContent = chrome.i18n.getMessage("validationMessage");
        document.getElementById('updateTimer_group').setAttribute("class","form-group has-error");
        invalid = true;
    }

    document.getElementById('baseUrl_group').setAttribute("class","form-group");
    if (!baseUrl || !(new RegExp(reg,'i')).test(baseUrl)) {
        status.textContent = chrome.i18n.getMessage("validationMessage");
        document.getElementById('baseUrl_group').setAttribute("class","form-group has-error");
        invalid = true;
    }

    document.getElementById('serverUrl_group').setAttribute("class","form-group");
    if (!serverUrl || !(new RegExp(reg,'i')).test(serverUrl)) {
        status.textContent = chrome.i18n.getMessage("validationMessage");
        document.getElementById('serverUrl_group').setAttribute("class","form-group has-error");
        invalid = true;
    }

    if (invalid) {
        return;
    }

    localStorage.baseUrl = baseUrl;
    localStorage.serverUrl = serverUrl;
    localStorage.updateTimer = updateTimer;
    localStorage.showMessages = showMessages;

    status.textContent = chrome.i18n.getMessage("saveMessage");
    setTimeout(function() {
        status.textContent = '';
    }, 2750);
}

function validate(e) {
    var value = e.srcElement.value;
    if (value && (new RegExp(reg,'i')).test(value)) {
        e.srcElement.parentElement.setAttribute("class","form-group");
    }
}

function restore_options() {
    var checked = localStorage.showMessages || config.showMessages;
    document.getElementById('showMessages').checked = checked === 'true';
    document.getElementById('baseUrl').value = localStorage.baseUrl || config.baseUrl;
    document.getElementById('serverUrl').value = localStorage.serverUrl || config.serverUrl;
    document.getElementById('updateTimer').value = localStorage.updateTimer || config.updateTimer;
}

function set_translate() {
    document.getElementById('baseUrl_title').textContent = chrome.i18n.getMessage("baseUrl");
    document.getElementById('serverUrl_title').textContent = chrome.i18n.getMessage("serverUrl");
    document.getElementById('updateTimer_title').textContent = chrome.i18n.getMessage("updateTimer");
    document.getElementById('showMessages_title').textContent = chrome.i18n.getMessage("showMessages");
    document.getElementById('saveButton').textContent = chrome.i18n.getMessage("saveButton");
    document.getElementById('defaultsButton').textContent = chrome.i18n.getMessage("defaultsButton");
    document.title = chrome.i18n.getMessage("settingsTitle");
    document.getElementById('title').textContent = chrome.i18n.getMessage("settingsTitle");
}

function defaults_options() {
    document.getElementById('showMessages').checked = config.showMessages === 'true';
    document.getElementById('baseUrl').value = config.baseUrl;
    document.getElementById('serverUrl').value = config.serverUrl;
    document.getElementById('updateTimer').value = config.updateTimer;
    document.getElementById('status').textContent = chrome.i18n.getMessage("defaultsMessage");
}

document.addEventListener('DOMContentLoaded', restore_options);
document.addEventListener('DOMContentLoaded', set_translate);
document.getElementById('baseUrl').addEventListener('keyup', validate);
document.getElementById('serverUrl').addEventListener('keyup', validate);
document.getElementById('saveButton').addEventListener('click', save_options);
document.getElementById('defaultsButton').addEventListener('click', defaults_options);
