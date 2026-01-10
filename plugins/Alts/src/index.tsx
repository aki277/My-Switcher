import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { registerCommand } from "@vendetta/commands";
import { General, Forms } from "@vendetta/ui/components";
import { React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";

const { FormSection, FormRow, FormInput } = Forms;
const { View, Image, Alert } = General;

// Discord Internals
const UserStore = findByProps("getCurrentUser");
const TokenStore = findByProps("getToken");
// We strictly look for the switcher. If it's missing, we won't try to fake it.
const SwitcherModule = findByProps("switchAccountToken"); 

function getAvatarUrl(user) {
    if (!user.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}

// SAFE SWITCHER - No dangerous fallbacks
function attemptSwitch(token, name) {
    if (!token) {
        return Alert.alert("Error", "This account has no token saved!");
    }

    if (SwitcherModule && SwitcherModule.switchAccountToken) {
        showToast(`Switching to ${name}...`, getAvatarUrl({}));
        SwitcherModule.switchAccountToken(token)
            .catch(e => {
                Alert.alert("Switch Failed", "Discord rejected the token. The account might be invalid.");
                console.error(e);
            });
    } else {
        Alert.alert("Not Supported", "Your Discord version does not support Fast Switching.");
    }
}

let unpatches = [];

export default {
    onLoad: () => {
        if (!storage.accounts) storage.accounts = [];

        // --- COMMANDS ---
        unpatches.push(registerCommand({
            name: "alt save",
            displayName: "alt save",
            description: "Save current account",
            displayDescription: "Save current account",
            execute: () => {
                const user = UserStore.getCurrentUser();
                const token = TokenStore.getToken();
                if (storage.accounts.some(acc => acc.id === user.id)) {
                    showToast("Already saved!", getAvatarUrl(user));
                    return;
                }
                storage.accounts.push({
                    id: user.id,
                    name: user.username,
                    avatar: getAvatarUrl(user),
                    token: token
                });
                showToast(`Saved ${user.username}!`, getAvatarUrl(user));
            },
            options: [],
            applicationId: "-1",
            inputType: 1,
            type: 1,
        }));

        unpatches.push(registerCommand({
            name: "alt list",
            displayName: "alt list",
            description: "List saved accounts",
            displayDescription: "List saved accounts",
            execute: () => {
                if (storage.accounts.length === 0) {
                    showToast("No accounts saved.");
                    return;
                }
                const list = storage.accounts.map((acc, i) => `${i + 1}. ${acc.name}`).join("\n");
                showToast(`Accounts:\n${list}`);
            },
            options: [],
            applicationId: "-1",
            inputType: 1,
            type: 1,
        }));

        unpatches.push(registerCommand({
            name: "alt switch",
            displayName: "alt switch",
            description: "Switch account",
            displayDescription: "Switch account",
            execute: (args) => {
                const nameOption = args.find(a => a.name === "name");
                const targetName = nameOption?.value?.toLowerCase();
                const account = storage.accounts.find(acc => acc.name.toLowerCase().includes(targetName));
                if (account) {
                    attemptSwitch(account.token, account.name);
                } else {
                    showToast("Account not found.");
                }
            },
            options: [{
                name: "name",
                description: "Username",
                type: 3,
                required: true,
            }],
            applicationId: "-1",
            inputType: 1,
            type: 1,
        }));
    },

    onUnload: () => {
        for (const unpatch of unpatches) {
            unpatch();
        }
        unpatches = [];
    },
    
    settings: () => {
        const [manualName, setManualName] = React.useState("");
        const [manualToken, setManualToken] = React.useState("");
        const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);

        const saveCurrent = () => {
            const user = UserStore.getCurrentUser();
            const token = TokenStore.getToken();
            if (storage.accounts.some(acc => acc.id === user.id)) {
                return Alert.alert("Error", "Already saved.");
            }
            storage.accounts.push({
                id: user.id,
                name: user.username,
                avatar: getAvatarUrl(user),
                token: token
            });
            forceUpdate();
        };

        return (
            <View style={{ flex: 1 }}>
                <FormSection title="Quick Actions">
                    <FormRow 
                        label="Save Current Account" 
                        subLabel={`Log in as ${UserStore.getCurrentUser()?.username}`}
                        leading={<Image source={{ uri: getAvatarUrl(UserStore.getCurrentUser()) }} style={{ width: 32, height: 32, borderRadius: 16 }} />}
                        onPress={saveCurrent} 
                    />
                </FormSection>

                <FormSection title={`Saved Accounts (${storage.accounts.length})`}>
                    {storage.accounts.map((acc, index) => (
                        <FormRow
                            label={acc.name}
                            subLabel="Tap to switch"
                            leading={<Image source={{ uri: acc.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />}
                            onPress={() => {
                                Alert.alert("Switch Account", `Log in as ${acc.name}?`, [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Switch", onPress: () => attemptSwitch(acc.token, acc.name) },
                                    { 
                                        text: "Delete", 
                                        style: "destructive", 
                                        onPress: () => {
                                            storage.accounts.splice(index, 1);
                                            forceUpdate();
                                        } 
                                    }
                                ]);
                            }}
                        />
                    ))}
                </FormSection>

                <FormSection title="Manual Add">
                    <FormInput value={manualName} onChange={setManualName} placeholder="Name" />
                    <FormInput value={manualToken} onChange={setManualToken} placeholder="Token" secureTextEntry={true} />
                    <FormRow 
                        label="Add Account" 
                        disabled={!manualName || !manualToken}
                        onPress={() => {
                            storage.accounts.push({
                                id: Date.now().toString(),
                                name: manualName,
                                avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
                                token: manualToken
                            });
                            setManualName("");
                            setManualToken("");
                            forceUpdate();
                        }} 
                    />
                </FormSection>
            </View>
        );
    }
};
