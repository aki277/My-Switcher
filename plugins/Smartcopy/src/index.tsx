import { findByProps } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const MessageStore = findByProps("getMessages", "getMessage");
const ChannelStore = findByProps("getChannelId");
const Clipboard = findByProps("setString");

// Matches ```...``` (Triple backticks)
const CODE_REGEX = /```([\s\S]+?)```/;

let unpatch;

export default {
    onLoad: () => {
        unpatch = registerCommand({
            name: "copycode",
            displayName: "copycode",
            description: "Copy code from text or embeds",
            displayDescription: "Copy code from text or embeds",
            options: [],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: () => {
                const channelId = ChannelStore.getChannelId();
                if (!channelId) return showToast("Error: No Channel ID", "ic_warning");

                // 1. Get Messages safely
                const messagesObj = MessageStore.getMessages(channelId);
                // Handle different storage types (Array vs Map)
                const messages = messagesObj.toArray ? messagesObj.toArray() : Object.values(messagesObj);
                
                if (!messages || messages.length === 0) {
                    return showToast("No messages found to scan.", "ic_warning");
                }

                // showToast(`Scanning ${messages.length} messages...`);

                // 2. Search loop (Newest first)
                // We look for the regex in Content OR Embeds
                const foundMsg = messages.reverse().find(msg => {
                    // Check A: Normal Text
                    if (msg.content && CODE_REGEX.test(msg.content)) return true;

                    // Check B: Embeds (Description or Fields)
                    if (msg.embeds && msg.embeds.length > 0) {
                        return msg.embeds.some(embed => {
                            // Check Description
                            if (embed.description && CODE_REGEX.test(embed.description)) return true;
                            // Check Fields
                            if (embed.fields) {
                                return embed.fields.some(f => f.value && CODE_REGEX.test(f.value));
                            }
                            return false;
                        });
                    }
                    return false;
                });

                if (foundMsg) {
                    let rawCode = "";

                    // EXTRACT IT
                    // (We have to run the match again to grab the text)
                    if (foundMsg.content && CODE_REGEX.test(foundMsg.content)) {
                        rawCode = foundMsg.content.match(CODE_REGEX)[1];
                    } else if (foundMsg.embeds) {
                        // Find specifically which embed had it
                        foundMsg.embeds.forEach(embed => {
                            if (embed.description && CODE_REGEX.test(embed.description)) {
                                rawCode = embed.description.match(CODE_REGEX)[1];
                            } else if (embed.fields) {
                                embed.fields.forEach(f => {
                                    if (f.value && CODE_REGEX.test(f.value)) {
                                        rawCode = f.value.match(CODE_REGEX)[1];
                                    }
                                });
                            }
                        });
                    }

                    if (rawCode) {
                        Clipboard.setString(rawCode.trim());
                        showToast("Copied code!", getAssetIDByName("ic_check"));
                    } else {
                        showToast("Error parsing code.", "ic_warning");
                    }

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
