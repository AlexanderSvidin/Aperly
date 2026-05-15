import { redirect } from "next/navigation";

export default function CreateTeamPage() {
  redirect("/create?scenario=CASE");
}
