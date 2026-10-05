import { Card, cx } from "@/components/ui";
import { SettingsForm } from "@/app/(master)/master/settings/SettingsForm";
import { getAiStatus, type ServiceState } from "@/lib/ai/status";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

// Настройки ИИ руководителя (PLAN.md, раздел 8.6): где работает ИИ, состояние моделей и лицензии,
// режим «облако / наш компьютер» и сроки контроля (та же форма, что у мастера).
const MODELS = [
  { name: "Laya multilingual", task: "aiSettings.taskLaya", license: "Apache 2.0" },
  { name: "Whisper large-v3-turbo", task: "aiSettings.taskWhisper", license: "MIT" },
  { name: "Qwen3-4B-Instruct-2507", task: "aiSettings.taskQwen", license: "Apache 2.0" },
  { name: "DeepSeek (API)", task: "aiSettings.taskCloud", license: "aiSettings.cloudLicense" },
] as const;

const STATE_STYLE: Record<ServiceState, string> = {
  online: "bg-success-soft text-success",
  offline: "bg-danger-soft text-danger",
  off: "bg-line text-ink",
};

export default async function LeadAiSettingsPage() {
  const t = await getT();
  const supabase = await createClient();
  const [{ data: settings }, status] = await Promise.all([
    supabase
      .from("settings")
      .select("remind_before_min, accept_timeout_min, accept_timeout_urgent_min, overdue_repeat_min, lead_escalate_after_min, ai_provider, ai_confidence_threshold")
      .eq("id", 1)
      .single(),
    getAiStatus(),
  ]);

  const services: { label: string; state: ServiceState; detail: string }[] = [
    { label: t("aiSettings.fastAi"), state: status.fastAi, detail: status.layaModel ?? "" },
    { label: t("aiSettings.ollama"), state: status.ollama, detail: status.ollamaModels.slice(0, 3).join(", ") },
    { label: t("aiSettings.cloud"), state: status.cloud, detail: "" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-4 lg:max-w-4xl lg:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink lg:text-3xl">{t("aiSettings.title")}</h1>
        <p className="text-base text-ink-muted">{t("aiSettings.hint")}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">{t("aiSettings.where")}</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.label} className="flex flex-col gap-2">
              <b className="text-base text-ink">{s.label}</b>
              <span className={cx("self-start rounded-lg px-2 py-1 text-sm font-bold", STATE_STYLE[s.state])}>
                {t(`aiSettings.state.${s.state}`)}
              </span>
              {s.detail && <span className="text-sm text-ink-muted">{s.detail}</span>}
            </Card>
          ))}
        </div>
        <p className="text-base text-ink-muted">
          {t("aiSettings.threshold").replace("{n}", String(settings?.ai_confidence_threshold ?? 0.7))}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">{t("aiSettings.models")}</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-left text-base">
            <thead className="bg-canvas text-sm text-ink-muted">
              <tr>
                <th className="px-4 py-3">{t("aiSettings.model")}</th>
                <th className="px-4 py-3">{t("aiSettings.task")}</th>
                <th className="px-4 py-3">{t("aiSettings.license")}</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.name} className="border-t border-line">
                  <td className="px-4 py-3 font-semibold text-ink">{m.name}</td>
                  <td className="px-4 py-3 text-ink">{t(m.task)}</td>
                  <td className="px-4 py-3 text-ink">{m.license.startsWith("aiSettings.") ? t(m.license as "aiSettings.cloudLicense") : m.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-sm text-ink-muted">{t("aiSettings.privacy")}</p>
      </section>

      <SettingsForm initialSettings={settings} />
    </main>
  );
}
