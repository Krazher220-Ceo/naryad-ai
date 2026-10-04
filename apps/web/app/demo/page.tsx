import Link from "next/link";
import { Card, InlineNotice } from "@/components/ui";
import { getT } from "@/lib/i18n-server";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ResetDemoButton } from "./ResetDemoButton";

const DEMO_LOGINS = [
  {
    roleKey: "demo.roleMaster" as const,
    login: "master1",
    pin: "111111",
    buttonKey: "demo.loginMaster" as const,
    href: "/login?next=/master",
    descKey: "demo.masterDesc" as const,
    highlight: true,
  },
  {
    roleKey: "demo.roleWorker" as const,
    login: "worker1, worker2, worker3",
    pin: "222222",
    buttonKey: "demo.loginWorker" as const,
    href: "/login?next=/worker",
    descKey: "demo.workerDesc" as const,
    highlight: false,
  },
  {
    roleKey: "demo.roleLead" as const,
    login: "lead1",
    pin: "333333",
    buttonKey: "demo.loginLead" as const,
    href: "/login?next=/lead",
    descKey: "demo.leadDesc" as const,
    highlight: false,
  },
];

const SCENARIO_STEPS = [
  {
    titleKey: "demo.steps.step1Title" as const,
    textKey: "demo.steps.step1Text" as const,
  },
  {
    titleKey: "demo.steps.step2Title" as const,
    textKey: "demo.steps.step2Text" as const,
  },
  {
    titleKey: "demo.steps.step3Title" as const,
    textKey: "demo.steps.step3Text" as const,
  },
  {
    titleKey: "demo.steps.step4Title" as const,
    textKey: "demo.steps.step4Text" as const,
  },
  {
    titleKey: "demo.steps.step5Title" as const,
    textKey: "demo.steps.step5Text" as const,
  },
  {
    titleKey: "demo.steps.step6Title" as const,
    textKey: "demo.steps.step6Text" as const,
  },
  {
    titleKey: "demo.steps.step7Title" as const,
    textKey: "demo.steps.step7Text" as const,
  },
  {
    titleKey: "demo.steps.step8Title" as const,
    textKey: "demo.steps.step8Text" as const,
  },
  {
    titleKey: "demo.steps.step9Title" as const,
    textKey: "demo.steps.step9Text" as const,
  },
];

export default async function DemoPage() {
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      {/* Шапка в стиле km.kz: тёмно-синий фон, белый логотип, узкий заголовок */}
      <header className="bg-[#001636] text-white">
        <div className="h-1 bg-accent" />
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6 lg:max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span role="img" aria-label={t("brand.company")} className="km-logo h-12 bg-white" />
            <div className="flex items-center gap-3">
              <Link
                href="/demo/ui"
                className="text-base font-semibold text-white/80 underline hover:text-white"
              >
                {t("demo.uiShowcaseLink")}
              </Link>
              <LanguageSwitch />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-wide text-white sm:text-5xl">
            {t("demo.title")}
          </h1>
          <p className="text-xl font-semibold text-accent">
            {t("demo.subtitle")}
          </p>
          <p className="mt-1 text-base text-white/85">
            {t("demo.description")}
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8 lg:max-w-5xl">
        {/* Предупреждение о демо-данных */}
        <InlineNotice tone="info">
          {t("demo.disclaimer")}
        </InlineNotice>

        {/* Тестовые учетные записи */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">
              {t("demo.loginsTitle")}
            </h2>
            <p className="text-base text-ink-muted">
              {t("demo.loginsSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {DEMO_LOGINS.map((item) => (
              <Card key={item.href} className="flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-lg font-bold text-ink">
                    {t(item.roleKey)}
                  </span>
                  <p className="text-base text-ink-muted">
                    {t(item.descKey)}
                  </p>
                  <div className="mt-2 rounded-xl border border-line bg-canvas p-3 text-base">
                    <div className="flex justify-between py-0.5">
                      <span className="font-semibold text-ink-muted">{t("demo.loginLabel")}:</span>
                      <span className="font-mono font-bold text-ink">{item.login}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="font-semibold text-ink-muted">{t("demo.pinLabel")}:</span>
                      <span className="font-mono font-bold text-ink">{item.pin}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={item.href}
                  className="flex min-h-touch w-full items-center justify-center rounded-xl bg-brand px-4 text-center text-base font-semibold text-white transition-colors hover:bg-brand-hover active:bg-black"
                >
                  {t(item.buttonKey)}
                </Link>
              </Card>
            ))}
          </div>

          <InlineNotice tone="warning">
            {t("demo.deviceTip")}
          </InlineNotice>
        </section>

        {/* Сценарий проверки жюри */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">
              {t("demo.scenarioTitle")}
            </h2>
            <p className="text-base text-ink-muted">
              {t("demo.scenarioSubtitle")}
            </p>
          </div>

          <ol className="flex flex-col gap-3">
            {SCENARIO_STEPS.map((step) => (
              <li key={step.titleKey}>
                <Card className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-ink">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-base leading-relaxed text-ink-muted">
                    {t(step.textKey)}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* Уведомления в Telegram */}
        <section className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">
              {t("demo.telegramTitle")}
            </h2>
            <p className="text-base text-ink-muted leading-relaxed">
              {t("demo.telegramText")}
            </p>
          </Card>
        </section>

        {/* Сброс демо */}
        <section className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-ink">
                {t("demo.resetTitle")}
              </h2>
              <p className="text-base text-ink-muted">
                {t("demo.resetSubtitle")}
              </p>
            </div>
            <ResetDemoButton />
          </Card>
        </section>
      </main>

      <footer className="border-t border-line bg-surface py-6 text-center text-base text-ink-muted">
        <div className="mx-auto max-w-xl px-4 lg:max-w-5xl">
          <p>{t("demo.disclaimer")}</p>
        </div>
      </footer>
    </div>
  );
}
