import { findByProps, findByDisplayName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// 1. Safe Imports
const React = findByProps("createElement", "useState");
const { View, TouchableOpacity, Text, Image } = findByProps("View", "Image", "TouchableOpacity", "Text") || {};
const Clipboard = findByProps("setString");

// 2. Find the "Message Accessories" component
// This component renders the footer of a message (embeds, images, etc.)
// It is the perfect safe place to inject our button.
let MessageAccessories = findByDisplayName("MessageAccessories");
if (!MessageAccessories) {
    const mod = findByProps("MessageAccessories");
    if (mod) MessageAccessories = mod.MessageAccessories;
}

let unpatch;

export default {
    onLoad: () => {
        // Safety Check
        if (!MessageAccessories) {
            showToast("Error: MessageAccessories not found", "ic_warning");
            return;
        }

        // 3. Patch the Accessories
        unpatch = after("default", MessageAccessories, (args, res) => {
            const message = args[0]?.message;
            if (!message || !message.content) return res;

            // 4. Check for Codeblocks using Regex
            // Matches ``` ... ```
            const codeBlockRegex = /```(?:[\w-]+\n)?([\s\S]+?)```/;
            const match = message.content.match(codeBlockRegex);

            if (match) {
                const codeContent = match[1]; // The actual code inside

                // 5. Create the "Copy Code" Button
                const copyButton = React.createElement(TouchableOpacity, {
                    onPress: () => {
                        Clipboard.setString(codeContent.trim());
                        showToast("Code Copied!", getAssetIDByName("ic_check"));
                    },
                    style: {
                        marginTop: 8,
                        backgroundColor: "#2f3136", // Discord Dark
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        alignSelf: "flex-start", // Don't stretch full width
                        flexDirection: "row",
                        alignItems: "center",
                        borderColor: "#202225",
                        borderWidth: 1
                    }
                }, [
                    // Icon
                    React.createElement(Image, {
                        source: getAssetIDByName("ic_copy_message_link") || getAssetIDByName("ic_copy"),
                        style: { width: 16, height: 16, tintColor: "#ffffff", marginRight: 6 }
                    }),
                    // Text Label
                    React.createElement(Text, {
                        style: { color: "#ffffff", fontWeight: "600", fontSize: 12 }
                    }, "Copy Code")
                ]);

                // 6. Append our button to the existing accessories (images/embeds)
                return React.createElement(View, {}, [res, copyButton]);
            }

            return res;
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
