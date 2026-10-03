import { redirect } from "next/navigation";

// Корень: proxy.ts уже отправил вошедшего пользователя на экран его роли.
// Сюда попадает только тот, кто не вошёл.
export default function Home() {
  redirect("/login");
}
