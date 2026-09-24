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

        // Connect to 'window-demands-attention' to automatically grant focus.
        // This is necessary on Wayland because Mutter imposes strict Focus Stealing Prevention.
        // When our application requests focus while pinned, this bypasses the restriction
        // and prevents the "Window is ready" notification from appearing.
        this._demandsAttentionId = global.display.connect(
            'window-demands-attention',
            (display, window) => {
                if (!window || typeof window.activate !== 'function') return;
                try {
                    const timestamp = global.get_current_time();
                    window.activate(timestamp);
                    Main.activateWindow(window);
                } catch (err) {
                    console.error(`[ClipboardBridge] Failed to activate attention-demanding window: ${err}`);
                }
            }
        );
    }

    disable() {
        console.log("[ClipboardBridge] DISABLED");
        if (this._dbusImpl) {
            this._dbusImpl.unexport();
            this._dbusImpl = null;
        }

        if (this._demandsAttentionId) {
            global.display.disconnect(this._demandsAttentionId);
            this._demandsAttentionId = null;
        }
    }

    ForcePin(targetPid) {
        if (!Number.isInteger(targetPid) || targetPid <= 0) {
            console.error(`[ClipboardBridge] ForcePin: Invalid target PID ${targetPid}`);
            return;
        }

        // Architectural Note:
        // On Wayland, standard X11 window IDs are not exposed to clients or DBus seamlessly.
        // Mutter abstracts Wayland surfaces as MetaWindow objects, which lack global IDs.
        // Therefore, we use the process ID (PID) to securely identify and match our
        // application's windows for foreground elevation and pinning.
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
        if (!Number.isInteger(targetPid) || targetPid <= 0) {
            console.error(`[ClipboardBridge] SetAlwaysOnTop: Invalid target PID ${targetPid}`);
            return;
        }

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
