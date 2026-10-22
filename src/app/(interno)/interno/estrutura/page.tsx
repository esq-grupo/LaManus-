import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { exigirPermissao } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { listarEstrutura } from "@/server/modules/estrutura";
import { formatarData } from "@/lib/datas";
import {
  acaoAno,
  acaoClasse,
  acaoDisciplina,
  acaoDocente,
  acaoEstadoAno,
  acaoFuncionario,
  acaoPeriodo,
  acaoTurma,
} from "../acoes";

export const metadata = { title: "Estrutura escolar — Lá Manu" };

const caixa = "space-y-2 rounded border bg-white p-3";

export default async function Estrutura() {
  const actor = await exigirPermissao("estrutura:ver");
  const editar = can(actor, "estrutura:editar");
  const { anos, classes, disciplinas, funcionarios, turmas } = await listarEstrutura(actor);
  const anosAbertos = anos.filter((a) => a.estado !== "FECHADO");
  const optAnos = anosAbertos.map((a) => ({ valor: a.id, texto: `${a.nome} (${a.estado})` }));
  const optClasses = classes.map((c) => ({ valor: c.id, texto: c.nome }));
  const optTurmas = turmas
    .filter((t) => t.anoLectivo.estado !== "FECHADO")
    .map((t) => ({ valor: t.id, texto: `${t.classe.nome} ${t.nome} — ${t.anoLectivo.nome}` }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Estrutura escolar</h1>

      <section className="space-y-3" aria-labelledby="anos">
        <h2 id="anos" className="font-medium">
          Anos lectivos e períodos
        </h2>
        <ul className="space-y-2">
          {anos.map((a) => (
            <li key={a.id} className={caixa} data-testid={`ano-${a.nome}`}>
              <div>
                <strong>{a.nome}</strong>{" "}
                <span className="rounded bg-slate-100 px-1 text-xs">{a.estado}</span>{" "}
                <span className="text-sm text-slate-600">
                  {formatarData(a.inicio)} → {formatarData(a.fim)}
                </span>
              </div>
              <ul className="text-sm text-slate-700">
                {a.periodos.map((p) => (
                  <li key={p.id}>
                    {p.ordem}. {p.nome} ({formatarData(p.inicio)} → {formatarData(p.fim)})
                  </li>
                ))}
              </ul>
              {editar && a.estado === "PLANEADO" && (
                <FormAcao acao={acaoEstadoAno} rotulo="Activar ano" className="inline">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="estado" value="ACTIVO" />
                </FormAcao>
              )}
              {editar && a.estado === "ACTIVO" && (
                <FormAcao acao={acaoEstadoAno} rotulo="Fechar ano" className="inline">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="estado" value="FECHADO" />
                </FormAcao>
              )}
            </li>
          ))}
        </ul>
        {editar && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormAcao acao={acaoAno} rotulo="Criar ano lectivo" className={caixa}>
              <h3 className="font-medium">Novo ano lectivo</h3>
              <Campo nome="nome" rotulo="Nome (ex.: 2027/2028)" obrigatorio />
              <Campo nome="inicio" rotulo="Início" tipo="date" obrigatorio />
              <Campo nome="fim" rotulo="Fim" tipo="date" obrigatorio />
            </FormAcao>
            <FormAcao acao={acaoPeriodo} rotulo="Criar período" className={caixa}>
              <h3 className="font-medium">Novo período</h3>
              <Escolha
                nome="anoLectivoId"
                rotulo="Ano lectivo"
                opcoes={optAnos}
                semOpcoes="Ainda não há anos lectivos abertos: crie primeiro um ano lectivo."
              />
              <Campo nome="ordem" rotulo="Ordem (1, 2, 3…)" tipo="number" obrigatorio />
              <Campo nome="nome" rotulo="Nome (ex.: 1.º trimestre)" obrigatorio />
              <Campo nome="inicio" rotulo="Início" tipo="date" obrigatorio />
              <Campo nome="fim" rotulo="Fim" tipo="date" obrigatorio />
            </FormAcao>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="turmas">
        <h2 id="turmas" className="font-medium">
          Classes, disciplinas e turmas
        </h2>
        <p className="text-sm text-slate-600">
          Classes: {classes.map((c) => c.nome).join(", ") || "—"} · Disciplinas:{" "}
          {disciplinas.map((d) => d.nome).join(", ") || "—"}
        </p>
        <ul className="space-y-2">
          {turmas.map((t) => (
            <li key={t.id} className={caixa} data-testid={`turma-${t.classe.nome} ${t.nome}`}>
              <strong>
                {t.classe.nome} {t.nome}
              </strong>{" "}
              <span className="text-sm text-slate-600">
                {t.turno} · {t.anoLectivo.nome}
                {t.director ? ` · Director: ${t.director.nome}` : ""}
              </span>
              <ul className="text-sm text-slate-700">
                {t.disciplinas.map((d) => (
                  <li key={d.id}>
                    {d.disciplina.nome} — {d.docente?.nome ?? "sem docente"}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {editar && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormAcao acao={acaoClasse} rotulo="Criar classe" className={caixa}>
              <h3 className="font-medium">Nova classe</h3>
              <Campo nome="nome" rotulo="Nome (ex.: 8.ª classe)" obrigatorio />
              <Campo nome="ordem" rotulo="Ordem" tipo="number" obrigatorio />
            </FormAcao>
            <FormAcao acao={acaoDisciplina} rotulo="Criar disciplina" className={caixa}>
              <h3 className="font-medium">Nova disciplina</h3>
              <Campo nome="nome" rotulo="Nome" obrigatorio />
            </FormAcao>
            <FormAcao acao={acaoTurma} rotulo="Criar turma" className={caixa}>
              <h3 className="font-medium">Nova turma</h3>
              <Escolha
                nome="anoLectivoId"
                rotulo="Ano lectivo"
                opcoes={optAnos}
                semOpcoes="Ainda não há anos lectivos abertos: crie primeiro um ano lectivo."
              />
              <Escolha nome="classeId" rotulo="Classe" opcoes={optClasses} />
              <Campo nome="nome" rotulo="Nome (ex.: A)" obrigatorio />
              <Escolha
                nome="turno"
                rotulo="Turno"
                opcoes={["Manhã", "Tarde", "Noite"].map((t) => ({ valor: t, texto: t }))}
              />
              <Escolha
                nome="directorId"
                rotulo="Director de turma"
                opcoes={funcionarios.map((f) => ({ valor: f.id, texto: f.nome }))}
                vazio="— nenhum —"
                obrigatorio={false}
              />
            </FormAcao>
            <FormAcao acao={acaoDocente} rotulo="Atribuir docente" className={caixa}>
              <h3 className="font-medium">Atribuir docente a uma disciplina</h3>
              <Escolha nome="turmaId" rotulo="Turma" opcoes={optTurmas} />
              <Escolha
                nome="disciplinaId"
                rotulo="Disciplina"
                opcoes={disciplinas.map((d) => ({ valor: d.id, texto: d.nome }))}
              />
              <Escolha
                nome="docenteId"
                rotulo="Docente"
                opcoes={funcionarios.map((f) => ({ valor: f.id, texto: f.nome }))}
              />
            </FormAcao>
            <FormAcao acao={acaoFuncionario} rotulo="Criar funcionário" className={caixa}>
              <h3 className="font-medium">Novo funcionário</h3>
              <Campo nome="nome" rotulo="Nome completo" obrigatorio />
              <Campo nome="cargo" rotulo="Cargo" obrigatorio />
              <Campo
                nome="emailConta"
                rotulo="Email da conta (se for docente, a conta já tem de existir)"
                tipo="email"
              />
            </FormAcao>
          </div>
        )}
      </section>
    </main>
  );
}
