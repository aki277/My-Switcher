import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Find the Clipboard module
const Clipboard = findByProps("setString");

let unpatch;

export default {
    onLoad: () => {
        // "before" runs BEFORE the real copy function. 
        // We can change the text before it hits the clipboard.
        unpatch = before("setString", Clipboard, (args) => {
            const originalText = args[0];

            // Check if the text is a codeblock (starts/ends with ```)
            if (typeof originalText === 'string' && originalText.startsWith("```") && originalText.endsWith("```")) {
                
                // 1. Remove the first 3 backticks
                let cleanText = originalText.slice(3);
                
                // 2. Remove the last 3 backticks
                cleanText = cleanText.slice(0, -3);

                // 3. Remove the language name (e.g., "typescript" or "js") from the first line
                // This Regex looks for the first newline and removes everything before it
                cleanText = cleanText.replace(/^[a-zA-Z0-9+\-]*\n/, "");

                // 4. Update the arguments with our clean text
                args[0] = cleanText.trim();
                
                showToast("Copied Code (Cleaned!)", "ic_copy_message_link");
            }
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
