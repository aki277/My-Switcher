import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// 1. Safe Imports
const React = findByProps("createElement", "useState");
const { View, TouchableOpacity, Image } = findByProps("View", "Image", "TouchableOpacity") || {};
const Clipboard = findByProps("setString");

// 2. Find the Markdown Rules
// Discord keeps these in a module that usually has 'defaultRules' or 'parser'
const MarkdownModule = findByProps("defaultRules", "parse");

let unpatch;

export default {
    onLoad: () => {
        try {
            if (!MarkdownModule || !MarkdownModule.defaultRules || !MarkdownModule.defaultRules.fence) {
                console.error("Smart Copy: Could not find Markdown Rules.");
                showToast("Error: Markdown rules not found!", "ic_warning");
                return;
            }

            // 3. Patch the 'fence' rule
            // The 'react' function inside the rule is responsible for drawing the codeblock
            unpatch = after("react", MarkdownModule.defaultRules.fence, (args, res) => {
                // Safety: If it didn't return anything, skip
                if (!res) return res;

                // The content is usually in the second argument (the state) or inside the node
                const node = args[0]; // The data for this codeblock
                const codeContent = node.content;

                if (!codeContent) return res;

                // Create our Floating Button
                const copyButton = React.createElement(TouchableOpacity, {
                    onPress: () => {
                        Clipboard.setString(codeContent);
                        showToast("Copied!", getAssetIDByName("ic_check"));
                    },
                    style: {
                        position: "absolute",
                        right: 6,
                        top: 6,
                        backgroundColor: "#202225", // Dark background
                        borderRadius: 4,
                        padding: 5,
                        zIndex: 10,
                        opacity: 0.9,
                        borderColor: "#40444b",
                        borderWidth: 1
                    }
                }, React.createElement(Image, {
                    source: getAssetIDByName("ic_copy_message_link") || getAssetIDByName("ic_copy"),
                    style: { width: 14, height: 14, tintColor: "#dcddde" }
                }));

                // WRAP IT: Take the original output (res) and put it in a View with our button
                // We use 'relative' position so our 'absolute' button stays inside the box
                return React.createElement(View, { style: { position: "relative" } }, [res, copyButton]);
            });

            showToast("Smart Copy: Hooked into Fence Rule!", "ic_check");

        } catch (e) {
            console.error(e);
            showToast(`Crash: ${e.message}`, "ic_warning");
        }
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
