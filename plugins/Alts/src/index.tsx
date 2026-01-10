import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { General, Forms } from "@vendetta/ui/components";
import { React } from "@vendetta/metro/common";

const { FormSection, FormRow, FormInput } = Forms;
const { View, Image, Alert } = General;

// Discord Internal Modules
const UserStore = findByProps("getCurrentUser");
const TokenStore = findByProps("getToken");
const AuthModule = findByProps("login", "logout");

// Helper to get avatar URL
function getAvatarUrl(user) {
    if (!user.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}

export default {
    onLoad: () => {
        if (!storage.accounts) storage.accounts = [];
    },
    
    settings: () => {
        const [manualName, setManualName] = React.useState("");
        const [manualToken, setManualToken] = React.useState("");
        const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);

        // Feature 1: "Save Current Account" (Like the PC Plugin)
        const saveCurrentAccount = () => {
            const user = UserStore.getCurrentUser();
            const token = TokenStore.getToken();
            
            if (!user || !token) {
                return Alert.alert("Error", "Could not fetch current user info.");
            }

            // Check if already exists
            if (storage.accounts.some(acc => acc.id === user.id)) {
                return Alert.alert("Error", "This account is already saved!");
            }

            storage.accounts.push({
                id: user.id,
                name: user.username, // or user.globalName
                avatar: getAvatarUrl(user),
                token: token
            });
            
            Alert.alert("Success", `Saved account: ${user.username}`);
            forceUpdate();
        };

        // Feature 2: Manual Add (for alts you aren't logged into)
        const addManualAccount = () => {
            if (!manualName || !manualToken) return;
            
            storage.accounts.push({
                id: "manual-" + Date.now(),
                name: manualName,
                avatar: "https://cdn.discordapp.com/embed/avatars/0.png", // Default avatar
                token: manualToken
            });
            
            setManualName("");
            setManualToken("");
            forceUpdate();
        };

        const switchAccount = (account) => {
            Alert.alert(
                "Switch Account",
                `Log in as ${account.name}?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "Login", 
                        onPress: () => {
                            try {
                                AuthModule.login(account.token);
                            } catch (e) {
                                // Fallback logic if instant login fails
                                AuthModule.logout();
                                setTimeout(() => AuthModule.login(account.token), 500);
                            }
                        } 
                    }
                ]
            );
        };

        const deleteAccount = (index) => {
            storage.accounts.splice(index, 1);
            forceUpdate();
        };

        return (
            <View style={{ flex: 1 }}>
                {/* Section 1: Quick Actions */}
                <FormSection title="Quick Actions">
                    <FormRow
                        label="Save Current Account"
                        subLabel="Instantly save the user you are currently logged in as"
                        leading={<Image source={{ uri: getAvatarUrl(UserStore.getCurrentUser()) }} style={{ width: 32, height: 32, borderRadius: 16 }} />}
                        onPress={saveCurrentAccount}
                    />
                </FormSection>

                {/* Section 2: Account List */}
                <FormSection title="Saved Accounts">
                    {storage.accounts.length === 0 && <FormRow label="No accounts saved yet" />}
                    
                    {storage.accounts.map((acc, index) => (
                        <FormRow
                            label={acc.name}
                            subLabel={acc.token ? "Ready to switch" : "Invalid Token"}
                            leading={<Image source={{ uri: acc.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />}
                            onPress={() => switchAccount(acc)}
                            onLongPress={() => {
                                Alert.alert("Delete Account", `Remove ${acc.name}?`, [
                                    { text: "Cancel" },
                                    { text: "Delete", style: "destructive", onPress: () => deleteAccount(index) }
                                ]);
                            }}
                        />
                    ))}
                </FormSection>

                {/* Section 3: Manual Entry */}
                <FormSection title="Add Account Manually">
                    <FormInput
                        value={manualName}
                        onChange={setManualName}
                        placeholder="Account Name"
                    />
                    <FormInput
                        value={manualToken}
                        onChange={setManualToken}
                        placeholder="Token (OTk...)"
                        secureTextEntry={true}
                    />
                    <FormRow
                        label="Add Account"
                        onPress={addManualAccount}
                        disabled={!manualName || !manualToken}
                    />
                </FormSection>
            </View>
        );
    }
};
