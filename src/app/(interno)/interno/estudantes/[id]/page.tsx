import { notFound } from "next/navigation";
import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { exigirPermissao } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { db } from "@/server/db";
import { obterEstudante } from "@/server/modules/pessoas";
import { formatarData } from "@/lib/datas";
import {
  acaoActualizarEstudante,
  acaoAnular,
  acaoAssociarConta,
  acaoAutorizacao,
  acaoLigarEncarregado,
  acaoMatricular,
  acaoTransferir,
  acaoVerificar,
} from "../../acoes";

export const metadata = { title: "Ficha do estudante — Lá Manu" };
const caixa = "space-y-2 rounded border bg-white p-3";

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermissao("estudantes:ver");
  const { id } = await params;
  const e = await obterEstudante(actor, id);
  if (!e) notFound(); // inexistente OU fora do escopo: a resposta é a mesma
  const editar = can(actor, "estudantes:editar");

  const turmas = editar
    ? await db.turma.findMany({
        where: { archivedAt: null, anoLectivo: { estado: { not: "FECHADO" } } },
        orderBy: [
          { anoLectivo: { inicio: "desc" } },
          { classe: { ordem: "asc" } },
          { nome: "asc" },
        ],
        include: { classe: true, anoLectivo: true },
      })
    : [];
  const optTurmas = turmas.map((t) => ({
    valor: t.id,
    texto: `${t.classe.nome} ${t.nome} — ${t.anoLectivo.nome}`,
  }));
  const activas = e.matriculas.filter((m) => m.estado === "ACTIVA");

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <h1 className="text-xl font-semibold">{e.nome}</h1>
      <p className="text-sm text-slate-600">
        Processo {e.numeroProcesso} · Nascimento {formatarData(e.dataNascimento)}
        {e.bi ? ` · BI ${e.bi}` : ""} · {e.estado}
      </p>

      <section className="space-y-2" aria-labelledby="mat">
        <h2 id="mat" className="font-medium">
          Matrículas
        </h2>
        <ul className="space-y-2">
          {e.matriculas.map((m) => (
            <li key={m.id} className={caixa} data-testid={`matricula-${m.estado}`}>
              <strong>{m.turma}</strong> · {m.anoLectivo} ·{" "}
              {m.tipo === "NOVA" ? "Nova" : "Renovação"} ·{" "}
              <span className="rounded bg-slate-100 px-1 text-xs">{m.estado}</span>
              {editar && m.estado === "ACTIVA" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <FormAcao acao={acaoTransferir} rotulo="Transferir de turma">
                    <input type="hidden" name="estudanteId" value={e.id} />
                    <input type="hidden" name="matriculaId" value={m.id} />
                    <Escolha nome="novaTurmaId" rotulo="Nova turma" opcoes={optTurmas} />
                    <Campo nome="motivo" rotulo="Motivo (obrigatório)" obrigatorio />
                  </FormAcao>
                  <FormAcao
                    acao={acaoAnular}
                    rotulo="Anular matrícula"
                    botaoClasse="rounded border border-red-700 px-3 py-1 text-sm text-red-700 disabled:opacity-50"
                  >
                    <input type="hidden" name="estudanteId" value={e.id} />
                    <input type="hidden" name="matriculaId" value={m.id} />
                    <Campo nome="motivo" rotulo="Motivo (obrigatório)" obrigatorio />
                  </FormAcao>
                </div>
              )}
            </li>
          ))}
          {e.matriculas.length === 0 && <li className="text-sm text-slate-600">Sem matrículas.</li>}
        </ul>
        {editar && (
          <FormAcao acao={acaoMatricular} rotulo="Matricular" className={caixa}>
            <h3 className="font-medium">Nova matrícula</h3>
            <input type="hidden" name="estudanteId" value={e.id} />
            <Escolha nome="turmaId" rotulo="Turma" opcoes={optTurmas} />
            <Escolha
              nome="tipo"
              rotulo="Tipo"
              opcoes={[
                { valor: "NOVA", texto: "Nova" },
                { valor: "RENOVACAO", texto: "Renovação" },
              ]}
            />
            {activas.length > 0 && (
              <p className="text-xs text-slate-600">
                Já tem matrícula activa: para mudar de turma use «Transferir».
              </p>
            )}
          </FormAcao>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="enc">
        <h2 id="enc" className="font-medium">
          Encarregados de educação
        </h2>
        <ul className="space-y-2">
          {e.encarregados.map((l) => (
            <li key={l.encarregadoId} className={caixa} data-testid={`encarregado-${l.nome}`}>
              <strong>{l.nome}</strong> ({l.parentesco}){l.principal ? " · principal" : ""}
              {l.bi ? ` · BI ${l.bi}` : ""}
              {l.contacto ? ` · ${l.contacto}` : ""}
              <div className="text-sm">
                {l.verificado ? (
                  <span className="text-green-700">Ligação verificada</span>
                ) : (
                  <span className="text-amber-700">
                    Ligação NÃO verificada — o encarregado ainda não vê o educando
                  </span>
                )}
                {" · "}
                {l.autorizacaoActiva ? (
                  "Autorização activa"
                ) : (
                  <span className="text-red-700">Autorização revogada</span>
                )}
              </div>
              {editar && (
                <div className="flex flex-wrap gap-2">
                  {!l.verificado && (
                    <FormAcao acao={acaoVerificar} rotulo="Verificar ligação" className="inline">
                      <input type="hidden" name="estudanteId" value={e.id} />
                      <input type="hidden" name="encarregadoId" value={l.encarregadoId} />
                    </FormAcao>
                  )}
                  <FormAcao
                    acao={acaoAutorizacao}
                    rotulo={l.autorizacaoActiva ? "Revogar autorização" : "Repor autorização"}
                    className="inline"
                  >
                    <input type="hidden" name="estudanteId" value={e.id} />
                    <input type="hidden" name="encarregadoId" value={l.encarregadoId} />
                    <input
                      type="hidden"
                      name="activa"
                      value={l.autorizacaoActiva ? "false" : "true"}
                    />
                  </FormAcao>
                  <FormAcao
                    acao={acaoAssociarConta}
                    rotulo="Associar conta"
                    className="inline-flex items-end gap-2"
                  >
                    <input type="hidden" name="estudanteId" value={e.id} />
                    <input type="hidden" name="tipo" value="encarregado" />
                    <input type="hidden" name="id" value={l.encarregadoId} />
                    <Campo nome="email" rotulo="Email da conta" tipo="email" obrigatorio />
                  </FormAcao>
                </div>
              )}
            </li>
          ))}
          {e.encarregados.length === 0 && (
            <li className="text-sm text-slate-600">Sem encarregados ligados.</li>
          )}
        </ul>
        {editar && (
          <FormAcao acao={acaoLigarEncarregado} rotulo="Ligar encarregado" className={caixa}>
            <h3 className="font-medium">Ligar encarregado</h3>
            <p className="text-xs text-slate-600">
              Se o BI já existir, reutiliza o encarregado (um encarregado pode ter vários
              educandos).
            </p>
            <input type="hidden" name="estudanteId" value={e.id} />
            <Campo nome="nome" rotulo="Nome completo" obrigatorio />
            <Campo nome="bi" rotulo="BI (recomendado)" />
            <Campo nome="contacto" rotulo="Contacto" />
            <Escolha
              nome="parentesco"
              rotulo="Parentesco"
              opcoes={[
                "Pai",
                "Mãe",
                "Avô/Avó",
                "Tio/Tia",
                "Irmão/Irmã",
                "Tutor legal",
                "Outro",
              ].map((p) => ({ valor: p, texto: p }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="principal" /> Encarregado principal
            </label>
          </FormAcao>
        )}
      </section>

      {editar && (
        <FormAcao acao={acaoActualizarEstudante} rotulo="Guardar dados" className={caixa}>
          <h2 className="font-medium">Editar dados</h2>
          <input type="hidden" name="id" value={e.id} />
          <Campo nome="nome" rotulo="Nome completo" defaultValue={e.nome} obrigatorio />
          <Campo
            nome="dataNascimento"
            rotulo="Data de nascimento"
            tipo="date"
            defaultValue={e.dataNascimento.toISOString().slice(0, 10)}
            obrigatorio
          />
          <Campo nome="bi" rotulo="BI / cédula" defaultValue={e.bi ?? ""} />
          <Campo nome="contacto" rotulo="Contacto" defaultValue={e.contacto ?? ""} />
          <Escolha
            nome="estado"
            rotulo="Estado"
            opcoes={[
              { valor: "ACTIVO", texto: "Activo" },
              { valor: "INACTIVO", texto: "Inactivo" },
            ]}
          />
        </FormAcao>
      )}
    </main>
  );
}
