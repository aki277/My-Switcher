import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { registerSettings } from "@vendetta/registrant";
import { General } from "@vendetta/ui/components";
import { Forms } from "@vendetta/ui/components";
import { React } from "@vendetta/metro/common";

const { FormSection, FormRow, FormInput, FormText } = Forms;
const { View, TouchableOpacity, Text, Alert } = General;

// Discord's internal Auth module for mobile
const AuthModule = findByProps("login", "logout");

// Define how we store data
// storage.accounts will be an array of { name: "...", token: "..." }

const Settings = () => {
    // React state to handle input fields
    const [name, setName] = React.useState("");
    const [token, setToken] = React.useState("");
    
    // Force update to refresh list when adding/removing
    const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);

    if (!storage.accounts) storage.accounts = [];

    const addAccount = () => {
        if (!name || !token) return;
        storage.accounts.push({ name, token });
        setName("");
        setToken("");
        forceUpdate();
    };

    const removeAccount = (index) => {
        storage.accounts.splice(index, 1);
        forceUpdate();
    };

    const switchAccount = (token) => {
        try {
            if(!token) return;
            // The magic function for Mobile Discord
            AuthModule.login(token); 
        } catch (e) {
            console.log(e);
            // Fallback if the simple login fails
            AuthModule.logout(); 
            setTimeout(() => AuthModule.login(token), 1000);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <FormSection title="Add New Account">
                <FormInput
                    value={name}
                    onChange={setName}
                    placeholder="Account Name"
                />
                <FormInput
                    value={token}
                    onChange={setToken}
                    placeholder="Token"
                    secureTextEntry={true} // Hides the token
                />
                <FormRow
                    label="Save Account"
                    onPress={addAccount}
                />
            </FormSection>

            <FormSection title="Your Accounts">
                {storage.accounts.map((acc, index) => (
                    <FormRow
                        label={acc.name}
                        subLabel={acc.token ? "Token saved securely" : "No token"}
                        onPress={() => {
                            // Show confirmation alert
                             General.Alert.alert(
                                "Switch Account",
                                `Switch to ${acc.name}?`,
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Switch", onPress: () => switchAccount(acc.token) },
                                    { text: "Delete", style: "destructive", onPress: () => removeAccount(index) }
                                ]
                            );
                        }}
                    />
                ))}
            </FormSection>
        </View>
    );
};

export default {
    onLoad: () => {
        // Register the settings menu so you can see the UI
        console.log("SafeSwitcher Loaded");
    },
    onUnload: () => {
        console.log("SafeSwitcher Unloaded");
    },
    settings: Settings,
};
