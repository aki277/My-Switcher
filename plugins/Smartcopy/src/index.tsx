import { findByProps, findByDisplayName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// 1. Safe Imports
const React = findByProps("createElement", "useState");
const { View, TouchableOpacity, Text, Image } = findByProps("View", "Image", "TouchableOpacity", "Text") || {};
const Clipboard = findByProps("setString");

// 2. The "Shotgun" Finder
// We try to find ANY component that renders message text or footer.
function findTargetComponent() {
    // Priority 1: MessageContent (Best spot, right under text)
    let comp = findByDisplayName("MessageContent") || findByProps("MessageContent")?.MessageContent;
    if (comp) return { comp, name: "MessageContent" };

    // Priority 2: MessageAccessories (The footer)
    comp = findByDisplayName("MessageAccessories") || findByProps("MessageAccessories")?.MessageAccessories;
    if (comp) return { comp, name: "MessageAccessories" };

    // Priority 3: DCD variants (Newer Discord UI naming)
    comp = findByDisplayName("DCDMessageContent");
    if (comp) return { comp, name: "DCDMessageContent" };

    return null;
}

let unpatch;

export default {
    onLoad: () => {
        const target = findTargetComponent();

        if (!target) {
            console.error("Smart Copy: No targets found.");
            showToast("Fatal: Could not find MessageContent or Accessories.", "ic_warning");
            return;
        }

        // showToast(`Hooked into: ${target.name}`, "ic_check");

        // 3. Universal Patch
        unpatch = after("default", target.comp, (args, res) => {
            // Safety: Handle different ways props are passed
            const props = args[0] || {};
            
            // Try to find the text content. 
            // - MessageAccessories usually has 'props.message.content'
            // - MessageContent usually has 'props.content'
            const content = props.content || props.message?.content;

            if (!content || typeof content !== 'string') return res;

            // 4. Regex Check (Look for codeblocks)
            const codeBlockRegex = /```(?:[\w-]+\n)?([\s\S]+?)```/;
            const match = content.match(codeBlockRegex);

            if (match) {
                const codeInside = match[1];

                // 5. Create the Button
                const copyButton = React.createElement(TouchableOpacity, {
                    onPress: () => {
                        Clipboard.setString(codeInside.trim());
                        showToast("Code Copied!", getAssetIDByName("ic_check"));
                    },
                    style: {
                        marginTop: 6,
                        marginBottom: 2,
                        backgroundColor: "#2f3136",
                        borderRadius: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        alignSelf: "flex-start", 
                        flexDirection: "row",
                        alignItems: "center",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderWidth: 1
                    }
                }, [
                    React.createElement(Image, {
                        source: getAssetIDByName("ic_copy_message_link") || getAssetIDByName("ic_copy"),
                        style: { width: 14, height: 14, tintColor: "#ffffff", marginRight: 6 }
                    }),
                    React.createElement(Text, {
                        style: { color: "#ffffff", fontWeight: "700", fontSize: 12, fontFamily: "gg_sans_bold" }
                    }, "Copy Code")
                ]);

                // 6. Append to the output
                // We wrap the original result + our button in a column View
                return React.createElement(View, { style: { flexDirection: 'column' } }, [res, copyButton]);
            }

            return res;
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
