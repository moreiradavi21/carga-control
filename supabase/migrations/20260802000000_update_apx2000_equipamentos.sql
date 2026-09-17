-- Atualiza os 12 rádios APX 2000 com categoria, situação, marca e modelo corretos
-- Mantém patrimônio, nº série, descrição, localização e demais campos intactos

UPDATE equipamentos
SET
  categoria_id = (SELECT id FROM categorias WHERE nome = 'APX' LIMIT 1),
  situacao     = 'cautela_servico',
  marca        = 'MOTOROLA',
  modelo       = 'APX 2000'
WHERE patrimonio IN (
  '102186500105651',
  '102186500105652',
  '102186500105653',
  '102186500105654',
  '102186500105655',
  '102186500105656',
  '102186500105657',
  '102186500105658',
  '102186500105659',
  '102186500105660',
  '102186500105661',
  '102186500105662'
);
