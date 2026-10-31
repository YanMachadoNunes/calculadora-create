# calculadora-create

Calculadora do mod **Create** para o modpack **All the Mods 10** (Minecraft 1.21.1). Ela calcula quanto cada farm produz por hora, quanta energia (stress) consome e qual RPM rende mais.

As receitas, o stress e as configs são lidos dos jars do seu próprio pack. Os tempos de cada máquina seguem o código-fonte do Create 6.0.10, e cada função em `lib/mecanica.ts` cita a classe de onde veio.

## O que ela faz

- **Farms:** você escolhe um item (ferro, ouro, quartzo, areia, argila, farinha de osso... 233 itens renováveis) e ela monta a rota desde um gerador de pedra com broca. Mostra a linha de produção, os subprodutos e quantas brocas cabem na energia que você tem. Também diz qual RPM rende mais.
- **Árvores:** fazenda de árvores com deployer, farinha de osso e serra.
- **Energia:** roda d'água, moinho de vento, caldeira a vapor (com níveis de calor, água e tamanho), manivela, motor elétrico do Create Crafts & Additions e motor criativo.
- **Receitas:** busca em todas as receitas do Create e dos addons do pack, com ícones 3D renderizados a partir dos modelos do jogo.

## Rodar

Precisa do [bun](https://bun.sh) e do All the Mods 10 instalado no [Prism Launcher](https://prismlauncher.org).

```sh
bun install
bun run extrair   # lê os jars do pack e gera lib/dados/create.json + public/tex/
bun run dev       # http://localhost:3017
```

As texturas e receitas são assets da Mojang e dos autores dos mods, por isso não vêm no repositório. O `bun run extrair` gera esses arquivos a partir da sua instalação.

Se o Prism ou a instância estiverem em outro lugar (no Windows o Prism fica em `%APPDATA%\PrismLauncher`):

```sh
PRISM="/caminho/do/PrismLauncher" bun run extrair "/caminho/da/instancia"
```

Atualizou o pack? Rode `bun run extrair` de novo.

## Limites

- O número de troncos por árvore é uma média da geração vanilla. O resto segue o código do Create.
- Os valores vêm da config do servidor que está na instância (`config/create-server.toml`). Se o seu servidor usa outra, os números mudam.

## Licença

[MIT](LICENSE). Projeto de fã, sem ligação com a Mojang, com o time do Create ou com o All the Mods.
