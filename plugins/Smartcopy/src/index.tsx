import { findByByName, findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// Find React Native components
const { View, TouchableOpacity, Image } = findByProps("View", "Image", "TouchableOpacity");
const Clipboard = findByProps("setString");

// The component that renders codeblocks
const CodeBlock = findByByName("CodeBlock");

let unpatch;

export default {
    onLoad: () => {
        // Safety check: ensure we found the component
        if (!CodeBlock) {
            showToast("Failed to find CodeBlock component", "ic_warning");
            return;
        }

        // Hook into the 'render' function of CodeBlock
        unpatch = after("default", CodeBlock, (args, res) => {
            // args[0] usually contains the props (including the code text)
            const codeContent = args[0]?.content;
            
            if (!codeContent) return res;

            // Create a button icon
            const copyIcon = (
                <TouchableOpacity
                    onPress={() => {
                        Clipboard.setString(codeContent);
                        showToast("Copied to clipboard!", getAssetIDByName("ic_check"));
                    }}
                    style={{
                        position: "absolute",
                        right: 4,
                        top: 4,
                        backgroundColor: "#2f3136", // Dark background for visibility
                        borderRadius: 4,
                        padding: 4,
                        zIndex: 10,
                        opacity: 0.8
                    }}
                >
                    <Image 
                        source={getAssetIDByName("ic_copy_message_link")} 
                        style={{ width: 16, height: 16, tintColor: "#ffffff" }} 
                    />
                </TouchableOpacity>
            );

            // Wrap the original codeblock (res) in a View and add our button
            return (
                <View>
                    {res}
                    {copyIcon}
                </View>
            );
        });
    },

    onUnload: () => {
        if (unpatch) unpatch();
    }
};
