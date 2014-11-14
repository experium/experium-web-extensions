Experium Web Interface Extensions
=======================

## Webkit Chrome

Open webkit/webkit.crx in browser and accept the installation process.

Upload from extension directory in chrome://extensions/ menu.

### How to generate new .crx file

Use package option in chrome://extensions/ menu \with webkit directory without webkit.pem for new package of extension or with webkit.pem for new versions.

Full tutorial - [https://developer.chrome.com/extensions/packaging](https://developer.chrome.com/extensions/packaging)

## Firefox

Open firefox/experium-addon.xpi in browser and accept the installation process.

### How to generate new .xpi file

Install and run SDK - [https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation):

    $ source bin/activate

Then create package of the add-on

    $ cd firefox/
    $ cfx xpi