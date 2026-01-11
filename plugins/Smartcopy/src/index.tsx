import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

const Clipboard = findByProps("setString");

let unpatch;

export default {
    onLoad: () => {
        if (!Clipboard) return;

        unpatch = before("setString", Clipboard, (args) => {
            let text = args[0];
            if (typeof text !== 'string') return;

            // Remove whitespace/newlines from start and end
            text = text.trim();

            // CHECK: Does it start and end with triple backticks?
            if (text.startsWith("```") && text.endsWith("```")) {
                
                // 1. Remove the first 3 characters (```)
                let clean = text.slice(3);
                
                // 2. Remove the last 3 characters (```)
                clean = clean.slice(0, -3);
                
                // 3. CLEANUP:
                // Remove the first line if it looks like a language name (e.g., "js", "text", "html")
                // We assume if the first line is short (under 15 chars) and has no spaces, it's a language tag.
                const firstNewLine = clean.indexOf("\n");
                if (firstNewLine !== -1 && firstNewLine < 15) {
                    const firstLine = clean.substring(0, firstNewLine).trim();
                    if (!firstLine.includes(" ")) {
                        // It's likely a language tag, chop it off
                        clean = clean.substring(firstNewLine + 1);
                    }
                }

                // 4. Final trim to remove any leftover newlines
                args[0] = clean.trim();
                
                showToast("Code copied (Cleaned!)", "ic_copy_message_link");
            }
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
