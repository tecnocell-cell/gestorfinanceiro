import { useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useAuth } from "../AuthContext.jsx";
import { generateId } from "../finance.js";
import {
  stepsForTipo,
  stepIndex,
  onboardingPatchForStep,
  isOnboardingDone,
} from "../onboarding.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";

export default function OnboardingPage({ onDone }) {
  const { user } = useAuth();
  const {
    empresa,
    tipo,
    pessoa,
    company,
    contas,
    lancamentos,
    clientes,
    centroCustos,
    patchEmpresa,
    setPessoaField,
    setEmpresaField,
    contaCrud,
    lancCrud,
    clienteCrud,
    centroCustoCrud,
    planoContas,
  } = useGestor();

  const isPF = tipo === "fisica";
  const steps = stepsForTipo(isPF);
  const initial = empresa?.onboardingEtapa || steps[0]?.id;
  const [stepId, setStepId] = useState(initial);
  const [waPhone, setWaPhone] = useState("");
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState("");

  if (!empresa || isOnboardingDone(empresa)) {
    onDone?.();
    return null;
  }

  const idx = stepIndex(stepId, isPF);
  const step = steps[idx];
  const total = steps.length;

  const finishStep = () => {
    const patch = onboardingPatchForStep(stepId, isPF);
    patchEmpresa(patch);
    if (patch.onboardingConcluido) onDone?.();
    else {
      const next = patch.onboardingEtapa;
      if (next) setStepId(next);
    }
  };

  const saveWa = async () => {
    setWaBusy(true);
    setWaMsg("");
    try {
      const { whatsappApi } = await import("../api.js");
      const phone = waPhone.replace(/\D/g, "");
      await whatsappApi.addAuthorized({ phone_number: phone, label: "Principal" });
      setWaMsg("Número cadastrado.");
      finishStep();
    } catch (e) {
      setWaMsg(e.message || "Erro ao cadastrar número.");
    } finally {
      setWaBusy(false);
    }
  };

  let body = null;

  if (stepId === "pf-1") {
    body = (
      <>
        <label className="form-label">Nome</label>
        <input
          className="form-input"
          value={pessoa?.nome || user?.nome || ""}
          onChange={(e) => setPessoaField("nome", e.target.value)}
        />
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={finishStep}>
          Continuar
        </button>
      </>
    );
  } else if (stepId === "pf-2") {
    body = (
      <>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Informe o celular que enviará mensagens ao número oficial Fluxiva (com DDI, ex: 5511999999999).
        </p>
        <input className="form-input" value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="5511999999999" />
        {waMsg && <p style={{ fontSize: 12, marginTop: 8 }}>{waMsg}</p>}
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} disabled={waBusy} onClick={saveWa}>
          {waBusy ? "Salvando…" : "Salvar e continuar"}
        </button>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={finishStep}>
          Pular por agora
        </button>
      </>
    );
  } else if (stepId === "pf-3") {
    const hasConta = (contas || []).some((c) => !c.inativo);
    body = (
      <>
        {!hasConta ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              contaCrud.add({
                id: generateId(),
                codigo: 1,
                nome: "Conta Principal",
                tipo: "Banco",
                saldoInicial: 0,
                inativo: false,
              });
              finishStep();
            }}
          >
            Criar conta padrão
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={finishStep}>Continuar</button>
        )}
      </>
    );
  } else if (stepId === "pf-4") {
    const hasLanc = (lancamentos || []).length > 0;
    body = (
      <>
        {!hasLanc ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              lancCrud.add({
                id: generateId(),
                codigo: 1,
                tipo: "Saida",
                valor: 50,
                data: new Date().toISOString().slice(0, 10),
                descricao: "Exemplo onboarding",
                planoId: planoContas?.[0]?.id || null,
                contaSaidaId: contas?.[0]?.id,
              });
              finishStep();
            }}
          >
            Criar lançamento de exemplo
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={finishStep}>Continuar</button>
        )}
        <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={finishStep}>
          Pular
        </button>
      </>
    );
  } else if (stepId === "pj-1") {
    body = (
      <>
        <label className="form-label">Nome fantasia</label>
        <input
          className="form-input"
          value={company?.nomeFantasia || ""}
          onChange={(e) => setEmpresaField("nomeFantasia", e.target.value)}
        />
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={finishStep}>
          Continuar
        </button>
      </>
    );
  } else if (stepId === "pj-2") {
    body = (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          if (!(contas || []).some((c) => !c.inativo)) {
            contaCrud.add({
              id: generateId(),
              codigo: 1,
              nome: "Caixa Geral",
              tipo: "Caixa",
              saldoInicial: 0,
              inativo: false,
            });
          }
          finishStep();
        }}
      >
        Criar conta Caixa/Banco
      </button>
    );
  } else if (stepId === "pj-3") {
    body = (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          if (!(centroCustos || []).length) {
            centroCustoCrud.add({ id: generateId(), nome: "Geral", codigo: "CC01", ativo: true });
          }
          finishStep();
        }}
      >
        Criar centro de custo inicial
      </button>
    );
  } else if (stepId === "pj-4") {
    body = (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          if (!(clientes || []).length) {
            clienteCrud.add({ id: generateId(), nome: "Cliente exemplo", documento: "", ativo: true });
          }
          finishStep();
        }}
      >
        Cadastrar primeiro cliente
      </button>
    );
  } else {
    body = (
      <button type="button" className="btn btn-primary" onClick={finishStep}>
        Concluir configuração
      </button>
    );
  }

  const content = (
    <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        Passo {idx + 1} de {total}
      </p>
      <h2 style={{ margin: "8px 0 4px" }}>{step?.title}</h2>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>{step?.desc}</p>
      {body}
    </div>
  );

  if (isPF) return <PfPageShell title="Configuração inicial">{content}</PfPageShell>;
  return <div style={{ padding: 24 }}>{content}</div>;
}
