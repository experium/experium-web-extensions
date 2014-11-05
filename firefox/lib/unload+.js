"use strict";

var Unloader = exports.Unloader = function Unloader() {
    var unloaders = [];

    function unloadersUnlaod() {
        unloaders.slice().forEach(function(unloader) unloader());
        unloaders.length = 0;
    }

    require("sdk/system/unload").when(unloadersUnlaod);

    function removeUnloader(unloader) {
        let index = unloaders.indexOf(unloader);
        if (index != -1)
            unloaders.splice(index, 1);
    }

    return {
        unload: function unload(callback, container) {
// Calling with no arguments runs all the unloader callbacks
            if (callback == null) {
                unloadersUnlaod();
                return null;
            }

            var remover = removeUnloader.bind(null, unloader);

// The callback is bound to the lifetime of the container if we have one
            if (container != null) {
// Remove the unloader when the container unloads
                container.addEventListener("unload", remover, false);

// Wrap the callback to additionally remove the unload listener
                let origCallback = callback;
                callback = function() {
                    container.removeEventListener("unload", remover, false);
                    origCallback();
                }
            }

// Wrap the callback in a function that ignores failures
            function unloader() {
                try {
                    callback();
                }
                catch(ex) {}
            }
            unloaders.push(unloader);

// Provide a way to remove the unloader
            return remover;
        }
    };
}

/**
 * Save callbacks to run when unloading. Optionally scope the callback to a
 * container, e.g., window. Provide a way to run all the callbacks.
 *
 * @usage unload(): Run all callbacks and release them.
 *
 * @usage unload(callback): Add a callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 *
 * @usage unload(callback, container) Add a scoped callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @param [node] container: Remove the callback when this container unloads.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 */
exports.unload = (Unloader()).unload;