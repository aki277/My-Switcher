import { findByProps, findByDisplayName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// 1. Safe Imports
const React = findByProps("createElement", "useState");
const { View, TouchableOpacity, Image } = findByProps("View", "Image", "TouchableOpacity") || {};
const Clipboard = findByProps("setString");

// 2. The "Hunter" - Finds the CodeBlock component by any name
function findCodeBlock() {
    // List of names Discord has used over the years
    const names = ["CodeBlock", "DCDCodeBlock", "MarkdownCodeBlock", "NativeCodeBlock"];
    
    for (const name of names) {
        const found = findByDisplayName(name);
        if (found) return found;
    }

    // Fallback: Look inside formatting modules
    const formatting = findByProps("CodeBlock");
    if (formatting && formatting.CodeBlock) return formatting.CodeBlock;

    return null;
}

const CodeBlockComponent = findCodeBlock();
let unpatch;

export default {
    onLoad: () => {
        try {
            if (!CodeBlockComponent) {
                // If we can't find it, show a visible error so we know WHY it failed
                console.error("Smart Copy: Could not find CodeBlock component.");
                showToast("Error: CodeBlock component not found!", "ic_warning");
                return;
            }

            // 3. The Patch
            unpatch = after("default", CodeBlockComponent, (args, res) => {
                // Safety: If render failed, do nothing
                if (!res) return res;

                // Extract the code text. It's usually in `content` or `code` prop.
                const codeContent = args[0]?.content || args[0]?.code;
                if (!codeContent) return res;

                // Create the floating button
                const copyButton = React.createElement(TouchableOpacity, {
                    onPress: () => {
                        Clipboard.setString(codeContent);
                        showToast("Copied!", getAssetIDByName("ic_check"));
                    },
                    style: {
                        position: "absolute",
                        right: 6,
                        top: 6,
                        backgroundColor: "#202225", // Dark Discord background
                        borderRadius: 4,
                        padding: 5,
                        zIndex: 10,
                        opacity: 0.9,
                        borderColor: "#40444b",
                        borderWidth: 1
                    }
                }, React.createElement(Image, {
                    source: getAssetIDByName("ic_copy_message_link") || getAssetIDByName("ic_copy"),
                    style: { width: 14, height: 14, tintColor: "#dcddde" } // Light gray icon
                }));

                // Wrap the output in a generic View to hold our absolute button
                return React.createElement(View, {}, [res, copyButton]);
            });

        } catch (e) {
            console.error(e);
            showToast("Crash detected in Smart Copy", "ic_warning");
        }
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
