import { modules } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const React = findByProps("createElement", "useState");
const { View, TouchableOpacity, Image } = findByProps("View", "Image", "TouchableOpacity") || {};
const Clipboard = findByProps("setString");

// --- THE ULTIMATE HUNTER ---
function findRulesAndKey() {
    const allIds = Object.keys(modules);
    
    // We look for ANY module that has these basic keys
    const basicKeys = ["paragraph", "text", "strong"];

    for (const id of allIds) {
        const mod = modules[id]?.publicModule?.exports;
        if (!mod) continue;

        // Helper to check an object
        const check = (obj) => {
            if (!obj) return null;
            const keys = Object.keys(obj);
            // Does it have the basics?
            const hasBasics = basicKeys.every(k => keys.includes(k));
            if (hasBasics) {
                // SUCCESS! Now, what do they call codeblocks?
                if (obj.fence) return { rules: obj, key: "fence" };
                if (obj.codeBlock) return { rules: obj, key: "codeBlock" };
                if (obj.code) return { rules: obj, key: "code" };
                // If we found basics but no codeblock rule, it's weird, but return it anyway
                return { rules: obj, key: null };
            }
            return null;
        };

        // Check common locations
        let result = check(mod);
        if (result) return result;
        
        result = check(mod.defaultRules);
        if (result) return result;

        result = check(mod.default);
        if (result) return result;
    }
    return null;
}

let unpatch;

export default {
    onLoad: () => {
        try {
            const found = findRulesAndKey();

            if (!found) {
                console.error("Smart Copy: Exhausted all search options.");
                showToast("Fatal: Cannot find Markdown Engine.", "ic_warning");
                return;
            }

            if (!found.key) {
                showToast("Found Parser, but no CodeBlock rule!", "ic_warning");
                return;
            }

            // showToast(`Hooking into rule: ${found.key}`, "ic_check");

            // PATCH IT!
            unpatch = after("react", found.rules[found.key], (args, res) => {
                if (!res) return res;

                // Robust content finder
                const node = args[0];
                const content = node.content || node.options?.content || "content_missing";

                const copyButton = React.createElement(TouchableOpacity, {
                    onPress: () => {
                        Clipboard.setString(content);
                        showToast("Copied!", getAssetIDByName("ic_check"));
                    },
                    style: {
                        position: "absolute",
                        right: 4,
                        top: 4,
                        backgroundColor: "rgba(32, 34, 37, 0.9)", // Discord Dark
                        borderRadius: 4,
                        padding: 6,
                        zIndex: 99,
                        borderColor: "rgba(255,255,255,0.1)",
                        borderWidth: 1
                    }
                }, React.createElement(Image, {
                    source: getAssetIDByName("ic_copy_message_link") || getAssetIDByName("ic_copy"),
                    style: { width: 16, height: 16, tintColor: "#ffffff" }
                }));

                // Safe Wrap
                return React.createElement(View, { style: { position: "relative" } }, [res, copyButton]);
            });

        } catch (e) {
            console.error(e);
            showToast(`Crash: ${e.message}`, "ic_warning");
        }
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
