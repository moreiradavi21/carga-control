## Sistema de Gestão de Material Carga — Pelotão de Comunicações

Sistema web completo para controle de equipamentos, cautelas, assinaturas digitais e relatórios, com autenticação e níveis de acesso.

### Stack
- React + TypeScript + TanStack Start (já configurado)
- Tailwind CSS v4 com tema militar (verde-oliva, cinza, preto)
- Lovable Cloud (Supabase) — Auth, PostgreSQL, Storage
- React Query, React Hook Form, Zod
- jsPDF + jspdf-autotable para PDFs
- react-signature-canvas para assinaturas
- SheetJS (xlsx) e PapaParse para importação Excel/CSV
- pdfjs-dist para leitura de PDF
- qrcode.react para QR Codes
- Recharts para gráficos

### Perfis
- **Comandante (admin)**: acesso total
- **Telefonista**: visualizar disponíveis + criar cautelas

Roles armazenadas em tabela separada `user_roles` com função `has_role()` (security definer).

### Estrutura do banco (Lovable Cloud)

```
profiles          (id, full_name, posto_graduacao, created_at)
user_roles        (user_id, role: 'comandante'|'telefonista')
categorias        (id, nome, parent_id) -- hierárquico para subcategorias
companhias        (id, nome) -- 1ª CIA, 2ª CIA, 3ª CIA, CCAp, Ap Log, EM
equipamentos      (id, patrimonio, numero_serie, descricao, categoria_id,
                   marca, modelo, localizacao, situacao, observacoes,
                   foto_url, qrcode)
cautelas          (id, numero, companhia_id, data_saida, previsao_devolucao,
                   militar_responsavel, posto_responsavel, militar_retirada,
                   posto_retirada, finalidade, observacoes, status,
                   assinatura_entrega, assinatura_recebimento,
                   created_by, finalizada_em, finalizada_por)
cautela_itens     (cautela_id, equipamento_id, devolvido, condicao_devolucao)
movimentacoes     (equipamento_id, tipo, situacao_anterior, situacao_nova,
                   cautela_id, user_id, ip, descricao, created_at)
audit_logs        (user_id, acao, entidade, entidade_id, ip, detalhes, created_at)
```

Numeração de cautela: função SQL `gerar_numero_cautela()` retorna `ANO-XXXX`.

### Rotas

```
/auth                          — login
/                              — redireciona por perfil
/_authenticated/
  dashboard                    — cards + gráficos + últimas movimentações
  equipamentos                 — lista, busca, filtros
  equipamentos/novo            — admin
  equipamentos/$id             — detalhe + histórico + QR
  importar                     — admin: PDF/XLSX/CSV
  cautelas                     — lista
  cautelas/nova                — fluxo: categoria → tipo → seleção → OM → dados → assinaturas
  cautelas/$id                 — detalhe, imprimir PDF, devolver
  usuarios                     — admin
  relatorios                   — PDF/Excel por tipo
  auditoria                    — admin
```

### Fases de entrega (nesta iteração)

Dada a amplitude, entregarei a **base funcional completa** em uma iteração:

1. Enable Lovable Cloud + migrations (todas as tabelas, RLS, roles, seed de companhias e categorias)
2. Design system militar em `styles.css` (tokens oklch verde-oliva/cinza/preto)
3. Auth (`/auth`) + layout `_authenticated` com sidebar
4. Dashboard com cards, gráficos (Recharts) e últimas movimentações
5. CRUD de equipamentos + histórico + QR Code
6. Importação XLSX/CSV (PDF em parsing básico via texto)
7. Fluxo completo de cautela (multi-step) + assinatura digital + PDF
8. Devolução de cautela
9. Gestão de usuários (admin)
10. Relatórios PDF/Excel
11. Busca inteligente + filtros
12. Auditoria automática (triggers SQL)

### Regras de negócio implementadas
- Trigger que impede cautela de equipamento não-disponível
- Trigger que muda situação para "Em cautela" ao inserir em `cautela_itens`
- Trigger que retorna para "Disponível" (ou condição indicada) ao devolver
- Unique constraints em patrimônio e número de série
- Numeração automática de cautela via sequência

### Perguntas antes de codar

1. **Assinatura digital**: aceitável usar `react-signature-canvas` (desenho com mouse/touch salvo como imagem PNG no Storage)? — sim, é o padrão.
2. **Importação PDF**: PDFs de material do Exército tendem a ser tabelas escaneadas. Vou implementar extração de **texto** de PDFs (pdfjs) com heurística; PDFs escaneados exigiriam OCR (fora do escopo desta iteração). OK?
3. **Backup automático**: Lovable Cloud (Supabase) já faz backup diário gerenciado. Sem implementação adicional. OK?

Se aprovado, sigo direto para implementação completa.
