# Material de Som no Pronto da Reserva

## Objetivo
Adicionar a categoria **MATERIAL DE SOM** à página Pronto da Reserva, separando corretamente esses equipamentos de Materiais Diversos e mantendo os quantitativos sincronizados com as alterações feitas em Equipamentos e Cautelas.

## Implementação
- Incluir **MATERIAL DE SOM** no resumo, filtro, seção detalhada, PDF e snapshots do Pronto.
- Classificar como som os itens cuja categoria, categoria principal, descrição ou marca indiquem `Som`, `Caixa`, `Caixa Acústica`, `Microfone`, `Mixer`, `Mesa de Som`, `Pedestal` ou `Attack`.
- Preservar as classificações existentes de HARRIS, MOTOROLA, SATELITAL e BALÍSTICO.
- Preencher **MATERIAL DIVERSOS** somente com equipamentos cuja categoria cadastrada pertença explicitamente ao grupo de materiais diversos.
- Não exibir no Pronto da Reserva itens sem grupo reconhecido ou pertencentes a grupos fora da relação apresentada no Pronto.
- Atualizar automaticamente a página quando houver inclusão, edição ou exclusão de equipamentos, cautelas ou itens de cautela.
- Manter o botão **Atualizar Pronto** como atualização manual adicional.

## Validação
- Confirmar que equipamentos de som aparecem somente em MATERIAL DE SOM.
- Confirmar que MATERIAL DIVERSOS contém somente os itens previstos na lista de equipamentos e que itens não reconhecidos não aparecem no Pronto.
- Confirmar que mudanças de situação por cautela atualizam os totais “No Pelotão”, “Fora” e “Baixados”.
- Verificar a página em tela pequena e desktop, além do estado de compilação.
