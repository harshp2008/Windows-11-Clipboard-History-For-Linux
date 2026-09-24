#!/bin/bash
sudo cp extensions/win11-clipboard-bridge@harshp2008.github.com/extension.js /usr/share/gnome-shell/extensions/win11-clipboard-bridge@harshp2008.github.com/extension.js
gnome-extensions disable win11-clipboard-bridge@harshp2008.github.com
gnome-extensions enable win11-clipboard-bridge@harshp2008.github.com
echo "Extension deployed and cycled."
