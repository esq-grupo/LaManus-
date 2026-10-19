// Monta o pacote de publicação a partir de um build já feito (`npm ci && prisma generate && npm run build`).
// Uso (na raiz do repositório, no commit a publicar):  COMMIT=<40 hex> node scripts/empacotar.mjs
// Saída: saida/lamanus-<hash12>-linux-x64.tar.gz e saida/lamanus-<hash12>-linux-x64.tar.gz.sha256
// Estrutura: app/ (Next standalone + static + public), manutencao/ (prisma, scripts, src, node_modules com o motor de migrações), LEIA-ME.txt.
// Não inclui .env, .git, o seed nem contas fictícias; falha se encontrar algum.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  createReadStream,
} from "node:fs";
import path from "node:path";

const commit = process.env.COMMIT ?? "";
if (!/^[0-9a-f]{40}$/.test(commit))
  throw new Error("Defina COMMIT com o hash completo (40 caracteres).");
const hash12 = commit.slice(0, 12);
const nome = `lamanus-${hash12}-linux-x64`;
const saida = "saida";
const raiz = path.join(saida, "pacote");
const falha = (m) => {
  throw new Error(`Pacote recusado: ${m}`);
};
const correr = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });

for (const p of [
  ".next/standalone/server.js",
  ".next/static",
  "public",
  "src/generated/prisma/client.ts",
])
  if (!existsSync(p)) falha(`falta ${p} (corra o build antes)`);

rmSync(saida, { recursive: true, force: true });
mkdirSync(path.join(raiz, "app", ".next"), { recursive: true });

// 1) aplicação
cpSync(".next/standalone", path.join(raiz, "app"), { recursive: true });
// Pasta só de desenvolvimento (emails gravados em ficheiro); o rastreio do Next pode copiá-la se existir no build local.
rmSync(path.join(raiz, "app", "armazenamento"), { recursive: true, force: true });
cpSync(".next/static", path.join(raiz, "app", ".next", "static"), { recursive: true });
cpSync("public", path.join(raiz, "app", "public"), { recursive: true });

// 2) manutenção
const man = path.join(raiz, "manutencao");
mkdirSync(man, { recursive: true });
cpSync("prisma", path.join(man, "prisma"), { recursive: true });
rmSync(path.join(man, "prisma", "seed.ts"), { force: true });
cpSync("prisma.config.ts", path.join(man, "prisma.config.ts"));
cpSync("scripts", path.join(man, "scripts"), { recursive: true });
for (const f of ["importar.ts", "gerar-exemplo-importacao.ts", "empacotar.mjs"])
  rmSync(path.join(man, "scripts", f), { force: true });
cpSync("src", path.join(man, "src"), { recursive: true });
cpSync("tsconfig.json", path.join(man, "tsconfig.json"));
cpSync("docker/pacote/manutencao.package.json", path.join(man, "package.json"));
cpSync("docker/pacote/manutencao.package-lock.json", path.join(man, "package-lock.json"));

// As versões das ferramentas têm de coincidir com as da aplicação (mesmo package-lock).
const lockRaiz = JSON.parse(readFileSync("package-lock.json", "utf8")).packages;
const dependencias = JSON.parse(
  readFileSync("docker/pacote/manutencao.package.json", "utf8"),
).dependencies;
for (const [dep, versao] of Object.entries(dependencias)) {
  const noLock = lockRaiz[`node_modules/${dep}`]?.version;
  if (noLock !== versao)
    falha(
      `${dep}: manutenção ${versao} ≠ aplicação ${noLock} (actualize docker/pacote/manutencao.package*.json)`,
    );
}

console.log("npm ci (manutenção, lockfile congelado)…");
correr("npm", ["ci", "--no-audit", "--no-fund"], { cwd: man });
const motor = path.join(man, "node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x");
if (!existsSync(motor)) falha("falta o motor de migrações schema-engine-debian-openssl-3.0.x");

// 3) LEIA-ME
writeFileSync(
  path.join(raiz, "LEIA-ME.txt"),
  readFileSync("docker/pacote/LEIA-ME.txt", "utf8")
    .replaceAll("@COMMIT@", commit)
    .replaceAll("@NODE@", process.version),
);

// 4) nada que não deva ir
const proibidos = [];
const ver = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === ".git" || /^\.env(\.|$)/.test(e.name)) proibidos.push(p);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") ver(p);
    } else if (!/\.(wasm|node|png|ico|woff2?)$/.test(e.name) && statSync(p).size < 5_000_000) {
      const t = readFileSync(p, "utf8");
      if (/exemplo\.lamanu\.test|SEED_PASSWORD/.test(t))
        proibidos.push(`${p} (conta fictícia / SEED_PASSWORD)`);
    }
  }
};
ver(raiz);
for (const d of [path.join(raiz, "app", "node_modules"), path.join(man, "node_modules")])
  for (const e of readdirSync(d, { recursive: true }))
    if (path.basename(String(e)) === ".git") proibidos.push(String(e));
if (proibidos.length > 0)
  falha(`ficheiros que não podem ir no pacote:\n- ${proibidos.join("\n- ")}`);

// 5) arquivo determinista (ordem por nome, dono 0, hora do commit)
const epoch = execFileSync("git", ["log", "-1", "--format=%ct", commit]).toString().trim();
const tar = path.join(saida, `${nome}.tar.gz`);
execFileSync("bash", [
  "-c",
  `set -o pipefail; tar --sort=name --owner=0 --group=0 --numeric-owner --mtime=@${epoch} -C "${raiz}" -cf - . | gzip -9n > "${tar}"`,
]);
const sha = await new Promise((ok, ko) => {
  const h = createHash("sha256");
  createReadStream(tar)
    .on("data", (d) => h.update(d))
    .on("end", () => ok(h.digest("hex")))
    .on("error", ko);
});
writeFileSync(`${tar}.sha256`, `${sha}  ${nome}.tar.gz\n`);
const lista = execFileSync("tar", ["-tzf", tar])
  .toString()
  .split("\n")
  .filter((l) => /^\.\/[^/]+\/?$/.test(l));
console.log(`Topo do arquivo: ${lista.join(" ")}`);
console.log(`Ficheiro: ${tar}\nTamanho: ${statSync(tar).size} bytes\nSHA-256: ${sha}`);
