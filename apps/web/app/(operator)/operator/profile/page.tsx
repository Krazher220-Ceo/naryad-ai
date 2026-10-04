import { getCurrentEmployee } from "@/lib/auth/session";
import { OperatorProfile } from "./OperatorProfile";

// Профиль оператора: ФИО на этом телефоне, язык, вход по логину и паролю.
export default async function OperatorProfilePage() {
  const employee = await getCurrentEmployee();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 lg:py-8">
      <OperatorProfile accountName={employee?.role === "operator" ? employee.fullName : null} />
    </main>
  );
}
