import { findByProps } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// 1. Find Data Stores
const MessageStore = findByProps("getMessages", "getMessage");
const ChannelStore = findByProps("getChannelId");
const Clipboard = findByProps("setString");

// 2. The Regex
// Captures everything inside ```...```
const CODE_BLOCK_REGEX = /```([\s\S]+?)```/;

let unpatch;

export default {
    onLoad: () => {
        unpatch = registerCommand({
            name: "copycode",
            displayName: "copycode",
            description: "Copy codeblock content exactly as is",
            displayDescription: "Copy codeblock content exactly as is",
            options: [],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: () => {
                // 1. Get channel
                const channelId = ChannelStore.getChannelId();
                if (!channelId) return showToast("Error: Unknown Channel", "ic_warning");

                // 2. Scan recent messages (including ephemeral bots)
                const messages = MessageStore.getMessages(channelId).toArray().reverse();
                
                // 3. Find first message with a code block
                const foundMsg = messages.find(msg => msg.content && CODE_BLOCK_REGEX.test(msg.content));

                if (foundMsg) {
                    // 4. Extract RAW content
                    const match = foundMsg.content.match(CODE_BLOCK_REGEX);
                    let rawCode = match[1];

                    // 5. Trim only the outer whitespace (spaces before 'item' or after '3')
                    // We DO NOT remove the first word anymore.
                    Clipboard.setString(rawCode.trim());
                    
                    showToast("Copied exact code!", getAssetIDByName("ic_check"));
                } else {
                    showToast("No code blocks found.", "ic_warning");
                }
            }
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
