import { redirect } from "next/navigation";

export default function CreateProjectPage() {
  redirect("/create?scenario=PROJECT");
}
