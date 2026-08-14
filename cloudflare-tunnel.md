# Cloudflare Tunnel — MotorRoute

Passo a passo do que foi feito e **funcionou** para expor a API local (`localhost:8888`) na internet, com HTTPS, sem abrir porta no roteador.

O Cloudflare Tunnel **não hospeda** a API. Ele só cria um endereço público que aponta para o processo que já está rodando no PC.

---

## O que você precisa antes

1. Conta na [Cloudflare](https://dash.cloudflare.com/) (já criada).
2. API do MotorRoute no ar na porta **8888**, com auth desligada:

```bash
cd ~/Documentos/Development/MotorRouter/motor-route
AUTH_DISABLED=true PORT=8888 npm run dev
```

Deixe esse terminal aberto.

---

## 1. Instalar o `cloudflared` (Ubuntu)

Rodado com sucesso no Ubuntu 24.04 (`noble`), versão instalada: **cloudflared 2026.8.1**.

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings

curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update
sudo apt install cloudflared
cloudflared --version
```

Confirme algo como:

```text
cloudflared version 2026.8.1
```

Avisos do `apt` sobre arquitetura `i386` e pacotes órfãos podem ser ignorados.

---

## 2. Subir o túnel rápido

Em **outro** terminal (a API continua no primeiro):

```bash
cloudflared tunnel --url http://localhost:8888
```

Use exatamente essa URL. Sem colchetes e sem markdown.

### O que aparece quando dá certo

1. `Requesting new quick Tunnel on trycloudflare.com...`
2. Depois de alguns segundos:

```text
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://when-able-washing-reveals.trycloudflare.com
```

3. Pre-checks `PASS` (DNS, UDP/QUIC, TCP/HTTP2, API).
4. `Registered tunnel connection` — no teste, a conexão foi `protocol=quic` na região `gru11`.

**Não feche** esse terminal. Se fechar, o túnel cai.

### Avisos que podem ser ignorados

- `Cannot determine default configuration path` — normal no túnel rápido (não usa `config.yml`).
- `ICMP proxy feature is disabled` / `ping_group_range` — não impede HTTP.
- Termos de uso do túnel sem conta nomeada — esperado nesse modo.

---

## 3. Endereço público

No teste que funcionou:

```text
https://when-able-washing-reveals.trycloudflare.com
```

Esse host **muda a cada vez** que o `cloudflared` é reiniciado. Sempre use o link impresso no terminal atual.

A API **não** tem rota em `/`. Abrir a raiz no browser responde:

```json
{
  "message": "Route GET:/ not found",
  "error": "Not Found",
  "statusCode": 404
}
```

Isso é esperado. Use `/health` ou `/api/v1/route`.

---

## 4. Testes que funcionaram

Em um **terceiro** terminal (túnel e API continuam ligados).

### Health

```bash
curl https://when-able-washing-reveals.trycloudflare.com/health
```

No browser:

`https://when-able-washing-reveals.trycloudflare.com/health`

Resposta esperada: JSON com `"status": "ok"`.

### Rota (Capão da Canoa → Porto Alegre)

```bash
curl "https://when-able-washing-reveals.trycloudflare.com/api/v1/route?origin=-29.7608,-50.0200&destination=-30.0346,-51.2177"
```

Resposta obtida com sucesso, por exemplo:

- `distance`: `141017` (metros)
- `duration`: `6570` (segundos)
- `geometry`: GeoJSON `LineString`

---

## 5. Como usar no dia a dia

Três processos ao mesmo tempo:

| Terminal | Comando | Função |
| --- | --- | --- |
| 1 | `AUTH_DISABLED=true PORT=8888 npm run dev` | API local |
| 2 | `cloudflared tunnel --url http://localhost:8888` | Túnel HTTPS |
| 3 | `curl` / browser / app | Chamadas no link `.trycloudflare.com` |

Se o PC dormir, a internet cair, ou qualquer um dos dois primeiros terminais fechar, o endereço público para de responder.

---

## 6. Resumo

1. Subir a API em `localhost:8888`.
2. Instalar `cloudflared` pelo repositório oficial.
3. Rodar `cloudflared tunnel --url http://localhost:8888`.
4. Copiar a URL `https://….trycloudflare.com`.
5. Chamar `/health` e `/api/v1/route?...` nesse host.
