use arboard::{Clipboard, ext::linux::ClipboardType};
use arboard::SetExtLinux;

fn main() {
    let mut clipboard = Clipboard::new().unwrap();
    clipboard.set_text("test").unwrap();
    clipboard.set().clipboard(ClipboardType::Primary).text("test").unwrap();
}
