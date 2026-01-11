import { findByProps } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { modules } from "@vendetta/metro";

const { FormSection, FormRow } = Forms;
const { View } = General;

// 1. Safe Channel Finder
const ChannelStore = findByProps("getChannelId");
const SelectedChannelStore = findByProps("getChannelId", "getVoiceChannelId");
const Clipboard = findByProps("setString");

const CODE_REGEX = /```([\s\S]+?)```/;

// --- THE STORE HUNTER ---
// Finds the REAL MessageStore by testing them
function findRealMessageStore(channelId) {
    // 1. Get all modules with 'getMessages'
    const candidates = [];
    const allIds = Object.keys(modules);
    
    for (const id of allIds) {
        const mod = modules[id]?.publicModule?.exports;
        if (mod && mod.getMessages && typeof mod.getMessages === 'function') {
            candidates.push(mod);
        } else if (mod && mod.default && mod.default.getMessages && typeof mod.default.getMessages === 'function') {
            candidates.push(mod.default);
        }
    }

    // 2. Test them!
    for (const candidate of candidates) {
        try {
            const result = candidate.getMessages(channelId);
            // If it returns a Map or Array with items, we found it!
            if (result && (result._array || result.length > 0 || (result.size && result.size > 0))) {
                return candidate;
            }
        } catch (e) {
            // Ignore crashes during testing
        }
    }
    return null;
}

function runCopyLogic() {
    try {
        // 1. Get Channel
        const channelId = ChannelStore?.getChannelId() || SelectedChannelStore?.getChannelId();
        if (!channelId) return showToast("Error: No Channel ID found.", "ic_warning");

        // 2. Find the Store that actually works
        const RealMessageStore = findRealMessageStore(channelId);
        
        if (!RealMessageStore) {
            return showToast("Fatal: Could not find a working MessageStore.", "ic_warning");
        }

        // 3. Get Messages
        const messagesObj = RealMessageStore.getMessages(channelId);
        // Handle Map vs Array
        let messages = [];
        if (Array.isArray(messagesObj)) {
            messages = messagesObj;
        } else if (messagesObj._array) {
            messages = messagesObj._array; // Common in Flux stores
        } else if (typeof messagesObj.toArray === 'function') {
            messages = messagesObj.toArray();
        } else {
            messages = Object.values(messagesObj);
        }

        if (!messages || messages.length === 0) {
            return showToast("Chat seems empty (or store failed).", "ic_warning");
        }

        // 4. Scan for Code (Newest first)
        const foundMsg = messages.slice().reverse().find(msg => {
            // Check Content
            if (msg.content && CODE_REGEX.test(msg.content)) return true;
            // Check Embeds
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
            // Extract logic
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
                showToast("Extraction failed.", "ic_warning");
            }
        } else {
            showToast("No code blocks found recently.", "ic_warning");
        }

    } catch (e) {
        console.error(e);
        showToast(`Crash: ${e.message}`, "ic_warning");
    }
}

let unpatch;

export default {
    onLoad: () => {
        // Try to register command
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
                execute: runCopyLogic
            });
        } catch (e) {}
    },

    onUnload: () => {
        if (unpatch) unpatch();
    },

    settings: () => {
        return (
            <View style={{ flex: 1 }}>
                <FormSection title="Manual Action">
                    <FormRow
                        label="Scan & Copy Last Code"
                        subLabel="Tap to find and copy the last codeblock in this chat."
                        leading={<General.Image source={getAssetIDByName("ic_copy_message_link")} style={{width: 24, height: 24}} />}
                        onPress={() => runCopyLogic()} 
                    />
                </FormSection>
            </View>
        );
    }
};
