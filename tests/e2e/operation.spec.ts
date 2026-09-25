import { test, expect } from "@playwright/test";
import { addDateDays, businessDate } from "../../src/lib/booking-policy";

test("operação completa em desktop e celular, com fuso diferente de Brasília", async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("demo@belaagenda.com.br");
  await page.getByLabel("Senha", { exact: true }).fill("Bela1234!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3107/");

  await page.goto("/clientes");
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente Navegador");
  await page.getByLabel("WhatsApp", { exact: true }).fill("47987654321");
  let releaseRequest!: () => void;
  const release = new Promise<void>((resolve) => { releaseRequest = resolve; });
  await page.route("**/api/clients", async (route) => { await release; await route.abort(); }, { times: 1 });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Salvando...", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  releaseRequest();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Não foi possível confirmar");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Editar cliente Cliente Navegador" }).click();
  await page.getByLabel("Observações").fill("Prefere atendimento à tarde");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Prefere atendimento à tarde")).toBeVisible();

  await page.goto("/catalogo");
  await page.getByRole("button", { name: "Editar serviço Corte feminino" }).click();
  await page.getByLabel("Preço (R$)").fill("99");
  await page.getByLabel("Camila Luz", { exact: true }).check();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("R$ 99,00")).toBeVisible();

  let day = addDateDays(businessDate(), 3);
  if (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) day = addDateDays(day, 1);
  const visitor = await context.browser()!.newContext({ timezoneId: "America/Los_Angeles" });
  const publicPage = await visitor.newPage();
  await publicPage.goto(`http://127.0.0.1:3107/agendar/atelier-bela`);
  await publicPage.getByRole("button", { name: /Corte feminino/ }).click();
  await publicPage.getByRole("button", { name: /Ana Costa/ }).click();
  await publicPage.getByLabel("Data do atendimento").fill(day);
  await publicPage.getByRole("button", { name: "14:00", exact: true }).click();
  await publicPage.getByLabel("Seu nome", { exact: true }).fill("Cliente Navegador");
  await publicPage.getByLabel("WhatsApp com DDD").fill("47987654321");
  await publicPage.getByRole("button", { name: "Solicitar agendamento" }).click();
  await expect(publicPage.getByText("AGENDAMENTO SOLICITADO", { exact: true })).toBeVisible();
  await visitor.close();

  await page.goto("/agenda");
  await page.getByRole("button", { name: "Dia", exact: true }).click();
  await expect(page.getByLabel("Dia do atendimento")).toBeVisible();
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  for (let attempts = 0; attempts < 2 && !await page.getByRole("button").filter({ hasText: "Cliente Navegador" }).count(); attempts++) {
    await Promise.all([page.waitForResponse((response) => response.url().includes("/api/appointments?")), page.getByRole("button", { name: "Próxima semana", exact: true }).click()]);
  }
  const booking = () => page.getByRole("button").filter({ hasText: "Cliente Navegador" }).first();
  await booking().click();
  await expect(page.getByRole("dialog")).toContainText("R$ 99,00");
  await expect(page.getByRole("dialog")).toContainText("Agendamento criado");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await booking().click();
  await page.locator("dialog input[name=time]").fill("15:00");
  await page.getByRole("button", { name: "Salvar novo horário" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await booking().click();
  await expect(page.getByRole("dialog")).toContainText("Reagendamento");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar atendimento", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(booking()).toContainText("Cancelado");

  await page.goto("/configuracoes");
  const schedule = page.locator("details").filter({ has: page.locator("summary", { hasText: "Ana Costa" }) });
  await schedule.locator("summary").click();
  await schedule.getByLabel("Início (Brasília)").fill(`${day}T14:00`);
  await schedule.getByLabel("Fim (Brasília)").fill(`${day}T16:00`);
  await schedule.getByLabel("Motivo interno").fill("Ausência teste");
  await schedule.getByRole("button", { name: "Adicionar bloqueio à lista" }).click();
  await schedule.getByRole("button", { name: "Salvar jornada e bloqueios" }).click();
  await expect(schedule.getByRole("status")).toContainText("salvos");
  await page.goto("/agendar/atelier-bela");
  await page.getByRole("button", { name: /Corte feminino/ }).click();
  await page.getByRole("button", { name: /Ana Costa/ }).click();
  await page.getByLabel("Data do atendimento").fill(day);
  await expect(page.getByRole("button", { name: "16:00", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "14:00", exact: true })).toHaveCount(0);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/agenda", "/clientes", "/catalogo", "/configuracoes", "/agendar/atelier-bela"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${width}-${path.replaceAll("/", "_") || "home"}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Editar cliente Cliente Navegador" }).click();
  await page.getByLabel("Cadastro ativo").uncheck();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar cliente Cliente Navegador" })).toHaveCount(0);
  await page.getByLabel("Mostrar clientes inativos").check();
  await page.getByRole("button", { name: "Editar cliente Cliente Navegador" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exportar dados do cliente" }).click()]);
  expect(download.suggestedFilename()).toBe("dados-cliente.json");
  page.once("dialog", (dialog) => dialog.accept("REMOVER CONTATO"));
  await page.getByRole("button", { name: "Remover dados de contato" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar cliente Contato removido" })).toBeVisible();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
