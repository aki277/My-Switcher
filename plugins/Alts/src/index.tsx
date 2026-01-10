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
const AuthModule = findByProps("login", "logout");

// Helper to get avatar
function getAvatarUrl(user) {
    if (!user.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}

// Helper to switch accounts
function attemptLogin(token, name) {
    try {
        AuthModule.login(token);
        showToast(`Switching to ${name}...`, getAvatarUrl({}));
    } catch (e) {
        AuthModule.logout();
        setTimeout(() => AuthModule.login(token), 500);
    }
}

// SAFE STORAGE FOR COMMANDS (Prevents the crash)
let unpatches = [];

export default {
    onLoad: () => {
        if (!storage.accounts) storage.accounts = [];

        // --- REGISTER COMMANDS ---
        
        // 1. /alt save
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

        // 2. /alt list
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

        // 3. /alt switch <name>
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
                    attemptLogin(account.token, account.name);
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
        // Clean up all commands safely
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
                                    { text: "Switch", onPress: () => attemptLogin(acc.token, acc.name) },
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
