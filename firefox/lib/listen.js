"use strict";

var {unload} = require("unload+");

/**
 * Helper that adds event listeners and remembers to remove on unload
 */
exports.listen = function listen(window, node, event, func, capture) {
// Default to use capture
    if (capture == null)
        capture = true;

    node.addEventListener(event, func, capture);
    function undoListen() {
        node.removeEventListener(event, func, capture);
    }

// Undo the listener on unload and provide a way to undo everything
    let undoUnload = unload(undoListen, window);
    return function() {
        undoListen();
        undoUnload();
    };
}
