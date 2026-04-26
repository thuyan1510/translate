/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Message } from "@vencord/discord-types";
import { Parser, React, useEffect, useState } from "@webpack/common";

import { settings } from "./settings";
import { TranslateIcon } from "./TranslateIcon";
import { cl, getMessageContent, translate, TranslationValue } from "./utils";

const translations = new Map<string, TranslationValue>();

export function handleTranslate(messageId: string, value: TranslationValue) {
    translations.set(messageId, value);
}

// Helper function to reconstruct the message with original elements
const reconstructMessage = (text: string, placeholders: Map<string, React.ReactNode>): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    const regex = new RegExp(Array.from(placeholders.keys()).join("|"), "g");

    text.replace(regex, (match, offset) => {
        if (offset > lastIndex) {
            parts.push(text.substring(lastIndex, offset));
        }
        parts.push(placeholders.get(match)!);
        lastIndex = offset + match.length;
        return match;
    });

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts;
};

export function TranslationAccessory({ message }: { message: Message; }) {
    const [translation, setTranslation] = useState(translations.get(message.id));
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        translations.set(message.id, translation! as TranslationValue);
        return () => translations.delete(message.id);
    }, [translation]);

    useEffect(() => {
        const content = getMessageContent(message);
        if (settings.store.autoTranslateReceived && content && !translation && !isLoading) {
            setIsLoading(true);
            translate("received", content).then(val => {
                setTranslation(val);
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        }
    }, []);

    if (!translation) return null;

    // Create a map to hold placeholders for non-text elements
    const placeholders = new Map<string, React.ReactNode>();
    let placeholderIndex = 0;

    // Process the original message content to extract non-text elements
    const originalContent = Parser.parse(getMessageContent(message));

    // Function to traverse and replace non-text elements
    const traverseAndReplace = (node: any) => {
        if (typeof node === "string") return node;
        if (!node?.props?.children) return "";

        return React.Children.map(node.props.children, (child: any) => {
            if (typeof child === "string") return child;
            // Replace mentions, emojis, etc. with placeholders
            if (child?.props && (child.props.userId || child.props.emojiName || child.props.href)) {
                const placeholder = `__PLACEHOLDER_${placeholderIndex++}__`;
                placeholders.set(placeholder, child);
                return placeholder;
            }
            return traverseAndReplace(child);
        }).join("");
    };

    traverseAndReplace(originalContent);

    const reconstructed = reconstructMessage(translation.text, placeholders);

    return (
        <span className={cl("accessory-text")}>
            <TranslateIcon width={16} height={16} className={cl("accessory-icon")} />
            <strong>
                {reconstructed}
            </strong>
        </span>
    );
}
