import { findByProps } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { storage } from "@vendetta/plugin";
import { Forms, General } from "@vendetta/ui/components";

// Safe Imports
const { FormSection, FormRow } = Forms;
const { View } = General;

// 1. Data Stores (Crash Proofing)
const MessageStore = findByProps("getMessages", "getMessage");
const ChannelStore = findByProps("getChannelId");
const SelectedChannelStore = findByProps("getChannelId", "getVoiceChannelId"); // Backup channel finder
const Clipboard = findByProps("setString");

const CODE_REGEX = /```([\s\S]+?)```/;

// THE MAIN LOGIC
// We moved this into a function so both the Command AND the Button can use it.
function runCopyLogic() {
    try {
        // Try multiple ways to get the channel ID
        const channelId = ChannelStore?.getChannelId() || SelectedChannelStore?.getChannelId();
        
        if (!channelId) {
            showToast("Error: Could not find Channel ID.", "ic_warning");
            return;
        }

        // Get Messages
        const messagesObj = MessageStore.getMessages(channelId);
        if (!messagesObj) {
            showToast("Error: Could not read messages.", "ic_warning");
            return;
        }

        const messages = messagesObj.toArray ? messagesObj.toArray() : Object.values(messagesObj);
        
        if (!messages || messages.length === 0) {
            showToast("Chat appears empty.", "ic_warning");
            return;
        }

        // Search Loop
        const foundMsg = messages.reverse().find(msg => {
            // Text
            if (msg.content && CODE_REGEX.test(msg.content)) return true;
            // Embeds
            if (msg.embeds && msg.embeds.length > 0) {
                return msg.embeds.some(embed => {
                    if (embed.description && CODE_REGEX.test(embed.description)) return true;
                    if (embed.fields) return embed.fields.some(f => f.value && CODE_REGEX.test(f.value));
                    return false;
                });
            }
            return false;
        });

        if (foundMsg) {
            let rawCode = "";
            // Extract
            if (foundMsg.content && CODE_REGEX.test(foundMsg.content)) {
                rawCode = foundMsg.content.match(CODE_REGEX)[1];
            } else if (foundMsg.embeds) {
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
                showToast("Copied to Clipboard!", getAssetIDByName("ic_check"));
            } else {
                showToast("Found block but failed to extract.", "ic_warning");
            }

        } else {
            showToast("No code blocks found in recent messages.", "ic_warning");
        }

    } catch (e) {
        console.error(e);
        showToast(`Crash: ${e.message}`, "ic_warning");
    }
}

let unpatch;

export default {
    onLoad: () => {
        // Try to register the command
        try {
            unpatch = registerCommand({
                name: "copycode",
                displayName: "copycode",
                description: "Copy the last codeblock",
                displayDescription: "Copy the last codeblock",
                options: [],
                applicationId: "-1",
                inputType: 1,
                type: 1,
                execute: runCopyLogic // Just run the shared function
            });
        } catch (e) {
            console.error("Failed to register command", e);
        }
    },

    onUnload: () => {
        if (unpatch) unpatch();
    },

    // SETTINGS MENU (The Backup Plan)
    settings: () => {
        return (
            <View style={{ flex: 1 }}>
                <FormSection title="Manual Trigger">
                    <FormRow
                        label="Scan Chat & Copy Code"
                        subLabel="Tap this if the slash command fails"
                        leading={<General.Image source={getAssetIDByName("ic_copy_message_link")} style={{width: 24, height: 24}} />}
                        onPress={() => runCopyLogic()} 
                    />
                </FormSection>
                <FormSection title="Info">
                    <FormRow label="How to use" subLabel="1. Go to a channel with code.\n2. Come here and tap the button above.\n3. Or try typing /copycode" />
                </FormSection>
            </View>
        );
    }
};
