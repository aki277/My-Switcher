import { modules } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// 1. Safe Imports
const React = findByProps("createElement", "useState");
const { View, TouchableOpacity, Image } = findByProps("View", "Image", "TouchableOpacity") || {};
const Clipboard = findByProps("setString");

// 2. The Deep Scanner
// This loops through every module in the app to find the Markdown Rules
function findMarkdownRules() {
    const allIds = Object.keys(modules);
    
    for (const id of allIds) {
        const mod = modules[id]?.publicModule?.exports;
        if (!mod) continue;

        // Check Case A: The module contains "defaultRules"
        if (mod.defaultRules && mod.defaultRules.fence && mod.defaultRules.link) {
            return mod.defaultRules;
        }

        // Check Case B: The module IS the rules object
        if (mod.fence && mod.link && mod.blockQuote) {
            return mod;
        }
        
        // Check Case C: Default export is the rules
        if (mod.default && mod.default.fence && mod.default.link) {
            return mod.default;
        }
    }
    return null;
}

// Run the scan once
const Rules = findMarkdownRules();
let unpatch;

export default {
    onLoad: () => {
        try {
            if (!Rules || !Rules.fence) {
                console.error("Smart Copy: Deep Scan failed.");
                showToast("Error: Could not find Fence Rule even after Deep Scan.", "ic_warning");
                return;
            }

            // 3. Patch the 'react' method of the fence rule
            // This method is what actually draws the codeblock on screen
            unpatch = after("react", Rules.fence, (args, res) => {
                if (!res) return res;

                // The text content is typically inside the node (args[0])
                const node = args[0];
                const codeContent = node.content;

                if (!codeContent) return res;

                // Create the Button
                const copyButton = React.createElement(TouchableOpacity, {
                    onPress: () => {
                        Clipboard.setString(codeContent);
                        showToast("Copied!", getAssetIDByName("ic_check"));
                    },
                    style: {
                        position: "absolute",
                        right: 6,
                        top: 6,
                        backgroundColor: "#202225",
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

                // Wrap the original result (res) in a View to hold our button
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
