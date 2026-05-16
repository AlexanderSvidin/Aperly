import { TelegramContactScreen } from "@/features/profile/components/telegram-contact-screen";
import { requirePageUser } from "@/server/services/auth/current-user";

export default async function ProfileEditTelegramPage() {
  const user = await requirePageUser();

  return <TelegramContactScreen username={user.username ?? null} />;
}
