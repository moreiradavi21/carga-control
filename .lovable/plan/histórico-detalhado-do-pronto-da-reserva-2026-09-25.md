# Histórico detalhado do Pronto da Reserva

## Objetivo
Permitir consultar, dentro de **Pronto da Reserva**, todos os prontos já registrados e abrir cada registro para ver os dados preservados no momento da geração.

## Alterações
- Manter o botão **Histórico** no topo e ampliar a janela para facilitar a consulta.
- Listar os registros do mais recente ao mais antigo, mostrando data, responsável e totais.
- Tornar cada registro selecionável para abrir seus detalhes.
- Exibir no detalhe os militares informados, totais gerais e a relação salva por grupo e material, incluindo **No Pelotão**, **Fora** e **Baixados/Extraviados**.
- Permitir baixar novamente cada pronto do histórico em PDF, usando os dados preservados no registro selecionado.
- Incluir estados claros de carregamento, lista vazia e erro de consulta.
- Atualizar o histórico automaticamente após a geração de um novo pronto.

## Detalhes técnicos
- Usar os registros persistentes já existentes na tabela `prontos` e seu campo `snapshot`.
- Recriar o PDF histórico a partir do `snapshot`, sem substituir os números antigos pelos dados atuais.
- Não alterar os dados históricos nem as regras de acesso existentes; a funcionalidade será somente de consulta.
- Validar a abertura e a leitura do histórico em telas grandes e celulares.
