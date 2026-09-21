# Material de Som no Pronto da Reserva

## Objetivo
Adicionar a categoria **MATERIAL DE SOM** à página Pronto da Reserva, separando corretamente esses equipamentos de Materiais Diversos e mantendo os quantitativos sincronizados com as alterações feitas em Equipamentos e Cautelas.

## Implementação
- Incluir **MATERIAL DE SOM** no resumo, filtro, seção detalhada, PDF e snapshots do Pronto.
- Classificar como som os itens cuja categoria, categoria principal, descrição ou marca indiquem `Som`, `Caixa`, `Caixa Acústica`, `Microfone`, `Mixer`, `Mesa de Som`, `Pedestal` ou `Attack`.
- Preservar as classificações existentes de HARRIS, MOTOROLA, SATELITAL e BALÍSTICO; itens não reconhecidos continuam em MATERIAL DIVERSOS.
- Atualizar automaticamente a página quando houver inclusão, edição ou exclusão de equipamentos, cautelas ou itens de cautela.
- Manter o botão **Atualizar Pronto** como atualização manual adicional.

## Validação
- Confirmar que equipamentos de som aparecem somente em MATERIAL DE SOM.
- Confirmar que mudanças de situação por cautela atualizam os totais “No Pelotão”, “Fora” e “Baixados”.
- Verificar a página em tela pequena e desktop, além do estado de compilação.
