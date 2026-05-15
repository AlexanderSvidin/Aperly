import { redirect } from "next/navigation";

export default function CreateStudyPage() {
  redirect("/create?scenario=STUDY");
}
