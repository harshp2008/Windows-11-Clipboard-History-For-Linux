import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const DBUS_INTERFACE = `
<node>
  <interface name="org.gnome.Shell.Extensions.Windows11ClipboardBridge">
    <method name="ForcePin">
      <arg type="u" name="target_pid" direction="in"/>
    </method>
    <method name="SetAlwaysOnTop">
      <arg type="u" name="target_pid" direction="in"/>
      <arg type="b" name="state" direction="in"/>
    </method>
  </interface>
</node>
`;

export default class Windows11ClipboardBridge extends Extension {
    enable() {
        console.log("[ClipboardBridge] ENABLED - DBus Only");
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBUS_INTERFACE, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/gnome/Shell/Extensions/Windows11ClipboardBridge');
    }

    disable() {
        console.log("[ClipboardBridge] DISABLED");
        if (this._dbusImpl) {
            this._dbusImpl.unexport();
            this._dbusImpl = null;
        }
    }

    ForcePin(targetPid) {
        const actors = global.get_window_actors();
        for (let i = actors.length - 1; i >= 0; i--) {
            const win = actors[i].meta_window;
            if (!win) continue;

            const winPid = win.get_pid ? win.get_pid() : -1;
            if (winPid === targetPid) {
                console.log(`[ClipboardBridge] Matched target PID ${targetPid}. Elevating and pinning.`);
                win.make_above();
                try {
                    const timestamp = global.get_current_time();
                    win.activate(timestamp);
                    Main.activateWindow(win);
                } catch (err) {
                    console.error(`[ClipboardBridge] Activation failed: ${err}`);
                }
                return;
            }
        }
        console.log(`[ClipboardBridge] ForcePin: No window found matching PID ${targetPid}`);
    }

    SetAlwaysOnTop(targetPid, state) {
        const actors = global.get_window_actors();
        for (const actor of actors) {
            const win = actor.meta_window;
            if (!win) continue;
            if (win.get_pid && win.get_pid() === targetPid) {
                if (state) win.make_above();
                else win.unmake_above();
                return;
            }
        }
    }
}
