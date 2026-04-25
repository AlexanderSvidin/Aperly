import type { SerializedChatScreenData } from "@/features/chat/lib/chat-types";
import { chatService } from "@/server/services/chat/chat-service";

type ChatScreenOptions = {
  chatId?: string;
};

export async function getChatScreenDataForUser(
  userId: string,
  options?: ChatScreenOptions
): Promise<SerializedChatScreenData> {
  const chatList = await chatService.listForUser(userId);

  const selectedChatId =
    options?.chatId && chatList.chats.some((chat) => chat.id === options.chatId)
      ? options.chatId
      : chatList.chats[0]?.id ?? null;

  if (!selectedChatId) {
    return {
      ...chatList,
      selectedChatId: null,
      selectedChat: null,
      selectedMessages: null
    };
  }

  const [selectedChat, selectedMessages] = await Promise.all([
    chatService.getChatMetadata(userId, selectedChatId),
    chatService.getMessages(userId, selectedChatId)
  ]);

  return {
    ...chatList,
    selectedChatId,
    selectedChat,
    selectedMessages
  };
}
