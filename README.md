# VMP API

API de processamento de vídeo do Video Matrix Pro.

## Rotas

- `GET /` — health check
- `POST /enviar-clipe` — upload de clipe (multipart/form-data, campo `video`)
- `POST /criar-tarefa` — cria tarefa de combinação
- `GET /tarefa/:id` — status da tarefa
- `GET /tarefa/:id/resultados` — resultados prontos
- `GET /download/:filename` — baixa o vídeo combinado
