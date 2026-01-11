import { modules } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// Safe Imports
const React = findByProps("createElement", "useState");
const { View, TouchableOpacity, Image } = findByProps("View", "Image", "TouchableOpacity") || {};
const Clipboard = findByProps("setString");

// --- THE HUNTER ---
function findCodeBlockSafe() {
    // 1. Scan all modules for anything containing "CodeBlock" in its display name
    const allModules = Object.values(modules);
    
    const foundModule = allModules.find(m => {
        const exp = m?.publicModule?.exports?.default;
        return exp && exp.displayName && exp.displayName.toLowerCase().includes("codeblock");
    });

    if (foundModule) {
        return foundModule.publicModule.exports.default;
    }
    return null;
}

const CodeBlockComponent = findCodeBlockSafe();
let unpatch;

export default {
    onLoad: () => {
        // 2. Safety Check
        if (!CodeBlockComponent) {
            console.log("Still looking...");
            showToast("Failed: Could not find ANY CodeBlock component.", "ic_warning");
            return;
        }

        // 3. Announce what we found (So you know it worked!)
        showToast(`Hooked into: ${CodeBlockComponent.displayName}`, "ic_check");

        // 4. The Patch (Same as before)
        unpatch = after("default", CodeBlockComponent, (args, res) => {
            if (!res) return res;

            // Try to grab the code text from common prop names
            const codeContent = args[0]?.content || args[0]?.code || args[0]?.source;
            if (!codeContent) return res;

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

            return React.createElement(View, {}, [res, copyButton]);
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
