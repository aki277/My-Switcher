import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Robust Clipboard finder
const Clipboard = findByProps("setString");

let unpatch;

export default {
    onLoad: () => {
        if (!Clipboard) {
            showToast("Error: Clipboard module not found", "ic_warning");
            return;
        }

        unpatch = before("setString", Clipboard, (args) => {
            let text = args[0];
            
            // Safety check: ensure we are copying text
            if (typeof text !== 'string') return;

            // 1. Trim invisible spaces/newlines from the start and end
            // (This fixes the "it's still showing" bug)
            const trimmed = text.trim();

            // 2. The Smart Pattern
            // ^```       -> Starts with ```
            // (?:...)?   -> Optional Language name (ignored)
            // ([\s\S]+?) -> Capture the ACTUAL CODE (Group 1)
            // ```$       -> Ends with ```
            const codeBlockRegex = /^```(?:[\w-]+\n)?([\s\S]+?)```$/;

            const match = trimmed.match(codeBlockRegex);

            if (match) {
                // Found a codeblock!
                // match[1] is the clean code inside
                args[0] = match[1];
                showToast("Code copied (Cleaned!)", "ic_copy_message_link");
            } else {
                // Debugging: If you don't see this toast, the plugin isn't running on this copy
                // Uncomment the line below if you are still having trouble
                // showToast("Normal text copied", "ic_copy");
            }
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
