import { findByProps } from "@vendetta/metro";
import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { modules } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";

const { FormSection, FormRow, FormSwitch } = Forms;
const { View } = General;

// 1. Safe Modules
const ChannelStore = findByProps("getChannelId");
const SelectedChannelStore = findByProps("getChannelId", "getVoiceChannelId");
const Clipboard = findByProps("setString");
const Dispatcher = findByProps("subscribe", "dispatch");
const UserStore = findByProps("getUser");

const CODE_REGEX = /```([\s\S]+?)```/;

// 2. The Store Hunter (Keep this, it's the only thing that works for you)
function findRealMessageStore(channelId) {
    const allIds = Object.keys(modules);
    const candidates = [];
    for (const id of allIds) {
        const mod = modules[id]?.publicModule?.exports;
        if (mod && mod.getMessages) candidates.push(mod);
        else if (mod && mod.default && mod.default.getMessages) candidates.push(mod.default);
    }
    for (const candidate of candidates) {
        try {
            const result = candidate.getMessages(channelId);
            if (result && (result._array || result.length > 0 || result.size > 0)) return candidate;
        } catch (e) {}
    }
    return null;
}

// 3. Extraction Logic
function attemptCopy(channelId, authorId) {
    try {
        // FILTER CHECK: 
        // If we have targets, and this author isn't one of them, STOP.
        if (storage.targets && storage.targets.length > 0 && authorId) {
            if (!storage.targets.includes(authorId)) {
                // console.log("Ignored message from non-target user");
                return "IGNORED";
            }
        }

        const RealMessageStore = findRealMessageStore(channelId);
        if (!RealMessageStore) return "NO_STORE";

        const messagesObj = RealMessageStore.getMessages(channelId);
        let messages = [];
        if (Array.isArray(messagesObj)) messages = messagesObj;
        else if (messagesObj._array) messages = messagesObj._array;
        else if (typeof messagesObj.toArray === 'function') messages = messagesObj.toArray();
        else messages = Object.values(messagesObj);

        if (!messages || messages.length === 0) return "EMPTY";

        // Find newest code
        const foundMsg = messages.slice().reverse().find(msg => {
            // Check Content
            if (msg.content && CODE_REGEX.test(msg.content)) return true;
            // Check Embeds
            if (msg.embeds && msg.embeds.length > 0) {
                return msg.embeds.some(e => 
                    (e.description && CODE_REGEX.test(e.description)) || 
                    (e.fields && e.fields.some(f => f.value && CODE_REGEX.test(f.value)))
                );
            }
            return false;
        });

        if (foundMsg) {
            let rawCode = "";
            if (foundMsg.content && CODE_REGEX.test(foundMsg.content)) {
                rawCode = foundMsg.content.match(CODE_REGEX)[1];
            } else if (foundMsg.embeds) {
                const allText = JSON.stringify(foundMsg.embeds);
                const match = allText.match(CODE_REGEX);
                if (match) rawCode = match[1];
            }

            if (rawCode) {
                const clean = rawCode.trim();
                if (storage.lastCopied === clean) return "DUPLICATE";
                
                Clipboard.setString(clean);
                storage.lastCopied = clean;
                return "SUCCESS";
            }
        }
        return "NO_CODE";
    } catch (e) {
        console.error(e);
        return "ERROR";
    }
}

let unpatches = [];

export default {
    onLoad: () => {
        // Init Storage
        if (typeof storage.autoCopy === "undefined") storage.autoCopy = true;
        if (!storage.targets) storage.targets = []; 

        // COMMAND 1: ADD TARGET
        unpatches.push(registerCommand({
            name: "autocopy add",
            displayName: "autocopy add",
            description: "Add a bot/user to the watchlist",
            displayDescription: "Add a bot/user to the watchlist",
            options: [{ name: "user", description: "The bot to watch", type: 6, required: true }],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: (args) => {
                const userId = args[0].value;
                if (!storage.targets.includes(userId)) {
                    storage.targets.push(userId);
                    showToast("Added to watchlist!", getAssetIDByName("ic_check"));
                } else {
                    showToast("Already in watchlist.", "ic_warning");
                }
            }
        }));

        // COMMAND 2: REMOVE TARGET
        unpatches.push(registerCommand({
            name: "autocopy remove",
            displayName: "autocopy remove",
            description: "Remove a bot from watchlist",
            displayDescription: "Remove a bot from watchlist",
            options: [{ name: "user", description: "The bot to remove", type: 6, required: true }],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: (args) => {
                const userId = args[0].value;
                const idx = storage.targets.indexOf(userId);
                if (idx > -1) {
                    storage.targets.splice(idx, 1);
                    showToast("Removed from watchlist.", getAssetIDByName("ic_trash"));
                } else {
                    showToast("User not found in list.", "ic_warning");
                }
            }
        }));

        // COMMAND 3: LIST TARGETS
        unpatches.push(registerCommand({
            name: "autocopy list",
            displayName: "autocopy list",
            description: "See who you are watching",
            displayDescription: "See who you are watching",
            options: [],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: () => {
                if (storage.targets.length === 0) {
                    showToast("List empty (Copying ALL code)", "ic_info");
                } else {
                    // Try to resolve usernames
                    const names = storage.targets.map(id => {
                        const u = UserStore.getUser(id);
                        return u ? u.username : id;
                    }).join(", ");
                    showToast(`Watching: ${names}`);
                }
            }
        }));

        // DISPATCHER: Watch for messages
        const dispatchUnpatch = Dispatcher.subscribe("MESSAGE_CREATE", (event) => {
            if (!storage.autoCopy) return;
            
            const currentChannel = ChannelStore?.getChannelId() || SelectedChannelStore?.getChannelId();
            
            // Check if message is in current channel
            if (event.channelId !== currentChannel && event.message?.channel_id !== currentChannel) return;

            const authorId = event.message?.author?.id;

            // Wait brief moment for store update
            setTimeout(() => {
                const result = attemptCopy(currentChannel, authorId);
                if (result === "SUCCESS") {
                    showToast("Auto-Copied!", getAssetIDByName("ic_check"));
                }
            }, 500);
        });
        unpatches.push(dispatchUnpatch);
    },

    onUnload: () => {
        for (const un of unpatches) un();
    },

    settings: () => {
        const [auto, setAuto] = React.useState(storage.autoCopy);

        return (
            <View style={{ flex: 1 }}>
                <FormSection title="Master Switch">
                    <FormRow
                        label="Auto-Copy Enabled"
                        subLabel={storage.targets.length > 0 ? "Targeting specific bots only." : "Copying ALL codeblocks (No targets set)."}
                        control={<FormSwitch value={auto} onValueChange={(v) => { storage.autoCopy = v; setAuto(v); }} />}
                    />
                </FormSection>
                <FormSection title="Watchlist Management">
                    <FormRow label="Manage via Chat" subLabel="Use /autocopy add @User to target a specific bot." />
                    <FormRow 
                        label="Clear Watchlist" 
                        subLabel={`Currently watching ${storage.targets.length} users.`}
                        onPress={() => {
                            storage.targets = [];
                            showToast("List cleared (Copying ALL)");
                        }}
                    />
                </FormSection>
            </View>
        );
    }
};
