import { ChatsScreenShell } from "@/features/chat/components/chats-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { getChatScreenDataForUser } from "@/server/services/chat/chat-screen-service";

type ChatsPageProps = {
  searchParams?: Promise<{
    chatId?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ChatsPage({ searchParams }: ChatsPageProps) {
  const user = await requirePageUser();
  const resolvedSearchParams = await searchParams;
  const initialData = await getChatScreenDataForUser(user.id, {
    chatId: readSingleSearchParam(resolvedSearchParams?.chatId)
  });
  const screenKey = [
    initialData.selectedChatId ?? "no-chat",
    initialData.chats.length,
    initialData.pendingInvites.length,
    initialData.selectedChat?.contactExchangeStatus ?? "no-contacts",
    initialData.selectedChat?.lastMessageAt ?? "no-activity",
    initialData.selectedMessages?.nextCursor ?? "no-cursor"
  ].join(":");

  return (
    <ChatsScreenShell
      initialData={initialData}
      key={screenKey}
      viewerUserId={user.id}
    />
  );
}
