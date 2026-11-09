/* Fio-Mar Gestor — Diagnóstico (motores gasolina, etanol e flex)
   Aba "Diagnóstico" na O.S. e item "Diagnóstico" no menu.
   Informe códigos de falha e sintomas; a ferramenta mostra o caminho rápido dos casos
   já resolvidos na oficina, as causas prováveis e os testes com os equipamentos da oficina.
   O defeito encontrado vira um caso no histórico e preenche o laudo técnico da O.S.
   Funciona sem internet de IA: tudo é calculado aqui no aparelho. */
(function (G) {
'use strict';
const norm=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

/* ================= EQUIPAMENTOS ================= */
const EQ={scan:'Scanner',osc:'Osciloscópio',amp:'Alicate amperímetro',mcomb:'Manômetro de combustível',mcomp:'Manômetro de compressão',mult:'Multímetro',vis:'Inspeção / manual',caneta:'Caneta de polaridade',vac:'Vacuômetro',fum:'Máquina de fumaça',leak:'Teste de vazamento de cilindro',co2:'Teste de CO₂ (junta)',arref:'Bomba de teste do arrefecimento',ir:'Termômetro infravermelho',moleo:'Manômetro de óleo',est:'Estetoscópio'};
const EQ_DEFAULT=['scan','osc','mcomb','mcomp','mult','vis'];

/* ================= BIBLIOTECA DE TESTES ================= */
const T={
codes:['Ler códigos e freeze frame',['scan'],'Ler todos os módulos. Anotar códigos ativos e memorizados e o freeze frame (rotação, temperatura, carga, correções).','Sem códigos, ou códigos que expliquem o sintoma.'],
ft:['Correções de combustível (STFT + LTFT)',['scan'],'Motor quente. Anotar STFT e LTFT em marcha lenta e a 2.500 rpm estável. Use a calculadora de correção.','Soma entre −10% e +10%. Positivo = mistura pobre; negativo = rica.'],
misf:['Contador de falhas por cilindro',['scan'],'Ver o contador de falhas por cilindro em marcha lenta e rodando com carga.','Zero ou quase zero em todos os cilindros.'],
ect:['Temperatura do motor no scanner',['scan'],'Comparar a leitura do sensor de temperatura com a temperatura real, com motor frio e quente.','Frio: igual à temperatura ambiente. Quente: 85–105 °C.'],
rpmcrank:['RPM durante a partida',['scan'],'Ver a rotação no scanner enquanto dá partida.','Acima de ~150 rpm. Zero = sem sinal do sensor de rotação.'],
map:['Sensor MAP',['scan'],'Ler o MAP com chave ligada e motor desligado, depois em marcha lenta quente.','Desligado ≈ 100 kPa ao nível do mar (cai com a altitude). Marcha lenta 25–40 kPa.'],
maf:['Sensor MAF (g/s)',['scan'],'Ler g/s em marcha lenta quente e numa acelerada rápida.','Marcha lenta ≈ 1,5–2,5 g/s por litro de cilindrada; sobe junto com a rotação.'],
tps:['Varredura do TPS / pedal',['osc'],'Osciloscópio no sinal do TPS (ou nos dois sinais do pedal e da borboleta eletrônica). Abrir e fechar devagar.','Sinal liso, sem quedas. Fechado 0,3–0,9 V; aberto 4,0–4,8 V. Sinais duplos sobem juntos.'],
o2:['Sonda lambda pré-catalisador',['osc','scan'],'Motor quente a 2.500 rpm. Osciloscópio (ou gráfico do scanner) no sinal da sonda.','Oscila entre 0,1 e 0,9 V várias vezes por segundo, com subidas e descidas rápidas.'],
o2post:['Sonda pós-catalisador',['scan','osc'],'Comparar a sonda pré e a pós com motor quente.','Pós-cat estável entre 0,45 e 0,7 V enquanto a pré oscila.'],
idle:['Marcha lenta desejada x real',['scan'],'Comparar RPM desejada e real e a abertura do atuador de marcha lenta, ligando AC, faróis e esterçando.','Real acompanha a desejada; abertura do atuador dentro do normal.'],
vvt:['Comando variável desejado x real',['scan'],'Ler o ângulo desejado e o real do comando acelerando.','Real acompanha o desejado em poucos graus.'],
fan:['Acionar ventoinha',['scan'],'Acionar as velocidades pelo scanner e anotar a temperatura em que liga sozinha.','Liga pelo scanner e sozinha perto de 95–105 °C (varia).'],
pumpact:['Acionar bomba de combustível',['scan'],'Acionar pelo scanner ou ouvir ao ligar a chave (2–3 s).','Bomba funciona e desliga.'],
imob:['Imobilizador',['scan'],'Ver o status do imobilizador e os códigos de chave.','Chave reconhecida, sem bloqueio.'],
relearn:['Reaprendizado da borboleta',['scan'],'Depois de limpar, fazer o procedimento de reaprendizado da montadora.','Marcha lenta estável depois do procedimento.'],
coldstart:['Partida a frio (flex)',['scan'],'Ver no scanner o percentual de etanol aprendido e a temperatura. Testar a bomba e a válvula do tanquinho ou o aquecimento dos injetores.','Percentual coerente com o combustível do tanque. Sistema de partida a frio atuando abaixo de ~15–20 °C.'],
boost:['Pressão do turbo desejada x real',['scan'],'Ler a pressão de turbo desejada e a real em aceleração forte.','Real acompanha a desejada.'],
ckpcmp:['Sincronismo CKP x CMP',['osc'],'Dois canais: rotação (CKP) e fase (CMP) na partida ou marcha lenta. Comparar a falha da roda fônica com o pulso de fase.','Mesma relação do padrão do motor. Deslocado = ponto fora ou distribuição esticada.'],
relcomp:['Compressão relativa (corrente de partida)',['osc+amp'],'Alicate no cabo da bateria. Desabilitar a injeção e dar partida. Comparar a altura dos picos de corrente.','Picos com a mesma altura (variação até ~10%). Pico mais baixo = cilindro com menos compressão.'],
ign:['Forma de onda da ignição',['osc'],'Ponta no primário (ou captador no secundário) de cada bobina, em marcha lenta e acelerando.','Tempo de queima de ~1–2 ms, linha de queima estável e parecida entre os cilindros.'],
injwave:['Forma de onda do injetor',['osc'],'Ponta no fio de comando do injetor em marcha lenta. Comparar todos.','Pulso limpo e pico de desligamento parecido entre os injetores. Pico baixo ou ausente = bobina do injetor ruim.'],
pumpcur:['Corrente da bomba de combustível',['osc+amp'],'Alicate no fio da bomba com motor funcionando.','Ondulação regular. Corrente típica 4–8 A. Alta = bomba forçando; irregular = coletor da bomba gasto.'],
knock:['Sinal do sensor de detonação',['osc'],'Osciloscópio no sinal. Bater de leve no bloco perto do sensor.','Sinal aparece a cada batida. Torque de fixação correto.'],
ripple:['Ondulação do alternador',['osc'],'Osciloscópio em AC na bateria, motor a 2.000 rpm com carga ligada.','Ondulação uniforme e baixa (até ~0,5 V pico a pico). Irregular = diodo com defeito.'],
can:['Rede CAN',['osc','mult'],'Bateria desligada: resistência entre os pinos 6 e 14 do conector OBD. Chave ligada: CAN-H e CAN-L.','≈ 60 Ω. CAN-H 2,5–3,5 V e CAN-L 1,5–2,5 V, espelhados.'],
fpress:['Pressão de combustível',['mcomb'],'Manômetro na linha ou na válvula do rail. Medir com chave ligada e em marcha lenta.','Com regulador no retorno: 2,5–3,0 bar em marcha lenta. Sem retorno: 3,5–4,0 bar. Conferir especificação.'],
fhold:['Retenção de pressão',['mcomb'],'Desligar o motor e acompanhar o manômetro por 5 a 10 minutos.','Pressão se mantém, com queda lenta. Queda rápida = injetor pingando, regulador ou válvula de retenção da bomba.'],
faccel:['Pressão em aceleração',['mcomb'],'Manômetro visível; acelerar forte, ou rodar com o manômetro preso no para-brisa.','Pressão se mantém. Queda = bomba fraca ou filtro entupido.'],
fflow:['Vazão da bomba',['mcomb'],'Desviar a saída para uma proveta e acionar a bomba por tempo marcado.','Conferir a especificação. Referência comum: acima de ~1 L/min.'],
freg:['Regulador de pressão',['mcomb'],'Em sistemas com regulador ligado ao coletor: tirar a mangueira de vácuo do regulador em marcha lenta.','Pressão sobe cerca de 0,5 bar. Combustível na mangueira = diafragma furado.'],
compdry:['Compressão a seco',['mcomp'],'Motor quente, todas as velas fora, borboleta toda aberta, injeção desligada. 4 a 6 compressões por cilindro.','8,5–14 bar (120–200 psi), conforme o motor. Diferença máxima entre cilindros: 10%.'],
compwet:['Compressão molhada',['mcomp'],'No cilindro baixo, colocar uma colher de óleo e medir de novo.','Sobe bastante = anéis. Não muda = válvula ou junta.'],
leak:['Vazamento de cilindro',['leak'],'Cilindro no PMS de compressão, ar comprimido pelo furo da vela.','Até 10–15%. Ar no escape = válvula de escape; na admissão = válvula de admissão; no cárter = anéis; bolhas no radiador = junta ou cabeçote.'],
vacidle:['Vácuo em marcha lenta',['vac'],'Vacuômetro direto no coletor, motor quente.','17–21 inHg estável. Baixo e estável = ponto atrasado ou entrada de ar; ponteiro batendo = válvula.'],
vac2500:['Vácuo a 2.500 rpm (escape entupido)',['vac'],'Manter 2.500 rpm por um minuto.','Vácuo igual ou acima da marcha lenta. Caindo aos poucos = catalisador ou escapamento entupido.'],
smoke:['Teste de fumaça na admissão',['fum'],'Injetar fumaça no coletor com motor desligado.','Nenhuma saída de fumaça. Procurar em mangueiras, juntas, PCV e servo-freio.'],
co2:['Teste de CO₂ no arrefecimento',['co2'],'Reagente no gargalo do reservatório com motor quente.','Reagente não muda de cor. Mudou = gás de combustão no arrefecimento (junta ou cabeçote).'],
coolpress:['Teste de pressão do arrefecimento',['arref'],'Pressurizar o sistema na pressão da tampa (≈ 1,0–1,4 bar) e testar a tampa.','Pressão se mantém por 15 min. Tampa abre na pressão marcada.'],
irtemp:['Temperaturas com termômetro IR',['ir'],'Medir mangueira superior, inferior e várias partes do radiador enquanto o motor aquece.','Mangueira superior esquenta quando o termostato abre; radiador com temperatura uniforme.'],
oilpress:['Pressão de óleo',['moleo'],'Manômetro no lugar do interruptor de óleo. Medir quente em marcha lenta e a 3.000 rpm.','Marcha lenta quente ≥ 1 bar; 3.000 rpm 3–5 bar.'],
stetho:['Localizar ruído',['est','vis'],'Estetoscópio (ou chave de fenda longa) no cabeçote, bloco, alternador, bomba d’água e tensores, variando a rotação.','Origem isolada. Ruído que some ao retirar a correia = acessório.'],
bat:['Bateria: repouso, partida e carga',['mult'],'Medir em repouso (parado > 1 h), durante a partida e com motor ligado.','12,6 V em repouso; ≥ 9,6 V na partida; 13,8–14,7 V ligado.'],
drop:['Queda de tensão',['mult'],'Multímetro nas duas pontas do mesmo cabo, com o circuito funcionando.','Positivo da partida ≤ 0,5 V; massas ≤ 0,3 V; massa de sensor ≤ 0,1 V.'],
draw:['Corrente de fuga',['mult'],'Amperímetro em série no negativo, portas fechadas; esperar os módulos dormirem (5–30 min).','Abaixo de 50 mA. Acima: medir a queda de tensão sobre cada fusível para achar o circuito.'],
refgnd:['Referência 5 V e massa dos sensores',['mult'],'Medir a referência no conector com chave ligada e a massa contra o negativo da bateria.','Referência 4,9–5,1 V. Massa ≤ 0,1 V.'],
res:['Resistência do componente',['mult'],'Medir o componente desconectado e comparar com a especificação.','Ver aba Valores (injetor 12–16 Ω, bobina primário 0,4–2 Ω, sensor de temperatura etc.).'],
noid:['Pulso dos injetores na partida',['caneta','osc'],'Caneta de polaridade ou osciloscópio no conector do injetor durante a partida.','Pulso em todos os injetores.'],
spark:['Teste de faísca',['vis'],'Centelhador em cada bobina durante a partida. Nunca deixar a bobina disparar sem carga.','Faísca forte e azulada em todos os cilindros.'],
oilvis:['Inspeção do óleo',['vis'],'Nível, aparência e cheiro na vareta e na tampa de óleo.','Nível certo, sem borra, sem emulsão (“maionese”), sem cheiro forte de combustível, sem limalha.'],
coolvis:['Inspeção do arrefecimento',['vis'],'Nível no reservatório com motor frio e aparência do líquido.','Nível certo, sem óleo, sem bolhas com o motor funcionando.'],
belt:['Correias, tensores e polias',['vis'],'Ver desgaste, trincas e tensão; girar as polias à mão sem a correia.','Correia sem trincas, tensor firme, polias sem folga ou ruído.'],
plugs:['Inspeção das velas',['vis'],'Retirar e comparar cor e folga de todas.','Marrom-clara, folga certa. Preta = rico; oleada = óleo na câmara; branca = pobre ou superaquecida.'],
leaksvis:['Procurar vazamentos',['vis'],'Motor limpo; procurar óleo, água e combustível na tampa de válvulas, retentores, cárter, mangueiras e bomba d’água.','Sem vazamentos.'],
mounts:['Coxins do motor e do câmbio',['vis'],'Observar o motor acelerando em vazio e engatando.','Movimento pequeno, sem batida. Borracha sem trincas.'],
exhvis:['Escapamento',['vis'],'Procurar vazamentos (marcas pretas, ruído) e observar a cor da fumaça.','Sem vazamento antes das sondas. Sem fumaça com motor quente.'],
tbvis:['Corpo de borboleta',['vis'],'Retirar a mangueira e olhar a borboleta e o canal de marcha lenta.','Limpo. Carvão na borda da borboleta altera a marcha lenta.'],
airfilter:['Filtro de ar e dutos',['vis'],'Conferir o filtro e os dutos depois do MAF.','Filtro limpo; dutos sem trincas e bem presos.'],
blowby:['Blow-by e PCV',['vis'],'Motor quente em marcha lenta: soltar a tampa de óleo e observar. Conferir a válvula PCV.','Pouco vapor e leve vácuo. Muita fumaça pulsando = anéis ou pistão gastos.'],
timingmk:['Conferir ponto da distribuição',['vis'],'Girar o motor pela polia e conferir as marcas (ou ferramenta de travamento).','Marcas alinhadas. Correia ou corrente sem folga excessiva.'],
turnhand:['Girar o motor pela polia',['vis'],'Chave desligada; girar o virabrequim com catraca.','Gira livre, com resistência só da compressão. Travado = motor calçado ou com água no cilindro.'],
oilcons:['Controle de consumo de óleo',['vis'],'Completar o nível, marcar e medir de novo depois de 1.000 km.','Consumo dentro do que o manual aceita.'],
fuelq:['Qualidade do combustível',['vis'],'Coletar amostra. Teste de proveta para o teor de etanol na gasolina; ver água e sujeira.','Teor de etanol dentro do permitido pela ANP; sem água nem sedimentos.']
};
const TESTS={};Object.keys(T).forEach(k=>{const v=T[k];TESTS[k]={id:k,n:v[0],eq:v[1],como:v[2],esp:v[3]};});

/* ================= CÓDIGOS ================= */
const DCODES=[
['P0010','Solenoide do comando variável (VVT) — circuito, banco 1',2,'Falha elétrica no circuito da válvula solenoide do VVT.',['Solenoide VVT aberta ou em curto','Chicote ou conector','Driver da ECU'],['res','vvt','refgnd']],
['P0011','Comando de admissão avançado demais, banco 1',2,'O ângulo real do comando não acompanha o pedido pela ECU.',['Óleo sujo, baixo ou de viscosidade errada','Solenoide VVT travada ou tela filtrante entupida','Variador de fase com defeito','Distribuição esticada ou fora de ponto'],['oilvis','vvt','ckpcmp','timingmk']],
['P0016','Correlação virabrequim x comando, banco 1',3,'Sinais de rotação e fase fora da relação esperada. O ponto pode estar errado.',['Corrente esticada ou tensor gasto','Correia dentada pulou dente','Variador VVT travado','Roda fônica ou sensor danificados'],['ckpcmp','timingmk','vvt','oilvis']],
['P0087','Pressão do rail de combustível baixa',3,'A pressão no rail ficou abaixo da pedida.',['Filtro de combustível entupido','Bomba de combustível fraca','Bomba de alta pressão gasta (injeção direta)','Sensor de pressão do rail'],['fpress','faccel','fflow','pumpcur']],
['P0100','Sensor MAF — circuito',2,'Falha elétrica no circuito do medidor de massa de ar.',['Conector solto ou oxidado','Falta de alimentação ou massa','Sensor MAF queimado'],['refgnd','maf','airfilter']],
['P0101','Sensor MAF — faixa/desempenho',2,'A leitura do MAF não bate com o calculado por rotação, borboleta e MAP.',['MAF sujo','Entrada falsa de ar','Filtro de ar obstruído','Sensor MAF degradado'],['maf','airfilter','smoke','ft']],
['P0102','Sensor MAF — sinal baixo',2,'Sinal do MAF abaixo do mínimo.',['Falta de alimentação ou massa','Fio de sinal aberto','Sensor MAF queimado'],['refgnd','maf']],
['P0106','Sensor MAP — faixa/desempenho',2,'A pressão do coletor lida não condiz com a carga do motor.',['Mangueira do MAP rachada ou solta','Entrada falsa de ar','Ponto da distribuição fora','Sensor MAP descalibrado'],['map','vacidle','smoke','timingmk']],
['P0107','Sensor MAP — sinal baixo',2,'Sinal do MAP abaixo do limite.',['Falta da referência de 5 V','Sinal em curto com massa','Sensor MAP com defeito'],['refgnd','map']],
['P0108','Sensor MAP — sinal alto',2,'Sinal do MAP acima do limite.',['Massa do sensor aberta','Sinal em curto com 5 V','Mangueira do MAP rachada ou solta'],['refgnd','map']],
['P0113','Sensor de temperatura do ar — sinal alto',1,'Circuito aberto: o scanner mostra cerca de −40 °C.',['Conector solto','Fio aberto','Sensor de temperatura do ar aberto'],['res','refgnd']],
['P0117','Sensor de temperatura do motor — sinal baixo',2,'Sinal em curto com massa: o scanner mostra temperatura muito alta.',['Sensor de temperatura em curto','Fio de sinal encostando na massa','Água no conector'],['ect','res']],
['P0118','Sensor de temperatura do motor — sinal alto',2,'Circuito aberto: scanner mostra cerca de −40 °C. Ventoinha pode ficar ligada direto e a partida fica difícil.',['Conector solto ou oxidado','Fio aberto','Sensor de temperatura aberto'],['ect','res','refgnd']],
['P0121','Sensor TPS — faixa/desempenho',2,'O TPS não acompanha a rotação ou o MAP.',['Pista do TPS gasta','Corpo de borboleta sujo','Mau contato no conector'],['tps','tbvis','relearn']],
['P0122','Sensor TPS — sinal baixo',2,'Sinal do TPS abaixo do limite.',['Falta da referência de 5 V','Sinal em curto com massa','Sensor TPS aberto'],['refgnd','tps']],
['P0123','Sensor TPS — sinal alto',2,'Sinal do TPS acima do limite.',['Massa do sensor aberta','Sinal em curto com 5 V','Sensor TPS com defeito'],['refgnd','tps']],
['P0128','Temperatura do motor abaixo da regulagem',1,'O motor demora demais para chegar à temperatura de trabalho.',['Termostato travado aberto','Sensor de temperatura lendo errado','Ventoinha ligada direto'],['ect','irtemp','fan']],
['P0130','Sonda lambda B1S1 — circuito',2,'Falha no circuito da sonda antes do catalisador.',['Sonda lambda com defeito','Chicote derretido no escapamento','Conector oxidado'],['o2','exhvis','refgnd']],
['P0133','Sonda lambda B1S1 — resposta lenta',2,'A sonda demora para alternar entre rico e pobre.',['Sonda lambda envelhecida ou contaminada','Vazamento no escapamento','Mistura desequilibrada'],['o2','exhvis','ft']],
['P0134','Sonda lambda B1S1 — sem atividade',2,'Sinal parado em torno de 0,45 V.',['Sonda lambda com defeito','Aquecedor da sonda queimado','Fio de sinal aberto'],['o2','res']],
['P0135','Aquecedor da sonda B1S1 — circuito',1,'Falha no resistor de aquecimento da sonda dianteira.',['Aquecedor da sonda queimado','Fusível ou relé','Chicote aberto'],['res','refgnd']],
['P0136','Sonda pós-catalisador B1S2 — circuito',1,'Falha no circuito da sonda depois do catalisador.',['Sonda pós-catalisador com defeito','Chicote danificado','Conector oxidado'],['o2post','exhvis']],
['P0141','Aquecedor da sonda B1S2 — circuito',1,'Falha no aquecimento da sonda pós-catalisador.',['Aquecedor da sonda queimado','Fusível ou relé','Chicote aberto'],['res']],
['P0171','Mistura pobre, banco 1',2,'A ECU está adicionando combustível demais para compensar (correção total acima de ~+25%).',['Entrada falsa de ar','MAF sujo','Pressão de combustível baixa','Injetor entupido','Vazamento no escapamento'],['ft','fpress','faccel','fflow','injwave','maf','smoke','vacidle','exhvis']],
['P0172','Mistura rica, banco 1',2,'A ECU está tirando combustível para compensar (correção total abaixo de ~−25%).',['Pressão de combustível alta','Injetor pingando','Sensor de temperatura lendo frio','Filtro de ar obstruído','Purga do canister presa aberta'],['ft','fpress','fhold','freg','ect','o2','airfilter']],
['P0174','Mistura pobre, banco 2',2,'Igual ao P0171, no banco 2. P0171 + P0174 juntos indicam causa comum aos dois bancos.',['Entrada falsa de ar','MAF sujo','Pressão de combustível baixa','Injetor entupido'],['ft','fpress','maf','smoke']],
['P0175','Mistura rica, banco 2',2,'Igual ao P0172, no banco 2.',['Pressão de combustível alta','Injetor pingando','Sensor de temperatura lendo frio'],['ft','fpress','fhold','ect']],
['P0217','Superaquecimento do motor',3,'Temperatura acima do limite. Desligar o motor para não empenar o cabeçote.',['Nível baixo ou vazamento','Ventoinha não liga','Termostato travado fechado','Bomba d’água','Junta do cabeçote queimada'],['coolvis','leaksvis','fan','irtemp','coolpress','co2','oilvis']],
['P0230','Bomba de combustível — circuito primário',3,'Falha no circuito de comando do relé ou módulo da bomba.',['Relé da bomba','Fusível','Chicote aberto','Interruptor inercial acionado'],['pumpact','drop','fpress']],
['P0234','Sobrepressão do turbo',3,'Pressão de turbo acima do limite.',['Wastegate presa fechada','Atuador ou solenoide do turbo','Mangueira de controle invertida ou entupida'],['boost']],
['P0299','Turbo abaixo da pressão',2,'Pressão de turbo abaixo do pedido.',['Vazamento em mangueira ou intercooler','Wastegate presa aberta','Turbina gasta','Válvula de alívio vazando'],['boost','smoke']],
['P0300','Falha de combustão em vários cilindros',3,'Falhas em mais de um cilindro. Luz de injeção piscando = catalisador sendo danificado.',['Entrada falsa de ar','Pressão de combustível baixa','Velas e cabos gastos','Combustível adulterado','Compressão baixa','Ponto da distribuição fora'],['misf','ft','fpress','fuelq','plugs','ign','relcomp','compdry','smoke','timingmk']],
['P0320','Sinal de rotação do motor (ignição) — circuito',3,'A ECU não recebe o sinal de rotação/referência de ignição. O motor pode não pegar ou desligar rodando.',['Sensor de rotação com defeito','Roda fônica danificada','Chicote aberto ou em curto','Folga ou limalha no sensor'],['rpmcrank','res','ckpcmp','refgnd']],
['P0321','Sinal de rotação do motor (ignição) — faixa/desempenho',2,'O sinal de rotação/referência de ignição está irregular: pulsos faltando, extras ou com ruído. Pode causar falhas, trancos e o motor apagar.',['Sensor de rotação com defeito','Roda fônica danificada ou suja','Interferência no chicote (cabos de vela, massa ruim)','Folga ou limalha no sensor','Conector com mau contato'],['ckpcmp','rpmcrank','res','drop','ign']],
['P0322','Sinal de rotação do motor (ignição) — sem sinal',3,'Nenhum pulso de rotação/ignição chega à ECU. O motor gira e não pega.',['Sensor de rotação com defeito','Chicote aberto','Falta de alimentação do sensor','Roda fônica danificada'],['rpmcrank','refgnd','res','ckpcmp']],
['P0341','Sensor de fase (CMP) — faixa/desempenho',2,'Sinal de fase irregular ou fora de posição em relação à rotação.',['Ponto da distribuição fora','Sensor de fase com defeito','Roda de fase danificada','Interferência no chicote'],['ckpcmp','timingmk','refgnd']],
['P0115','Sensor de temperatura do motor — circuito',2,'Falha elétrica no circuito do sensor de temperatura do motor.',['Sensor de temperatura com defeito','Conector oxidado','Chicote aberto ou em curto'],['ect','res','refgnd']],
['P0116','Sensor de temperatura do motor — faixa/desempenho',2,'A temperatura lida não condiz com o tempo de funcionamento do motor.',['Sensor de temperatura lendo errado','Termostato travado aberto','Nível baixo de líquido de arrefecimento'],['ect','irtemp','coolvis']],
['P0125','Temperatura insuficiente para malha fechada',1,'O motor demora para chegar à temperatura de trabalho da sonda lambda.',['Termostato travado aberto','Sensor de temperatura lendo errado'],['ect','irtemp']],
['P0401','EGR — fluxo insuficiente',2,'A ECU não viu o efeito esperado ao abrir a válvula EGR.',['Válvula EGR carbonizada','Dutos da EGR entupidos','Solenoide de controle da EGR'],['map','vacidle','res']],
['P0500','Sensor de velocidade do veículo',2,'Sem sinal de velocidade ou sinal incoerente.',['Sensor de velocidade com defeito','Chicote','Módulo ABS (quando o sinal vem dele)'],['codes','refgnd','res']],
['P0700','Sistema da transmissão automática — falha registrada',2,'A ECU do motor avisa que o módulo do câmbio tem código registrado.',['Falha registrada no módulo do câmbio'],['codes']],
['P0325','Sensor de detonação — circuito',1,'Falha no circuito do sensor de detonação.',['Sensor de detonação solto','Chicote danificado','Sensor de detonação com defeito'],['knock','res']],
['P0327','Sensor de detonação — sinal baixo',1,'Sinal do sensor de detonação abaixo do esperado.',['Sensor de detonação solto','Fio em curto com massa','Sensor de detonação com defeito'],['knock']],
['P0335','Sensor de rotação (CKP) — circuito',3,'Sem sinal de rotação: o motor gira e não pega, ou apaga rodando.',['Sensor de rotação com defeito','Folga ou limalha no sensor','Roda fônica danificada','Chicote aberto'],['rpmcrank','res','ckpcmp']],
['P0336','Sensor de rotação (CKP) — faixa/desempenho',2,'Sinal de rotação com falhas ou ruído.',['Roda fônica danificada','Folga ou limalha no sensor','Interferência no chicote'],['ckpcmp']],
['P0340','Sensor de fase (CMP) — circuito',2,'Sem sinal de fase. O motor pode demorar para pegar.',['Sensor de fase com defeito','Falta de alimentação','Chicote aberto','Ponto da distribuição fora'],['refgnd','ckpcmp','timingmk']],
['P0420','Eficiência do catalisador baixa, banco 1',1,'A sonda pós-cat copia a dianteira: o catalisador não armazena oxigênio.',['Catalisador gasto','Vazamento no escapamento','Sonda pós-catalisador com defeito','Falhas de combustão anteriores'],['o2','o2post','exhvis','misf','vac2500']],
['P0430','Eficiência do catalisador baixa, banco 2',1,'Igual ao P0420, no banco 2.',['Catalisador gasto','Vazamento no escapamento','Sonda pós-catalisador com defeito'],['o2','o2post','exhvis']],
['P0442','EVAP — vazamento pequeno',1,'Vazamento pequeno no sistema de vapores de combustível.',['Tampa do tanque','Mangueira do canister trincada','Válvula de purga vazando'],['leaksvis','smoke']],
['P0443','Válvula de purga do canister — circuito',1,'Falha elétrica na válvula de purga.',['Válvula de purga com defeito','Chicote','Conector'],['res']],
['P0455','EVAP — vazamento grande',1,'Vazamento grande ou tampa ausente.',['Tampa do tanque','Mangueira desconectada','Canister trincado'],['leaksvis','smoke']],
['P0480','Relé da ventoinha — circuito',2,'Falha no circuito de comando do relé da ventoinha.',['Relé da ventoinha','Fusível','Chicote aberto'],['fan','drop']],
['P0505','Controle de marcha lenta — sistema',2,'A ECU não consegue controlar a marcha lenta.',['Corpo de borboleta sujo','Atuador de marcha lenta','Entrada falsa de ar'],['tbvis','idle','relearn','smoke']],
['P0506','Marcha lenta abaixo do esperado',1,'Rotação real abaixo da desejada.',['Corpo de borboleta sujo','Atuador de marcha lenta','Carga extra (alternador, AC)'],['idle','tbvis','relearn']],
['P0507','Marcha lenta acima do esperado',1,'Rotação real acima da desejada.',['Entrada falsa de ar','Borboleta sem reaprendizado'],['idle','smoke','relearn']],
['P0520','Pressão de óleo — circuito do sensor',2,'Falha no circuito de pressão de óleo. Confirme a pressão real antes de tudo.',['Interruptor de óleo com defeito','Chicote','Pressão de óleo realmente baixa'],['oilvis','oilpress','refgnd']],
['P0562','Tensão do sistema baixa',2,'Tensão de alimentação da ECU abaixo do mínimo.',['Alternador não carregando','Bateria no fim da vida','Terminal oxidado','Massa da ECU'],['bat','drop','ripple']],
['P0563','Tensão do sistema alta',2,'Tensão acima do máximo.',['Regulador do alternador','Massa do regulador'],['bat','drop']],
['P0606','Processador da ECU',3,'Falha interna detectada pela ECU.',['ECU com defeito','Alimentação ou massa instáveis','Software'],['bat','drop','refgnd']],
['P0641','Referência de 5 V "A" — circuito',3,'Referência de 5 V fora da faixa. Costuma gerar vários códigos de sensor juntos.',['Sensor em curto puxando a referência','Chicote em curto','ECU'],['refgnd']],
['P2096','Correção pós-catalisador — pobre, banco 1',2,'A sonda traseira indica mistura pobre persistente.',['Vazamento no escapamento','Sonda lambda descalibrada','Entrada falsa de ar'],['exhvis','o2','o2post','ft']],
['P2097','Correção pós-catalisador — rico, banco 1',2,'A sonda traseira indica mistura rica persistente.',['Sonda lambda descalibrada','Injetor pingando','Catalisador gasto'],['o2','o2post','fhold']],
['P2101','Motor da borboleta eletrônica — desempenho',3,'A borboleta não chega à posição pedida. Pode entrar em modo de emergência.',['Corpo de borboleta sujo','Motor da borboleta gasto','Chicote ou conector'],['tbvis','tps','relearn']],
['P2135','Sensores da borboleta A/B — correlação',3,'Os dois sinais de posição da borboleta não concordam.',['Pista do sensor gasta','Conector','Chicote'],['tps','refgnd']],
['P2138','Sensores do pedal D/E — correlação',3,'Os dois sinais do pedal não concordam.',['Pedal com pista gasta','Conector','Chicote'],['tps','refgnd']],
['P2187','Sistema pobre em marcha lenta, banco 1',2,'Pobre só em marcha lenta: típico de entrada falsa de ar.',['Mangueira de vácuo rachada','PCV / respiro do cárter','Junta do coletor de admissão','Servo-freio vazando'],['ft','smoke','vacidle','blowby']],
['P2188','Sistema rico em marcha lenta, banco 1',2,'Mistura rica em marcha lenta.',['Injetor pingando','Purga do canister presa aberta','Pressão de combustível alta'],['ft','fhold','fpress','freg']],
['U0100','Perda de comunicação com a ECU do motor',3,'Um módulo não recebe mensagens da ECU do motor na rede CAN.',['ECU sem alimentação ou massa','Rede CAN aberta ou em curto','Conector da ECU oxidado'],['can','bat','drop']],
['U0101','Perda de comunicação com o módulo do câmbio',2,'Sem mensagens do módulo do câmbio automático.',['Alimentação do módulo','Rede CAN','Conector'],['can','drop']],
['U0121','Perda de comunicação com o ABS',2,'Sem mensagens do ABS na rede.',['Fusível do ABS','Conector do módulo','Rede CAN'],['can','drop']],
['U0140','Perda de comunicação com o módulo da carroceria',2,'Sem mensagens do BCM na rede.',['Alimentação do BCM','Rede CAN','Umidade no módulo'],['can','drop']]
];
const DB={};DCODES.forEach(r=>DB[r[0]]={c:r[0],t:r[1],s:r[2],m:r[3],ca:r[4],tests:r[5]});
function pattern(c){
  if(/^P02(0[1-9]|1[0-2])$/.test(c)){const n=parseInt(c.slice(3),10);return {c,t:`Injetor do cilindro ${n} — circuito`,s:2,m:`Falha elétrica no circuito do injetor do cilindro ${n}.`,ca:[`Injetor do cilindro ${n} com defeito`,'Chicote ou conector','Driver da ECU'],tests:['res','injwave','noid']};}
  let m=/^P03(0[1-9]|1[0-2])$/.exec(c);
  if(m){const n=parseInt(m[1],10);return {c,t:`Falha de combustão no cilindro ${n}`,s:3,m:`Falhas no cilindro ${n}. Troque bobina e vela de posição com outro cilindro: se a falha muda de cilindro, a peça é a culpada.`,ca:[`Vela do cilindro ${n}`,`Bobina do cilindro ${n}`,`Injetor do cilindro ${n}`,`Compressão baixa no cilindro ${n}`],tests:['misf','plugs','ign','injwave','relcomp','compdry','compwet','leak']};}
  m=/^P03(5[1-9]|6[0-2])$/.exec(c);
  if(m){const n=parseInt(c.slice(3),10)-50;const L='ABCDEFGHIJKL'[n-1];return {c,t:`Bobina de ignição ${L} — circuito`,s:2,m:`Falha no circuito da bobina ${L} (cilindro ${n} na maioria dos motores).`,ca:[`Bobina do cilindro ${n}`,'Chicote ou conector','Driver da ECU'],tests:['ign','res','drop','misf']};}
  return null;
}
const lookupBase=c=>DB[c]||pattern(c);

const SUB={'0':'Combustível, ar e emissões','1':'Medição de ar e combustível','2':'Injetores','3':'Ignição e falhas de combustão','4':'Emissões auxiliares','5':'Velocidade e marcha lenta','6':'ECU e saídas','7':'Transmissão','8':'Transmissão','9':'Transmissão'};
const SYS={P:'Motor e transmissão',B:'Carroceria',C:'Chassi',U:'Rede de comunicação'};
const ctype=c=>{const d=c[1];if(c[0]==='P')return d==='1'||d==='3'?'Específico do fabricante':'Genérico (SAE)';return d==='0'?'Genérico (SAE)':'Específico do fabricante';};
const SEV={1:'Baixa',2:'Média',3:'Alta'};
/* aceita "po171", "0171", "p 0171" */
function parseCode(raw){
  let s=String(raw||'').toUpperCase().replace(/[\s.\-]/g,'');
  if(!s)return {ok:false,empty:true};
  if(/^[0-9O]{4}$/.test(s))s='P'+s;
  if(/^[PBCU][0-9A-FO]{4}$/.test(s))s=s[0]+s.slice(1).replace(/O/g,'0');
  if(/^[PBCU][0-3][0-9A-F]{3}$/.test(s))return {ok:true,code:s};
  return {ok:false,raw:s};
}

/* ================= SINTOMAS ================= */
const SG=[['Partida',['gira-nao-pega','partida-frio','partida-quente','nao-gira']],['Funcionamento',['marcha-lenta','morre','falha-aceleracao','perda-potencia','vibracao','detonacao','consumo']],['Temperatura e óleo',['superaquecimento','agua-oleo','consumo-oleo','pressao-oleo','vazamento-oleo']],['Ruído e fumaça',['ruido-motor','fumaca-preta','fumaca-branca']],['Elétrica',['bateria','luz-injecao']]];
const SY=[
['gira-nao-pega','Gira mas não pega',['nao pega','nao liga','nao funciona','nao da partida','gira mas','nao pegou'],['codes','rpmcrank','imob','pumpact','fpress','noid','spark','ckpcmp','timingmk','relcomp','compdry','ect','fuelq'],['Sensor de rotação com defeito','Imobilizador bloqueando','Bomba de combustível ou relé','Sem pulso nos injetores','Sem faísca','Correia dentada rompida ou pulada','Sensor de temperatura lendo errado','Combustível adulterado']],
['partida-frio','Partida difícil a frio (flex)',['frio','manha','etanol','alcool','tanquinho','partida dificil','demora pra pegar','demora para pegar','demora pegar'],['codes','coldstart','ect','fhold','bat','plugs','spark','fuelq'],['Sistema de partida a frio','Sensor de temperatura lendo errado','Retenção de pressão baixa','Bateria no fim da vida','Velas e cabos gastos','Adaptação de etanol errada']],
['partida-quente','Partida difícil a quente',['quente','depois de rodar','motor quente'],['codes','fhold','freg','ect','rpmcrank','ckpcmp'],['Retenção de pressão baixa','Injetor pingando','Sensor de temperatura lendo errado','Sensor de rotação com defeito']],
['nao-gira','Motor de partida não gira',['nao gira','clique','motor de arranque','arranque','tec tec','nao da sinal'],['bat','drop','turnhand'],['Bateria descarregada','Terminal oxidado','Motor de partida com defeito','Relé ou comutador de ignição','Inibidor de partida','Motor travado']],
['marcha-lenta','Marcha lenta irregular',['marcha lenta','oscila','oscilando','tremendo','irregular','lenta','sobe e desce'],['codes','misf','ft','tbvis','idle','relearn','smoke','vacidle','plugs','ign','relcomp','mounts'],['Corpo de borboleta sujo','Entrada falsa de ar','Velas e cabos gastos','Atuador de marcha lenta','Compressão desigual','Coxim quebrado']],
['morre','Motor morre em marcha lenta',['morre','apaga','desliga sozinho','cai a rotacao','morrendo'],['codes','tbvis','idle','relearn','ft','smoke','fhold','ckpcmp'],['Corpo de borboleta sujo','Entrada falsa de ar','Sensor de rotação com defeito','Retenção de pressão baixa','Atuador de marcha lenta']],
['falha-aceleracao','Falha ao acelerar',['falha','falhando','engasga','engasgo','tranco','buraco','pipoca','acelerar'],['codes','misf','plugs','ign','faccel','fpress','tps','maf','o2','fuelq','injwave'],['Bobina de ignição','Velas e cabos gastos','Bomba de combustível fraca','Filtro de combustível entupido','Pista do TPS gasta','MAF sujo','Injetor entupido','Combustível adulterado']],
['perda-potencia','Perda de potência',['fraco','sem forca','potencia','nao desenvolve','pesado','nao sobe giro','nao passa'],['codes','ft','faccel','fflow','airfilter','maf','tps','vvt','timingmk','ckpcmp','vac2500','exhvis','relcomp','compdry'],['Filtro de ar obstruído','Bomba de combustível fraca','Catalisador entupido','Ponto da distribuição fora','Compressão baixa','Comando variável travado']],
['consumo','Consumo alto de combustível',['consumo','gastando','gasta muito','beberrao','media baixa'],['codes','ft','ect','o2','fhold','freg','plugs','fuelq'],['Sensor de temperatura lendo frio','Termostato travado aberto','Sonda lambda lenta','Injetor pingando','Pressão de combustível alta']],
['detonacao','Batida de pino',['batida de pino','detonacao','pino','grilando'],['codes','fuelq','ect','ft','plugs','knock','compdry'],['Combustível adulterado','Entrada falsa de ar','Superaquecimento','Carvão na câmara de combustão','Sensor de detonação solto','Velas de grau térmico errado']],
['superaquecimento','Superaquecendo',['esquenta','esquentando','superaquec','ferve','fervendo','temperatura alta','ventoinha','aquecendo'],['coolvis','leaksvis','fan','ect','irtemp','coolpress','co2','oilvis'],['Nível baixo ou vazamento','Ventoinha não liga','Termostato travado fechado','Bomba d’água','Radiador obstruído','Junta do cabeçote queimada']],
['agua-oleo','Perde água / água no óleo',['agua no oleo','oleo na agua','maionese','perde agua','some agua','junta','cabecote','baixa agua'],['coolvis','oilvis','leaksvis','coolpress','co2','plugs','leak','compdry','exhvis'],['Junta do cabeçote queimada','Cabeçote trincado ou empenado','Trocador de calor do óleo','Bomba d’água']],
['consumo-oleo','Consumo de óleo / fumaça azul',['consumo de oleo','queima oleo','queimando oleo','fumaca azul','baixa oleo','gasta oleo'],['oilcons','leaksvis','blowby','plugs','compdry','compwet','leak'],['Retentores de válvula','Anéis gastos','PCV / respiro do cárter','Vazamento externo de óleo']],
['pressao-oleo','Luz de óleo acende',['luz do oleo','luz de oleo','pressao de oleo','oleo acende','sem pressao'],['oilvis','oilpress','refgnd','stetho'],['Nível de óleo baixo','Óleo de viscosidade errada','Interruptor de óleo com defeito','Bomba de óleo gasta','Pescador entupido','Bronzinas gastas']],
['ruido-motor','Ruído ou batida no motor',['barulho','ruido','batida','estalo','tucho','biela','chiado','assobio','grilo','bate'],['oilvis','stetho','belt','oilpress','timingmk','mounts','relcomp','compdry'],['Tucho hidráulico','Corrente ou tensor da distribuição','Bronzinas gastas','Rolamento de acessório','Correia patinando','Vazamento no escapamento']],
['vibracao','Vibração',['vibra','vibracao','treme','trepida'],['misf','mounts','relcomp','plugs','ign','compdry'],['Falha de combustão','Coxim quebrado','Compressão desigual','Polia do virabrequim danificada']],
['fumaca-preta','Fumaça preta',['fumaca preta','preta','cheiro de combustivel','cheiro de gasolina','afogado'],['ft','fpress','fhold','freg','airfilter','ect','o2'],['Pressão de combustível alta','Injetor pingando','Filtro de ar obstruído','Sensor de temperatura lendo frio','Sonda lambda com defeito']],
['fumaca-branca','Fumaça branca densa',['fumaca branca','branca','vapor'],['coolvis','co2','coolpress','leak','compdry'],['Junta do cabeçote queimada','Cabeçote trincado ou empenado']],
['vazamento-oleo','Vazamento de óleo',['vazamento','vazando','vaza oleo','pingando','pinga'],['leaksvis','blowby','oilvis'],['Junta da tampa de válvulas','Retentor do virabrequim ou comando','Junta do cárter','PCV / respiro do cárter']],
['bateria','Bateria descarregando',['bateria','descarrega','arriando','arria','sem carga','alternador'],['bat','ripple','draw','drop'],['Bateria no fim da vida','Alternador não carregando','Consumo com o carro parado','Terminal oxidado']],
['luz-injecao','Luz de injeção acesa',['luz de injecao','luz acesa','injecao acesa','check','luz do motor','luz da injecao'],['codes','ft','misf'],[]]
];
const SYM={};SY.forEach(s=>SYM[s[0]]={id:s[0],t:s[1],k:s[2],tests:s[3],ca:s[4]});
function matchSym(text){
  const n=norm(text).trim();if(n.length<3)return [];
  const words=n.split(/\s+/).filter(w=>w.length>3);
  return SY.map(s=>{let sc=0;const tt=norm(s[1]);
    if(tt.includes(n))sc+=5;
    s[2].forEach(k=>{if(n.includes(k))sc+=4+k.length/10;});
    words.forEach(w=>{if(tt.includes(w))sc+=1;s[2].forEach(k=>{if(k.includes(w))sc+=.5;});});
    return [sc,s[0]];}).filter(x=>x[0]>=1).sort((a,b)=>b[0]-a[0]).slice(0,4).map(x=>SYM[x[1]]);
}
const SISTEMAS=['Admissão e vácuo','Combustível','Ignição','Sensores e chicote','Mecânica do motor','Distribuição','Arrefecimento','Lubrificação','Elétrica e carga','Escapamento e emissões','Outro'];


const VALS=[
['Bateria e carga',[['Bateria em repouso — 100%','Parado > 1 h','12,6–12,7 V'],['Bateria em repouso — 50%','Parado > 1 h','≈ 12,2 V'],['Bateria descarregada','Parado > 1 h','≤ 11,9 V'],['Tensão na partida','Medida na bateria','≥ 9,6 V'],['Tensão de carga','Motor ligado, sem carga','13,8–14,7 V'],['Alternador inteligente','Controlado pela ECU','12,5–15,0 V'],['Corrente de fuga','Módulos dormindo','< 50 mA'],['Queda de tensão — positivo da partida','Na partida','≤ 0,5 V'],['Queda de tensão — massa','Na partida','≤ 0,3 V'],['Referência de sensores','Chave ligada','4,9–5,1 V'],['Massa de sensor x negativo da bateria','Motor ligado','≤ 0,1 V']]],
['Sensores',[['MAP','Desligado, nível do mar','≈ 100 kPa / ≈ 4,5 V'],['MAP','Marcha lenta, quente','25–40 kPa / 1,0–1,5 V'],['TPS','Borboleta fechada','0,3–0,9 V'],['TPS','Aberta total','4,0–4,8 V'],['MAF','Marcha lenta, quente','≈ 1,5–2,5 g/s por litro'],['Sonda lambda pré-cat','2.500 rpm, quente','oscila 0,1–0,9 V'],['Sonda pós-cat','Catalisador bom','estável 0,45–0,7 V'],['Sensor de temperatura (NTC)','20 °C','≈ 2–3 kΩ'],['Sensor de temperatura (NTC)','90 °C','≈ 200–300 Ω'],['CKP indutivo','Resistência','≈ 200–1.500 Ω'],['CKP / CMP Hall','Sinal','quadrado 0–5 V ou 0–12 V'],['Rede CAN','Pinos 6–14, bateria desligada','≈ 60 Ω']]],
['Ignição e injeção',[['Injetor alta impedância','Resistência','12–16 Ω'],['Injetor baixa impedância','Resistência','2–5 Ω'],['Bobina — primário','Resistência','0,4–2 Ω'],['Bobina — secundário','Resistência','5–15 kΩ'],['Tempo de queima da faísca','Marcha lenta','≈ 1–2 ms'],['Aquecedor da sonda lambda','Resistência','2–15 Ω'],['Solenoide VVT','Resistência','6–12 Ω'],['Válvula de purga do canister','Resistência','20–40 Ω'],['Corrente da bomba de combustível','Motor ligado','≈ 4–8 A']]],
['Combustível',[['Pressão — com regulador no retorno','Marcha lenta','2,5–3,0 bar'],['Pressão — sem retorno','Marcha lenta','3,5–4,0 bar'],['Pressão — injeção direta (alta)','Marcha lenta / carga','50–200 bar (até 350)'],['Regulador com vácuo','Tirar a mangueira','sobe ≈ 0,5 bar'],['Retenção de pressão','5–10 min desligado','queda lenta'],['Correção total (STFT + LTFT)','Motor quente','±10%']]],
['Mecânica do motor',[['Compressão','Quente, borboleta aberta','8,5–14 bar (120–200 psi)'],['Diferença de compressão entre cilindros','Máximo','≤ 10%'],['Vazamento de cilindro','PMS de compressão','≤ 10–15%'],['Vácuo do coletor','Marcha lenta, quente','17–21 inHg'],['Pressão de óleo','Marcha lenta, quente','≥ 1 bar'],['Pressão de óleo','3.000 rpm, quente','3–5 bar'],['Abertura do termostato','Início','≈ 82–92 °C'],['Temperatura de trabalho','Motor aquecido','85–105 °C'],['Pressão da tampa do radiador','Abertura','≈ 1,0–1,4 bar']]],
['Ar-condicionado (R134a / R1234yf)',[['Pressão de baixa','≈ 27 °C ambiente, 1.500 rpm','25–45 psi'],['Pressão de alta','≈ 27 °C ambiente, 1.500 rpm','150–250 psi'],['Saída central','Recirculação, máximo','4–8 °C']]]
];


/* ================= ESTADO E DADOS DO GESTOR =================
   Tudo fica no registro da equipe (wab_data), junto com clientes e O.S.:
   - o.dg            diagnóstico de cada O.S. (códigos, sintomas, testes, defeito)
   - db.dcasos       casos resolvidos (o "caminho rápido" dos próximos carros)
   - db.dcodes       descrições de códigos cadastradas pela oficina
   - db.dgcfg.eq     equipamentos que a oficina tem */
const dkey=s=>norm(s).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const esc=x=>e(x);
const UI={step:{},code:'',sym:'',tf:'todos',cq:'',casoQ:'',vq:''};
function dgOf(o){const d=o.dg=o.dg&&typeof o.dg=='object'?o.dg:{};['cod','sin','ext'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});if(!d.t||typeof d.t!='object'||Array.isArray(d.t))d.t={};return d}
const casos=()=>Array.isArray(db.dcasos)?db.dcasos:(db.dcasos=[]);
const codes=()=>Array.isArray(db.dcodes)?db.dcodes:(db.dcodes=[]);
const eqSet=()=>new Set(db.dgcfg&&Array.isArray(db.dgcfg.eq)?db.dgcfg.eq:EQ_DEFAULT);
const vOf=o=>{const v=vh(o.veh)||{};return{modelo:v.modelo||'',motor:v.motor||'',ano:v.ano||'',placa:v.placa||'',km:v.km||''}};
const res=(d,t)=>d.t[t]&&d.t[t].r||'';
const started=o=>{const d=o.dg;return !!(d&&((d.cod||[]).length||(d.sin||[]).length||Object.values(d.t||{}).some(x=>x&&x.r)))};
const hasEq=(t,av)=>t.eq.some(alt=>alt.split('+').every(x=>av.has(x)));
const eqLabel=(t,av)=>t.eq.map(alt=>`<span class="dg-eq${alt.split('+').every(x=>av.has(x))?'':' miss'}">${alt.split('+').map(x=>EQ[x]).join(' + ')}</span>`).join('');

/* descrições da oficina: do mesmo modelo > gerais > base */
function customFor(c,v){const mk=v&&v.modelo?dkey(v.modelo):'';let gen=null,mod=null,any=null;
 codes().forEach(x=>{if(x.code!==c)return;any=any||x;if(x.modelo){if(mk&&dkey(x.modelo)===mk)mod=x}else gen=x});return mod||gen||(v===undefined?any:null)}
function lookupV(c,v){const x=customFor(c,v),b=lookupBase(c);
 if(x)return{c,t:x.t||(b?b.t:''),s:x.s||(b?b.s:2),m:x.m||'',ca:(x.ca&&x.ca.length)?x.ca:(b?b.ca:[]),tests:(x.tests&&x.tests.length)?x.tests:(b?b.tests:['codes']),custom:x};return b}

/* casos parecidos, causas e testes */
function matchCases(o){const d=dgOf(o),v=vOf(o);if(!d.cod.length&&!d.sin.length)return[];const G=new Map();
 casos().forEach(c=>{if(c.os&&c.os===o.id)return;const sc=(c.cod||[]).filter(x=>d.cod.includes(x)),ss=(c.sin||[]).filter(x=>d.sin.includes(x));if(!sc.length&&!ss.length)return;
  let sco=sc.length*3+ss.length*2;const cv=c.veh||{};if(cv.modelo&&v.modelo&&dkey(cv.modelo)===dkey(v.modelo))sco+=1;if(cv.motor&&v.motor&&dkey(cv.motor)===dkey(v.motor))sco+=1;
  const k=dkey(c.def);if(!k)return;const g=G.get(k)||{def:c.def,sis:c.sis,casos:[],score:0,codes:new Set(),syms:new Set(),testes:new Map(),sols:new Set()};
  g.casos.push(c);g.score+=sco;sc.forEach(x=>g.codes.add(x));ss.forEach(x=>g.syms.add(x));if(c.tc)g.testes.set(c.tc,(g.testes.get(c.tc)||0)+1);if(c.sol)g.sols.add(c.sol);G.set(k,g)});
 return[...G.values()].sort((a,b)=>b.score-a.score||b.casos.length-a.casos.length)}
function causesFor(o,M){const d=dgOf(o),v=vOf(o),m=new Map();const add=(t,w,src)=>{const k=dkey(t);if(!k)return;const x=m.get(k)||{t,w:0,src:[],hist:0};x.w+=w;if(src&&!x.src.includes(src))x.src.push(src);m.set(k,x)};
 d.cod.forEach(c=>{const r=lookupV(c,v);if(r)r.ca.forEach((x,i)=>add(x,3-i*.3,c))});d.sin.forEach(s=>{const y=SYM[s];if(y)y.ca.forEach((x,i)=>add(x,2-i*.2,y.t))});
 M.forEach(g=>{const k=dkey(g.def);const x=m.get(k)||{t:g.def,w:0,src:[],hist:0};x.w+=4+g.casos.length*3;x.hist=g.casos.length;m.set(k,x)});return[...m.values()].sort((a,b)=>b.w-a.w)}
function suggestions(o,M){const d=dgOf(o),v=vOf(o),m=new Map();const add=(t,f)=>{if(!TESTS[t])return;if(!m.has(t))m.set(t,{from:[],hist:0,ord:m.size});const x=m.get(t);if(f&&!x.from.includes(f))x.from.push(f)};
 (M||[]).forEach(g=>g.testes.forEach((n,t)=>{add(t,null);if(m.get(t))m.get(t).hist+=n}));
 d.cod.forEach(c=>{const r=lookupV(c,v);(r?r.tests:['codes']).forEach(t=>add(t,c))});d.sin.forEach(s=>{const y=SYM[s];if(y)y.tests.forEach(t=>add(t,y.t))});
 d.ext.forEach(t=>add(t,'Adicionado por você'));Object.entries(d.t).forEach(([t,r])=>{if(r&&(r.r||r.v||r.o))add(t,null)});return m}

/* ================= MENSAGENS ================= */
function msg({title,intro,items,okLabel,focus,alt,altLabel,warn}){
 DG._alt=alt||null;DG._focus=focus||'';
 $('#modal').innerHTML=`<div class="ov"><div class="md dg-msg${warn?' warn':''}" role="dialog" aria-modal="true"><h2 style="margin-top:0">${esc(title)}</h2>${intro?`<p>${esc(intro)}</p>`:''}${items&&items.length?`<ul>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:''}<div class="bar" style="margin:12px 0 0"><span class="sp"></span>${alt?`<button type="button" onclick="DG.msgAlt()">${esc(altLabel||'Continuar mesmo assim')}</button>`:''}<button type="button" class="pr" onclick="DG.msgOk()">${esc(okLabel||'Entendi')}</button></div></div></div>`;
 setTimeout(()=>{const b=$('#modal .pr');if(b)b.focus()},20)}

/* ================= ABA "DIAGNÓSTICO" DA O.S. ================= */
const STEPS=[['sin','Sintomas e códigos'],['diag','Testes e causas'],['def','Defeito encontrado']];
const curStep=o=>{const d=dgOf(o);return UI.step[o.id]||(d.fim?'def':(d.cod.length||d.sin.length)?'diag':'sin')};
function DGtab(o){const d=dgOf(o),st=UI.step[o.id]=curStep(o),done={sin:!!(d.cod.length||d.sin.length),diag:Object.values(d.t).some(x=>x&&x.r),def:!!d.fim};
 const nav=`<div class="dg-steps" role="tablist" aria-label="Etapas do diagnóstico">${STEPS.map(([k,l],i)=>`<button type="button" role="tab" aria-selected="${st==k}" class="dg-stp${st==k?' on':done[k]?' ok':''}" onclick="DG.step('${k}')"><b>${done[k]&&st!=k?'✓':i+1}</b><span>${l}</span></button>`).join('')}</div>`;
 return nav+(st=='diag'?stepDiag(o):st=='def'?stepDef(o):stepSin(o))}
function codePrev(o){const p=parseCode(UI.code);
 if(p.empty)return`<span class="muted">Formato: letra + 4 números. Pode digitar só os números (0171) ou com letra O (PO171).</span>`;
 if(!p.ok)return p.raw.length<5?`<span class="muted">Continue digitando… (${esc(p.raw)})</span>`:`<span class="dg-err">“${esc(p.raw)}” não é um código válido. Exemplo: P0171</span>`;
 const r=lookupV(p.code,o?vOf(o):undefined);return`<b>${p.code}</b> <span>${r?esc(r.t):'Ainda sem descrição. Ao adicionar, você poderá cadastrar a descrição.'}</span> <span class="muted">· toque em Adicionar</span>`}
function symSug(o){const q=UI.sym;if(!q||norm(q).trim().length<3)return'';const d=dgOf(o);const m=matchSym(q).filter(s=>!d.sin.includes(s.id));
 if(!m.length)return`<p class="muted" style="margin:6px 0">Nenhum sintoma parecido. Tente outras palavras ou escolha na lista abaixo.</p>`;
 return m.map(s=>`<button type="button" class="dg-sug" onclick="DG.addSym('${s.id}')"><b>+ ${esc(s.t)}</b><small>Toque para adicionar · ${s.tests.length} testes</small></button>`).join('')}
function stepSin(o){const d=dgOf(o),v=vOf(o),L=lOf(o);
 const fromQ=o.problema?matchSym(o.problema).filter(s=>!d.sin.includes(s.id)).slice(0,3):[];
 const lc=lCods(L.cod).map(x=>parseCode(x)).filter(p=>p.ok&&!d.cod.includes(p.code)).map(p=>p.code);
 return`${o.problema?`<div class="fbar">${svgi('osres')}<span><b>Relato:</b> ${esc(o.problema)}</span></div>`:''}
 <div class="card"><div class="dg-h"><b>Códigos de falha</b><small class="muted">lidos no scanner</small></div>
  ${lc.length?`<div class="dg-sugrow">Códigos no laudo: ${lc.map(c=>`<button type="button" class="sm" onclick="DG.addCode('${c}')">+ ${c}</button>`).join('')}</div>`:''}
  <div class="dg-row"><input id="dgcode" class="dg-code" placeholder="P0171" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Código de falha" value="${esc(UI.code)}" oninput="DG.cin(this.value)" onkeydown="if(event.key=='Enter'){event.preventDefault();DG.addCode()}"><button type="button" class="pr" onclick="DG.addCode()">Adicionar</button></div>
  <div class="dg-prev" id="dgprev">${codePrev(o)}</div>
  ${d.cod.map(c=>codeCard(o,c)).join('')}
 </div>
 <div class="card"><div class="dg-h"><b>Sintomas</b><small class="muted">o que o carro apresenta</small></div>
  ${fromQ.length?`<small class="muted">Encontrados no relato</small><div class="dg-sugs">${fromQ.map(s=>`<button type="button" class="dg-sug" onclick="DG.addSym('${s.id}')"><b>+ ${esc(s.t)}</b><small>Toque para adicionar</small></button>`).join('')}</div>`:''}
  <input id="dgsym" placeholder="Descreva: barulho no motor, esquentando…" autocomplete="off" aria-label="Descrever sintoma" value="${esc(UI.sym)}" oninput="DG.sin(this.value)" onkeydown="if(event.key=='Enter'){event.preventDefault();const b=document.querySelector('#dgsug .dg-sug');if(b)b.click()}">
  <div id="dgsug" class="dg-sugs">${symSug(o)}</div>
  ${SG.map(g=>`<small class="muted dg-gl">${g[0]}</small><div class="dg-chips">${g[1].map(id=>`<button type="button" class="dg-chip" aria-pressed="${d.sin.includes(id)}" onclick="DG.tsym('${id}')">${esc(SYM[id].t)}</button>`).join('')}</div>`).join('')}
 </div>
 <div class="dg-next"><span class="muted" id="dgab">${abMsg(o)}</span><button type="button" class="pr" onclick="DG.step('diag')">Ver diagnóstico →</button></div>`}
function codeCard(o,c){const v=vOf(o),r=lookupV(c,v);const tag=r&&r.custom?`<span class="mb" style="--c:${KB}">${r.custom.modelo?'Oficina · '+esc(r.custom.modelo):'Descrição da oficina'}</span>`:'';
 return`<div class="dg-cc"><span class="dg-ro">${esc(c)}</span><span class="dg-cct"><b>${esc(r&&r.t?r.t:'Sem descrição cadastrada')}</b>${r?mb('Gravidade '+(SEV[r.s]||'Média'),r.s==3?KR:r.s==2?KA:KG):''} ${tag}</span>
  <span class="dg-cca">${r?`<button type="button" class="sm" onclick="DG.editCode('${c}')">Editar</button>`:`<button type="button" class="sm pr" onclick="DG.editCode('${c}')">+ Descrição</button>`}<button type="button" class="sm" aria-label="Remover ${esc(c)}" onclick="DG.rmCode('${c}')">×</button></span></div>`}
function abMsg(o){const d=dgOf(o),p=parseCode(UI.code),pc=p.ok&&!d.cod.includes(p.code),ps=UI.sym&&matchSym(UI.sym).some(x=>!d.sin.includes(x.id));
 const a=[];if(d.cod.length)a.push(plural(d.cod.length,'código','códigos'));if(d.sin.length)a.push(plural(d.sin.length,'sintoma','sintomas'));
 if(pc||ps)a.push((pc&&ps?'código e sintoma digitados':pc?'código digitado':'sintoma digitado')+' entram ao avançar');return a.length?a.join(' · '):'Digite um código ou escolha um sintoma'}
function stepDiag(o){const d=dgOf(o),av=eqSet(),M=matchCases(o),sug=suggestions(o,M),C=causesFor(o,M);
 if(!d.cod.length&&!d.sin.length)return empty('oslaudo','Informe os códigos de falha ou os sintomas para montar o diagnóstico.',`<button class="pr" onclick="DG.step('sin')">Informar sintomas e códigos</button>`);
 const ids=[...sug.keys()].sort((a,b)=>{const A=sug.get(a),B=sug.get(b);return(B.hist-A.hist)||(A.ord-B.ord)});
 const can=ids.filter(t=>hasEq(TESTS[t],av)||res(d,t)),cannot=ids.filter(t=>!can.includes(t)),reg=can.filter(t=>res(d,t)).length,fal=ids.filter(t=>res(d,t)=='falha');
 const shown=can.filter(t=>UI.tf=='pend'?!res(d,t):UI.tf=='falha'?res(d,t)=='falha':true),mx=C.length?C[0].w:1;
 return`<div class="dg-sum">${d.cod.map(c=>`<span class="dg-ro sm">${esc(c)}</span>`).join('')}${d.sin.map(s=>SYM[s]?`<span class="dg-tg">${esc(SYM[s].t)}</span>`:'').join('')}<button type="button" class="sm" onclick="DG.step('sin')">alterar</button></div>
 ${M.length?`<div class="card dg-fast"><div class="dg-h"><b>Caminho rápido · casos já resolvidos na oficina</b></div><p class="muted" style="margin:0 0 8px">Carros que chegaram com os mesmos códigos ou sintomas e o defeito que foi encontrado.</p>
  ${M.slice(0,4).map(g=>{const last=g.casos[g.casos.length-1],ts=[...g.testes.entries()].sort((a,b)=>b[1]-a[1]).map(([t])=>TESTS[t]?TESTS[t].n:t);
   return`<div class="dg-case"><div class="dg-ct"><b>${esc(g.def)}</b><span class="dg-n">${plural(g.casos.length,'caso','casos')}</span></div>
   <small>Em comum: ${[...g.codes].map(esc).join(', ')}${g.codes.size&&g.syms.size?' · ':''}${[...g.syms].map(s=>SYM[s]?esc(SYM[s].t):'').join(', ')}</small>
   ${ts.length?`<small><b>Confirmado com:</b> ${ts.map(esc).join(', ')}</small>`:''}${g.sols.size?`<small><b>Solução:</b> ${[...g.sols].slice(0,2).map(esc).join(' / ')}</small>`:''}
   <small>Último: ${esc([last.veh&&last.veh.modelo,last.veh&&last.veh.motor].filter(Boolean).join(' '))} · ${D(last.data)}</small>
   <div><button type="button" class="sm pr" onclick="DG.pick(${esc(JSON.stringify(g.def))},${esc(JSON.stringify(g.sis||''))})">É este o defeito</button></div></div>`}).join('')}</div>`:''}
 <div class="card"><div class="dg-h"><b>Causas prováveis</b><small class="muted">da mais para a menos provável</small></div>
  <ol class="dg-causes">${C.slice(0,8).map(c=>`<li class="${c.hist?'hist':''}"><span><b>${esc(c.t)}</b><small>${c.hist?`Encontrado em ${plural(c.hist,'caso','casos')} da oficina${c.src.length?' · ':''}`:''}${c.src.map(esc).join(' · ')}</small><i style="--w:${Math.round(c.w/mx*100)}%"></i></span><button type="button" class="sm" onclick="DG.pick(${esc(JSON.stringify(c.t))},'')">Este é o defeito</button></li>`).join('')}</ol></div>
 <div class="card"><div class="dg-h"><b>Testes</b><small class="muted">${reg} de ${can.length} feitos${fal.length?` · <span style="color:${KR}">${fal.length} fora do esperado</span>`:''}</small></div>
  <div class="dg-bar"><i style="width:${can.length?reg/can.length*100:0}%"></i></div>
  ${seg([['todos','Todos'],['pend','Pendentes'],['falha','Fora do esperado']],UI.tf,'_dgtf').replace(/setF\('_dgtf',/g,'DG.tfil(')}
  ${shown.map(t=>tcard(o,t,sug.get(t),av)).join('')||'<p class="muted">Nenhum teste neste filtro.</p>'}
  ${cannot.length?`<details class="dg-miss"><summary>${plural(cannot.length,'teste pede','testes pedem')} equipamento que a oficina não marcou</summary>${cannot.map(t=>tcard(o,t,sug.get(t),av)).join('')}</details>`:''}
  <label>Fazer outro teste<select onchange="DG.addTest(this.value)"><option value="">Escolha um teste…</option>${Object.values(TESTS).filter(t=>!sug.has(t.id)).sort((a,b)=>a.n.localeCompare(b.n)).map(t=>`<option value="${t.id}">${esc(t.n)}</option>`).join('')}</select></label>
 </div>
 <div class="dg-next"><span class="muted">${plural(Object.values(d.t).filter(x=>x&&x.r).length,'teste registrado','testes registrados')}</span><button type="button" class="pr" onclick="DG.step('def')">Achei o defeito →</button></div>`}
function tcard(o,tid,info,av){const t=TESTS[tid],d=dgOf(o),r=d.t[tid]||{},man=d.ext.includes(tid),from=info?info.from:[];
 return`<div class="dg-tc${r.r?' r-'+r.r:''}"><div class="dg-th"><b>${esc(t.n)}</b><span class="dg-eqs">${info&&info.hist?`<span class="dg-hb">Confirmou defeito em ${plural(info.hist,'caso','casos')}</span>`:''}${eqLabel(t,av)}</span></div>
  ${from.length?`<small class="muted">Indicado por: ${from.map(esc).join(' · ')}</small>`:''}
  <details><summary>Como fazer e valor esperado</summary><p>${esc(t.como)}</p><p><b>Esperado:</b> ${esc(t.esp)}</p></details>
  <div class="dg-seg" role="group" aria-label="Resultado">${[['ok','OK'],['falha','Fora'],['inc','Inconclusivo']].map(([k,l])=>`<button type="button" data-r="${k}" aria-pressed="${r.r==k}" onclick="DG.res('${tid}','${k}')">${l}</button>`).join('')}</div>
  <div class="dg-tin"><input placeholder="Valor medido" value="${esc(r.v)}" onchange="DG.tval('${tid}','v',this.value)" aria-label="Valor medido"><input placeholder="Observação" value="${esc(r.o)}" onchange="DG.tval('${tid}','o',this.value)" aria-label="Observação"></div>
  ${man?`<button type="button" class="sm" onclick="DG.rmTest('${tid}')">Remover teste</button>`:''}</div>`}
function stepDef(o){const d=dgOf(o),C=causesFor(o,matchCases(o)).slice(0,6),done=Object.entries(d.t).filter(([,r])=>r&&r.r).sort((a,b)=>(a[1].r=='falha'?0:1)-(b[1].r=='falha'?0:1));
 const prev=[...new Set(casos().map(c=>c.def).filter(Boolean))];
 return`${d.fim?`<div class="card dg-ok"><b>✓ Salvo no histórico de casos${d.laudo?' e no laudo':''}</b><p class="muted" style="margin:4px 0 0">Quando outro carro chegar com ${esc(d.cod.join(', ')||'os mesmos sintomas')}, este defeito aparece no Caminho rápido.</p></div>`:''}
 <div class="card"><div class="dg-h"><b>Qual foi o defeito?</b></div>
  ${C.length?`<small class="muted">Toque para preencher</small><div class="dg-chips" style="margin-bottom:10px">${C.map(c=>`<button type="button" class="dg-chip" aria-pressed="${dkey(d.def)==dkey(c.t)}" onclick="DG.pick(${esc(JSON.stringify(c.t))},'',1)">${esc(c.t)}</button>`).join('')}</div>`:''}
  <label>Defeito encontrado<input id="dgdef" list="dgdl" value="${esc(d.def)}" placeholder="Ex.: Mangueira do respiro (PCV) rachada" onchange="DG.set('def',this.value)"></label><datalist id="dgdl">${prev.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
  <div class="g2"><label>Sistema<select id="dgsis" onchange="DG.set('sis',this.value)"><option value="">Escolha…</option>${SISTEMAS.map(s=>`<option ${d.sis==s?'selected':''}>${s}</option>`).join('')}</select></label>
  <label>Teste que confirmou<select id="dgtc" onchange="DG.set('tc',this.value)"><option value="">Escolha…</option>${done.map(([t,r])=>TESTS[t]?`<option value="${t}" ${d.tc==t?'selected':''}>${esc(TESTS[t].n)} — ${r.r=='falha'?'Fora':r.r=='ok'?'OK':'Inconclusivo'}</option>`:'').join('')}${Object.values(TESTS).filter(t=>!done.some(([x])=>x==t.id)).map(t=>`<option value="${t.id}" ${d.tc==t.id?'selected':''}>${esc(t.n)}</option>`).join('')}</select></label></div>
  <label>Solução / peças trocadas<textarea id="dgsol" onchange="DG.set('sol',this.value)" placeholder="Ex.: Troca da mangueira do respiro e reaprendizado da marcha lenta">${esc(d.sol)}</textarea></label>
  <label>Observações para o próximo mecânico<textarea onchange="DG.set('obs',this.value)" placeholder="Ex.: A mangueira rachada fica embaixo do coletor, só aparece com teste de fumaça">${esc(d.obs)}</textarea></label>
 </div>
 <div class="dg-next"><span class="muted">Salva no histórico da oficina e preenche o laudo da O.S.</span><button type="button" class="pr" onclick="DG.saveCase()">${d.fim?'Atualizar caso e laudo':'Salvar caso e preencher laudo'}</button></div>`}

/* status no botão da aba */
function dgInfo(o){const d=o.dg;if(!d||!started(o))return['Não iniciado','var(--mut)'];if(d.fim)return['Defeito achado',KG];
 const n=Object.values(d.t||{}).filter(x=>x&&x.r).length,f=Object.values(d.t||{}).filter(x=>x&&x.r=='falha').length;return[n?plural(n,'teste','testes'):'Em andamento',f?KR:KA]}

/* ================= AÇÕES ================= */
const cur=()=>S.v=='order'?od(S.id):null;
const commit=o=>{save();if(typeof osTabsRefresh=='function')osTabsRefresh()};
function commitDrafts(o){const d=dgOf(o);let n=0;const p=parseCode(UI.code);
 if(p.ok){if(!d.cod.includes(p.code)){d.cod.push(p.code);n++}UI.code=''}
 const s=UI.sym?matchSym(UI.sym).filter(x=>!d.sin.includes(x.id))[0]:null;if(s){d.sin.push(s.id);n++;UI.sym=''}if(n)commit(o);return n}
const DG={
 step(k,force){const o=cur();if(!o)return;const st=curStep(o);
  if(st=='sin'&&k!='sin'){const dr=String(UI.code||'').trim(),p=parseCode(dr),d=dgOf(o);
   if(dr&&!p.ok&&!force)return msg({title:'Código de falha inválido',intro:`“${dr}” não é um código válido e não foi adicionado.`,items:['O código tem uma letra e 4 números. Exemplo: P0171','Pode digitar só os números (0171) que a letra P entra sozinha'],okLabel:'Corrigir o código',focus:'dgcode',warn:1,
    alt:(d.cod.length||d.sin.length||(UI.sym&&matchSym(UI.sym).length))?()=>{UI.code='';DG.step(k,1)}:null,altLabel:'Ignorar e continuar'});
   const n=commitDrafts(o);
   if(!d.cod.length&&!d.sin.length){const ts=String(UI.sym||'').trim();return msg({title:'Falta informar o problema',intro:'Para montar o diagnóstico, informe pelo menos um destes:',items:['Código de falha lido no scanner (ex.: P0171)','Ou um sintoma: toque em um dos botões da lista de sintomas'].concat(ts?[`O sintoma digitado “${ts}” não foi reconhecido. Escolha um na lista.`]:[]),okLabel:'Preencher',focus:'dgcode',warn:1})}
   if(n)toast(n==1?'O que estava digitado foi adicionado':n+' itens digitados foram adicionados')}
  UI.step[o.id]=k;render();const t=$('.dg-steps');if(t){const nv=$('#nav'),y=t.getBoundingClientRect().top+scrollY-(nv?nv.offsetHeight:0)-8;if(scrollY>y)scrollTo({top:y})}},
 cin(v){UI.code=v;const o=cur(),p=$('#dgprev');if(p)p.innerHTML=codePrev(o);const a=$('#dgab');if(a&&o)a.textContent=abMsg(o)},
 sin(v){UI.sym=v;const o=cur(),b=$('#dgsug');if(b&&o)b.innerHTML=symSug(o);const a=$('#dgab');if(a&&o)a.textContent=abMsg(o)},
 addCode(c){const o=cur();if(!o)return;const d=dgOf(o);const list=c?[c]:String(UI.code||'').split(/[\s,;]+/).filter(Boolean);
  const ok=[],bad=[];list.forEach(x=>{const p=parseCode(x);if(p.ok)ok.push(p.code);else if(!p.empty)bad.push(p.raw)});
  if(!ok.length&&!bad.length){const n=$('#dgcode');if(n)n.focus();return}
  if(bad.length&&!ok.length)return msg({title:'Código de falha inválido',intro:`“${bad.join(' ')}” não é um código válido.`,items:['O código tem uma letra e 4 números. Exemplo: P0171'],okLabel:'Corrigir',focus:'dgcode',warn:1});
  const added=ok.filter(x=>!d.cod.includes(x));added.forEach(x=>d.cod.push(x));if(!c)UI.code=bad.join(' ');if(added.length)commit(o);
  const unk=added.find(x=>!lookupV(x,vOf(o)));render();
  if(unk){DG.editCode(unk);toast(unk+' ainda não tem descrição: cadastre agora');return}
  const n=$('#dgcode');if(n&&!c)n.focus();if(added.length)toast(added.length==1?'Código '+added[0]+' adicionado':added.length+' códigos adicionados');else if(ok.length)toast('Esse código já foi adicionado')},
 rmCode(c){const o=cur();if(!o)return;const d=dgOf(o);d.cod=d.cod.filter(x=>x!=c);commit(o);render()},
 addSym(id){const o=cur();if(!o)return;const d=dgOf(o);if(!d.sin.includes(id))d.sin.push(id);UI.sym='';commit(o);render();toast('Sintoma adicionado: '+SYM[id].t)},
 tsym(id){const o=cur();if(!o)return;const d=dgOf(o);d.sin.includes(id)?d.sin=d.sin.filter(x=>x!=id):d.sin.push(id);commit(o);render()},
 tfil(k){UI.tf=k;render()},
 res(t,k){const o=cur();if(!o)return;const d=dgOf(o),r=d.t[t]=d.t[t]&&typeof d.t[t]=='object'?d.t[t]:{};if(r.r==k){r.r=null;r.at=null}else{r.r=k;r.at=Date.now()}if(k=='falha'&&r.r&&!d.tc)d.tc=t;commit(o);render()},
 tval(t,f,v){const o=cur();if(!o)return;const d=dgOf(o),r=d.t[t]=d.t[t]&&typeof d.t[t]=='object'?d.t[t]:{};r[f]=v;commit(o)},
 addTest(t){const o=cur();if(!o||!t)return;const d=dgOf(o);if(!d.ext.includes(t))d.ext.push(t);UI.tf='todos';commit(o);render();toast('Teste adicionado à lista')},
 rmTest(t){const o=cur();if(!o)return;const d=dgOf(o);d.ext=d.ext.filter(x=>x!=t);d.t[t]=null;commit(o);render()},
 pick(def,sis,stay){const o=cur();if(!o)return;const d=dgOf(o);d.def=def;if(sis)d.sis=sis;commit(o);if(stay)render();else DG.step('def')},
 set(k,v){const o=cur();if(!o)return;dgOf(o)[k]=v;commit(o)},
 saveCase(force){const o=cur();if(!o)return;const d=dgOf(o);
  ['dgdef','dgsis','dgtc','dgsol'].forEach(id=>{const el=document.getElementById(id);if(el){const k={dgdef:'def',dgsis:'sis',dgtc:'tc',dgsol:'sol'}[id];d[k]=el.value}});
  if(!String(d.def||'').trim())return msg({title:'Falta o defeito encontrado',intro:'Escreva qual foi o defeito, ou toque em uma das causas logo acima para preencher.',okLabel:'Preencher',focus:'dgdef',warn:1});
  if(!force){const op=[];if(!d.sis)op.push('Sistema');if(!d.tc)op.push('Teste que confirmou');if(!String(d.sol||'').trim())op.push('Solução / peças trocadas');
   if(op.length)return msg({title:'Faltam alguns campos',intro:'Estes campos ajudam no Caminho rápido dos próximos carros:',items:op,okLabel:'Preencher',focus:!d.sis?'dgsis':!d.tc?'dgtc':'dgsol',alt:()=>DG.saveCase(1),altLabel:'Salvar assim mesmo'})}
  const v=vOf(o),id=d.caso||uid(),C=casos(),i=C.findIndex(x=>x.id==id);
  const c={id,os:o.id,num:o.num,data:today(),cod:[...d.cod],sin:[...d.sin],def:d.def.trim(),sis:d.sis||'',tc:d.tc||'',sol:String(d.sol||'').trim(),obs:String(d.obs||'').trim(),veh:{modelo:v.modelo,motor:v.motor,ano:v.ano},km:v.km||''};
  if(i>=0)C[i]=c;else C.push(c);const novo=!d.caso;d.caso=id;d.fim=true;
  const n=fillLaudo(o);d.laudo=1;commit(o);render();scrollTo(0,0);
  toast((novo?'Caso salvo no histórico':'Caso atualizado')+(n?' · laudo preenchido ('+plural(n,'campo','campos')+')':''))},
 msgOk(){const f=DG._focus;closeM(1);if(f){const el=document.getElementById(f);if(el){el.scrollIntoView({block:'center'});el.focus({preventScroll:true})}}},
 msgAlt(){const a=DG._alt;closeM(1);if(a)a()},
 /* cadastro da descrição de um código */
 editCode(c){const o=cur(),v=o?vOf(o):{},r=lookupV(c,o?v:undefined);
  DG._ed={code:c,existing:r&&r.custom?r.custom.id:null,tests:r?[...r.tests]:[]};
  const q='https://www.google.com/search?q='+encodeURIComponent([c,'código de falha',v.modelo,v.motor].filter(Boolean).join(' '));
  $('#modal').innerHTML=`<div class="ov"><form class="md dg-ed" onsubmit="event.preventDefault();DG.saveCode()"><h2 style="margin-top:0">Descrição do ${esc(c)}</h2>
  <p class="muted" style="margin:0 0 10px">Fica salva para a próxima vez que o código aparecer.</p>
  <a class="btn" href="${q}" target="_blank" rel="noopener" style="text-decoration:none;margin-bottom:12px">Pesquisar ${esc(c)} no Google ↗</a>
  <label>Descrição do código<input id="dgct" value="${esc(r?r.t:'')}" placeholder="Ex.: Sinal de rotação — faixa/desempenho"></label>
  <label>O que significa (opcional)<textarea id="dgcm">${esc(r?r.m:'')}</textarea></label>
  <div class="g2"><label>Gravidade<select id="dgcs">${[1,2,3].map(n=>`<option value="${n}" ${(r?r.s:2)==n?'selected':''}>${SEV[n]}</option>`).join('')}</select></label>
  <label>Vale para<select id="dgce"><option value="todos">Todos os veículos</option>${v.modelo?`<option value="modelo" ${r&&r.custom&&r.custom.modelo?'selected':''}>Só ${esc(v.modelo)}</option>`:''}</select></label></div>
  <label>Causas prováveis (uma por linha, da mais provável)<textarea id="dgcc" style="min-height:96px">${esc(r?r.ca.join('\n'):'')}</textarea></label>
  <small class="muted">Testes sugeridos para este código</small><div class="dg-pick">${Object.values(TESTS).map(t=>`<label><input type="checkbox" value="${t.id}" ${DG._ed.tests.includes(t.id)?'checked':''} onchange="DG.edT(this)">${esc(t.n)}</label>`).join('')}</div>
  <div class="bar" style="margin:12px 0 0">${DG._ed.existing?`<button type="button" class="dg" onclick="confirmDel(this,()=>DG.delCode('${DG._ed.existing}'))">Apagar</button>`:''}<span class="sp"></span><button type="button" onclick="closeM(1)">Cancelar</button><button class="pr">Salvar</button></div></form></div>`;
  setTimeout(()=>{const x=$('#dgct');if(x)x.focus()},30)},
 edT(cb){const t=DG._ed.tests.filter(x=>x!=cb.value);if(cb.checked)t.push(cb.value);DG._ed.tests=t},
 saveCode(){const ed=DG._ed,o=cur(),v=o?vOf(o):{};const t=$('#dgct').value.trim();
  if(!t){const x=$('#dgct');x.style.borderColor=KR;x.focus();return toast('Escreva a descrição do código')}
  const modelo=$('#dgce').value=='modelo'&&v.modelo?v.modelo:'',id=ed.code+(modelo?'--'+dkey(modelo).replace(/ /g,'-').slice(0,60):''),L=codes();
  if(ed.existing&&ed.existing!=id){const j=L.findIndex(x=>x.id==ed.existing);if(j>=0)L.splice(j,1)}
  const rec={id,code:ed.code,modelo,t,m:$('#dgcm').value.trim(),s:+$('#dgcs').value||2,ca:$('#dgcc').value.split('\n').map(x=>x.trim()).filter(Boolean),tests:[...ed.tests],at:today()};
  const j=L.findIndex(x=>x.id==id);if(j>=0)L[j]=rec;else L.push(rec);save();closeM(1);render();toast(modelo?'Descrição salva para '+modelo:'Descrição salva para todos os veículos')},
 delCode(id){const L=codes(),j=L.findIndex(x=>x.id==id);if(j>=0)L.splice(j,1);save();closeM(1);render();toast('Descrição apagada')},
 /* página do menu */
 tab(k){S.f.dt=k;render();scrollTo(0,0)},
 novo(){DG.next='diag';newOS()},
 open(id){go('order',id,'diag')},
 delCaso(id){const C=casos(),j=C.findIndex(x=>x.id==id);if(j>=0)C.splice(j,1);db.orders.forEach(o=>{if(o.dg&&o.dg.caso==id){o.dg.caso=null;o.dg.fim=false}});save();render();toast('Caso excluído')},
 cq(v){UI.cq=v;const b=$('#dgcqo');if(b)b.innerHTML=consulta()},
 casoQ(v){UI.casoQ=v;const b=$('#dgcasos');if(b)b.innerHTML=casosList()},
 vq(v){UI.vq=v;const b=$('#dgvals');if(b)b.innerHTML=valsHTML()},
 eq(k,on){const s=eqSet();on?s.add(k):s.delete(k);db.dgcfg=Object.assign({},db.dgcfg||{},{eq:[...s]});save()},
 calc(){calcAll()}
};

/* preenche o laudo técnico com o diagnóstico (só os campos vazios; códigos e testes são somados) */
function fillLaudo(o){const d=dgOf(o),L=lOf(o);let n=0;
 const cods=[...new Set([...lCods(L.cod),...d.cod])].join(', ');if(cods&&cods!=String(L.cod||'')){L.cod=cods;n++}
 const lines=Object.entries(d.t).filter(([t,r])=>r&&r.r&&TESTS[t]).map(([t,r])=>`${TESTS[t].n}: ${{ok:'dentro do esperado',falha:'fora do esperado',inc:'inconclusivo'}[r.r]}${r.v?' ('+r.v+')':''}${r.o?' — '+r.o:''}`);
 if(lines.length){const cur0=String(L.testes||'').trim(),add=lines.filter(x=>!cur0.includes(x));if(add.length){L.testes=(cur0?cur0+'\n':'')+add.join('\n');n++}}
 const eqs=[...new Set(Object.entries(d.t).filter(([t,r])=>r&&r.r&&TESTS[t]).flatMap(([t])=>{const av=eqSet(),alt=TESTS[t].eq.find(a=>a.split('+').every(x=>av.has(x)))||TESTS[t].eq[0];return alt.split('+').map(x=>EQ[x])}))].filter(x=>x!=EQ.vis);
 if(eqs.length&&!String(L.equip||'').trim()){L.equip=eqs.join(', ');n++}
 if(d.def&&!String(L.diag||'').trim()){L.diag=d.def;n++}
 if(d.sis&&!String(L.causa||'').trim()){L.causa=(d.obs?d.obs:'Sistema: '+d.sis);n++}
 if(d.sol&&!String(L.sol||'').trim()){L.sol=d.sol;n++}
 return n}

/* ================= PÁGINA "DIAGNÓSTICO" NO MENU ================= */
const DCOL='#C0392B';
function Vdiag(){const k=S.f.dt||'and',O=db.orders.filter(started),and=O.filter(o=>!o.dg.fim);
 const T=[['and','Em andamento'],['casos','Casos resolvidos'],['cons','Consulta'],['cod','Códigos'],['val','Valores'],['calc','Calculadoras'],['eq','Equipamentos']];
 let b='';
 if(k=='and'){const conc=O.filter(o=>o.dg.fim).slice(-10).reverse();
  b=sech('Em andamento',and.length?plural(and.length,'carro','carros'):'')+(and.slice().reverse().map(dgCard).join('')||empty('diag','Nenhum diagnóstico em andamento. Abra uma O.S. e toque na aba Diagnóstico, ou use o botão “+ Diagnosticar”.'))+
   (conc.length?sech('Concluídos recentemente','')+conc.map(dgCard).join(''):'')+
   `<div class="card dg-how"><b>Como funciona</b><ol><li>Na O.S., abra a aba <b>Diagnóstico</b>.</li><li>Informe os <b>códigos de falha</b> e os <b>sintomas</b>.</li><li>Veja o <b>caminho rápido</b> dos casos parecidos, as causas prováveis e faça os testes marcando o resultado.</li><li>Achou o defeito? Salve: ele entra nos <b>Casos resolvidos</b> e preenche o <b>Laudo</b> da O.S.</li></ol></div>`}
 if(k=='casos')b=srchIn('Buscar código, sintoma, defeito ou modelo',UI.casoQ,'DG.casoQ(this.value)')+topCodes()+`<div id="dgcasos">${casosList()}</div>`;
 if(k=='cons')b=srchIn('Código (P0301) ou sintoma (falha ao acelerar)',UI.cq,'DG.cq(this.value)')+`<div class="dg-chips" style="margin:8px 0 12px">${['P0171','P0300','P0335','falha ao acelerar','barulho no motor','esquentando','partida a frio'].map(x=>`<button type="button" class="dg-chip" onclick="document.getElementById('dgcqi').value='${x}';DG.cq('${x}')">${x}</button>`).join('')}</div><div id="dgcqo">${consulta()}</div>`;
 if(k=='cod'){const L=codes().slice().sort((a,b)=>String(a.code).localeCompare(b.code));
  b=`<p class="muted">Descrições de códigos cadastradas pela oficina. Para cadastrar, adicione o código na aba Diagnóstico de uma O.S. e toque em “+ Descrição”.</p>`+(L.map(x=>lcard({c:KB,n:`<span class="dg-ro sm">${esc(x.code)}</span>`,pill:mb(x.modelo?'Só '+esc(x.modelo):'Todos os veículos',KB),t:esc(x.t),m:esc((x.ca||[]).slice(0,3).join(' · ')),f:`<span class="sp"></span><button class="sm dg" onclick="confirmDel(this,()=>{const L=db.dcodes,j=L.findIndex(y=>y.id=='${esc(x.id)}');if(j>=0)L.splice(j,1);save();render()})">Apagar</button>`})).join('')||empty('notas','Nenhum código descrito pela oficina ainda.'))}
 if(k=='val')b=srchIn('Filtrar: bateria, MAP, compressão, óleo…',UI.vq,'DG.vq(this.value)')+`<p class="muted" style="margin:8px 0">Valores típicos para motores gasolina, etanol e flex. Confirme sempre no manual da montadora.</p><div id="dgvals">${valsHTML()}</div>`;
 if(k=='calc'){b=calcHTML();setTimeout(calcAll,0)}
 if(k=='eq'){const s=eqSet();b=`<div class="card"><b>Equipamentos da oficina</b><p class="muted" style="margin:4px 0 10px">Os testes que usam equipamento não marcado vão para o fim da lista no diagnóstico.</p><div class="dg-eqlist">${Object.keys(EQ).map(x=>`<label><input type="checkbox" ${s.has(x)?'checked':''} onchange="DG.eq('${x}',this.checked)">${EQ[x]}</label>`).join('')}</div></div>`}
 return head({ico:'diag',kick:'Motores gasolina, etanol e flex',title:'Diagnóstico',c:DCOL,right:`<button class="pr hb" onclick="DG.novo()">+ Diagnosticar</button>`})+
  `<div class="seg" role="group">${T.map(([x,t])=>`<button type="button" class="${k==x?'on':''}" aria-pressed="${k==x}" onclick="DG.tab('${x}')">${t}</button>`).join('')}</div>`+b}
const srchIn=(ph,v,fn)=>`<div class="srch">${svgi('search')}<input ${fn.includes('cq')?'id="dgcqi"':''} type="search" placeholder="${ph}" value="${esc(v)}" oninput="${fn}"></div>`;
function dgCard(o){const d=o.dg,v=vh(o.veh),c=cl(o.cli),[s,col]=dgInfo(o);
 return lcard({c:d.fim?KG:KA,n:'O.S. '+esc(o.num),pill:mb(s,col),t:esc(vlabel(v)),m:`${esc(c.nome||'Sem cliente')}${d.def?' · Defeito: '+esc(d.def):''}`,f:(d.cod||[]).map(x=>`<span class="dg-ro sm">${esc(x)}</span>`).join('')+(d.sin||[]).map(x=>SYM[x]?mb(esc(SYM[x].t)):'').join(''),on:`DG.open('${o.id}')`})}
function topCodes(){const m=new Map();casos().forEach(c=>(c.cod||[]).forEach(x=>m.set(x,(m.get(x)||0)+1)));const t=[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
 return t.length?`<div class="dg-chips" style="margin:8px 0 10px">${t.map(([c,n])=>`<button type="button" class="dg-chip" onclick="document.querySelector('.srch input').value='${c}';DG.casoQ('${c}')">${c} · ${n}</button>`).join('')}</div>`:''}
function casoHTML(c){const v=c.veh||{},o=c.os?od(c.os):null;
 return lcard({c:KG,n:c.num?'O.S. '+esc(c.num):'',pill:c.sis?mb(esc(c.sis),KB):'',v:'',t:esc(c.def),m:esc([v.modelo,v.ano,v.motor].filter(Boolean).join(' · '))+(c.km?' · '+esc(c.km)+' km':'')+' · '+D(c.data)+
  (c.tc&&TESTS[c.tc]?`<br><b>Confirmado com:</b> ${esc(TESTS[c.tc].n)}`:'')+(c.sol?`<br><b>Solução:</b> ${esc(c.sol)}`:'')+(c.obs?`<br><b>Obs.:</b> ${esc(c.obs)}`:''),
  f:(c.cod||[]).map(x=>`<span class="dg-ro sm">${esc(x)}</span>`).join('')+(c.sin||[]).map(x=>SYM[x]?mb(esc(SYM[x].t)):'').join('')+`<span class="sp"></span>${o?`<button class="sm" onclick="DG.open('${o.id}')">Abrir O.S.</button>`:''}<button class="sm dg" onclick="confirmDel(this,()=>DG.delCaso('${esc(c.id)}'))">Excluir</button>`})}
function casosList(){const all=casos().slice().reverse(),q=norm(UI.casoQ).trim();
 const L=q?all.filter(c=>norm([c.def,c.sis,c.sol,c.obs,(c.cod||[]).join(' '),(c.sin||[]).map(s=>SYM[s]?SYM[s].t:'').join(' '),c.veh&&c.veh.modelo,c.veh&&c.veh.motor].join(' ')).includes(q)):all;
 if(!all.length)return empty('diag','Nenhum caso resolvido ainda. Termine um diagnóstico na aba Diagnóstico da O.S. e toque em “Salvar caso”. Os próximos carros com o mesmo problema vão mostrar o caminho rápido.');
 return L.map(casoHTML).join('')||'<p class="muted">Nenhum caso encontrado.</p>'}
function testList(ids){const av=eqSet();return ids.map(t=>{const x=TESTS[t];return`<div class="dg-tc"><div class="dg-th"><b>${esc(x.n)}</b><span class="dg-eqs">${eqLabel(x,av)}</span></div><p>${esc(x.como)}</p><p><b>Esperado:</b> ${esc(x.esp)}</p></div>`}).join('')}
function casesBox(f){const cs=casos().filter(f);return cs.length?`<div class="card dg-fast"><b>Na sua oficina · ${plural(cs.length,'caso resolvido','casos resolvidos')}</b>${cs.slice(-4).reverse().map(casoHTML).join('')}</div>`:''}
function consulta(){const raw=String(UI.cq||'').trim();if(!raw)return'';const p=parseCode(raw);
 if(p.ok&&raw.replace(/\s/g,'').length<=6){const v=p.code,r=lookupV(v,undefined);
  if(!r)return casesBox(c=>(c.cod||[]).includes(v))+`<div class="card"><div class="dg-cc"><span class="dg-ro">${v}</span><span class="dg-cct"><b>Código ainda sem descrição</b><small class="muted">${SYS[v[0]]} · ${ctype(v)}</small></span></div><p class="muted">Para cadastrar a descrição, adicione o código na aba Diagnóstico de uma O.S. e toque em “+ Descrição”.</p><a class="btn" style="text-decoration:none" href="https://www.google.com/search?q=${encodeURIComponent(v+' código de falha')}" target="_blank" rel="noopener">Pesquisar no Google ↗</a></div>`;
  return casesBox(c=>(c.cod||[]).includes(v))+`<div class="card"><div class="dg-cc"><span class="dg-ro">${r.c}</span><span class="dg-cct"><b>${esc(r.t)}</b>${mb('Gravidade '+SEV[r.s],r.s==3?KR:r.s==2?KA:KG)} ${r.custom?mb('Descrição da oficina',KB):''}</span></div>${r.m?`<p>${esc(r.m)}</p>`:''}<b>Causas prováveis</b><ol>${r.ca.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><b>Testes, nesta ordem</b>${testList(r.tests)}</div>`}
 const ss=matchSym(raw);let h=ss.length?casesBox(c=>(c.sin||[]).includes(ss[0].id)):'';
 h+=ss.map((s,i)=>`<div class="card"><b style="font-size:18px">${esc(s.t)}</b>${s.ca.length?`<p style="margin:6px 0 2px"><b>Causas prováveis</b></p><ol>${s.ca.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:''}${i==0?`<b>Testes, nesta ordem</b>${testList(s.tests)}`:`<details><summary>Ver ${s.tests.length} testes</summary>${testList(s.tests)}</details>`}</div>`).join('');
 return h||`<p class="muted">Nada encontrado para “${esc(raw)}”. Tente o código completo (P0301) ou outras palavras.</p>`}
function valsHTML(){const n=norm(UI.vq).trim();const h=VALS.map(g=>{const rows=g[1].filter(r=>!n||norm(r.join(' ')+' '+g[0]).includes(n));if(!rows.length)return'';
 return`<div class="card"><b>${g[0]}</b><div style="overflow-x:auto"><table><tr><th>Item</th><th>Condição</th><th class="n">Valor típico</th></tr>${rows.map(r=>`<tr><td>${r[0]}</td><td class="muted">${r[1]}</td><td class="n dg-v">${r[2]}</td></tr>`).join('')}</table></div></div>`}).join('');return h||'<p class="muted">Nenhum valor encontrado.</p>'}

/* ================= CALCULADORAS ================= */
const num=v=>{if(v==null)return NaN;v=String(v).trim().replace(',','.');return v===''?NaN:Number(v)};
const fmt=(n,d=1)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const gv=id=>{const x=document.getElementById(id);return x?x.value:''};
function box(cls,big,lines){return`<div class="dg-out ${cls}"><b>${big}</b>${lines.map(l=>`<p>${l}</p>`).join('')}</div>`}
function calcHTML(){const inp=(id,l,v,ph)=>`<label>${l}<input id="${id}" inputmode="decimal" value="${v||''}" placeholder="${ph||''}" oninput="DG.calc()"></label>`;
 return`<p class="muted">Os campos vêm com um exemplo. Troque pelos valores medidos no carro.</p><div class="dg-tools">
 <div class="card"><b>Correção de combustível</b><div class="g2">${inp('dgs1','STFT banco 1 (%)','6')}${inp('dgl1','LTFT banco 1 (%)','14')}${inp('dgs2','STFT banco 2 (%)','','opcional')}${inp('dgl2','LTFT banco 2 (%)','','opcional')}</div>
  <label>Comportamento a 2.500 rpm<select id="dgw" onchange="DG.calc()"><option value="ml">Correção melhora (fica perto de 0)</option><option value="alta">Correção piora (aumenta)</option><option value="igual">Fica parecida</option><option value="nd">Não medi</option></select></label><div id="dgft"></div></div>
 <div class="card"><b>Teste de compressão</b><div class="g2"><label>Cilindros<select id="dgnc" onchange="DG.calc()">${[3,4,5,6,8].map(n=>`<option ${n==4?'selected':''}>${n}</option>`).join('')}</select></label><label>Unidade<select id="dgcu" onchange="DG.calc()"><option value="psi">psi</option><option value="bar">bar</option></select></label></div>
  <div class="g2" id="dgcyl">${[165,160,158,128,'','','',''].map((v,i)=>`<label class="dgcy" ${i>=4?'hidden':''}>Cilindro ${i+1}<input id="dgcy${i}" inputmode="decimal" value="${v}" oninput="DG.calc()"></label>`).join('')}</div><div id="dgcp"></div></div>
 <div class="card"><b>Bateria e carga</b><div class="g2">${inp('dgbr','Repouso (V)','12,32')}${inp('dgbp','Na partida (V)','10,1')}${inp('dgbc','Motor ligado (V)','14,2')}</div><div id="dgbt"></div></div>
 <div class="card"><b>Queda de tensão</b><label>Circuito medido (sob carga)<select id="dgdc" onchange="DG.calc()"><option value="0.5">Positivo do motor de partida (máx. 0,5 V)</option><option value="0.3">Massa motor/carroceria na partida (máx. 0,3 V)</option><option value="0.3">Saída do alternador até a bateria (máx. 0,3 V)</option><option value="0.3">Alimentação de carga: ventoinha, bomba (máx. 0,3 V)</option><option value="0.1">Massa de sensor ou ECU (máx. 0,1 V)</option></select></label>${inp('dgdv','Queda medida (V)','0,72')}<div id="dgdr"></div></div></div>`}
function calcAll(){if(!document.getElementById('dgft'))return;
 {const s1=num(gv('dgs1')),l1=num(gv('dgl1')),s2=num(gv('dgs2')),l2=num(gv('dgl2')),w=gv('dgw');let h;
  if(isNaN(s1)||isNaN(l1))h=box('','—',['Preencha STFT e LTFT do banco 1.']);else{const t1=s1+l1,h2=!isNaN(s2)&&!isNaN(l2),t2=h2?s2+l2:null,wo=h2&&Math.abs(t2)>Math.abs(t1)?t2:t1,a=Math.abs(wo),lean=wo>0,L=[];
   L.push(a<=10?'Dentro do normal (±10%).':a<=25?`Mistura ${lean?'pobre':'rica'}: a ECU está compensando. Investigar.`:`Mistura ${lean?'pobre':'rica'} fora do limite: provável código ${lean?'P0171/P0174':'P0172/P0175'}.`);
   if(a>10){if(lean){if(w=='ml')L.push('Melhora em rotação: forte indício de <b>entrada falsa de ar</b>.');else if(w=='alta')L.push('Piora em rotação: suspeite de <b>falta de combustível</b> (bomba, filtro, regulador) ou MAF lendo pouco.');else if(w=='igual')L.push('Igual em toda faixa: verifique <b>MAF</b>, pressão de combustível e vazamento no escapamento antes da sonda.')}else L.push('Verifique pressão alta, injetor pingando, purga do canister aberta e sensor de temperatura.');
    if(h2){const df=Math.abs(t1-t2);L.push(df<=8?'Bancos parecidos: causa comum aos dois (MAF, combustível, admissão).':`Diferença de ${fmt(df,0)} pontos entre bancos: procure no banco com maior correção.`)}}
   h=box(a<=10?'ok':a<=25?'warn':'bad',`B1 ${t1>0?'+':''}${fmt(t1,0)}%${h2?` · B2 ${t2>0?'+':''}${fmt(t2,0)}%`:''}`,L)}$('#dgft').innerHTML=h}
 {const n=+gv('dgnc'),u=gv('dgcu'),d0=u=='bar'?1:0;document.querySelectorAll('.dgcy').forEach((l,i)=>l.hidden=i>=n);const vals=[];for(let i=0;i<n;i++)vals.push(num(gv('dgcy'+i)));const ok=vals.filter(v=>!isNaN(v)&&v>0);let h;
  if(ok.length<2)h=box('','—',['Preencha pelo menos dois cilindros.']);else{const mx=Math.max(...ok),mn=Math.min(...ok),vp=(mx-mn)/mx*100,st=vals.map(v=>isNaN(v)||v<=0?null:v/mx*100<75?'bad':v/mx*100<90?'warn':'ok'),low=st.map((s,i)=>s&&s!='ok'?i:-1).filter(i=>i>=0),col={ok:KG,warn:KA,bad:KR};
   const bars='<div class="dg-cyl">'+vals.map((v,i)=>st[i]?`<div><span>C${i+1}</span><i style="--w:${v/mx*100}%;--c:${col[st[i]]}"></i><span>${fmt(v,d0)}</span></div>`:'').join('')+'</div>';
   const L=[`Variação entre maior e menor: <b>${fmt(vp,1)}%</b> (aceitável até 10%).`];if(low.length){L.push(`Compressão baixa: ${low.map(i=>'C'+(i+1)).join(', ')}.`);if(low.some((v,k)=>k>0&&v-low[k-1]==1))L.push('Dois cilindros vizinhos baixos: suspeite de <b>junta do cabeçote</b> entre eles.');L.push('Faça o teste molhado: se subir bastante, <b>anéis</b>; se não mudar, <b>válvula</b> ou junta.')}
   h=bars+box(low.some(i=>st[i]=='bad')?'bad':(vp>10||low.length)?'warn':'ok',`${fmt(vp,1)}% de variação`,L)}$('#dgcp').innerHTML=h}
 {const soc=v=>{const t=[[11.89,0],[12.06,25],[12.24,50],[12.45,75],[12.65,100]];if(v<=t[0][0])return 0;if(v>=t[4][0])return 100;for(let i=1;i<t.length;i++)if(v<=t[i][0]){const[a,pa]=t[i-1],[b,pb]=t[i];return pa+(v-a)/(b-a)*(pb-pa)}return 100};
  const r=num(gv('dgbr')),p=num(gv('dgbp')),c=num(gv('dgbc'));let h='';
  if(!isNaN(r)){const s=soc(r);h+=box(s>=75?'ok':s>=50?'warn':'bad',`${fmt(s,0)}% de carga`,[`Repouso ${fmt(r,2)} V. ${s>=75?'Carga adequada.':s>=50?'Carga baixa: recarregue antes de testar.':'Descarregada: recarregue e teste sob carga.'}`])}
  if(!isNaN(p))h+=box(p>=9.6?'ok':'bad',`${fmt(p,1)} V na partida`,[p>=9.6?'Bateria e cabos aguentam a partida.':'Abaixo de 9,6 V: bateria fraca, cabo com resistência ou motor de partida consumindo demais.']);
  if(!isNaN(c))h+=box(c<13.2||c>15?'bad':c<13.8||c>14.7?'warn':'ok',`${fmt(c,1)} V com motor ligado`,[c<13.2?'Não está carregando: alternador, correia ou cabos.':c>15?'Sobrecarga: regulador do alternador com defeito.':c<13.8||c>14.7?'Fora da faixa comum. Normal se o alternador for controlado pela ECU.':'Sistema de carga dentro da faixa.']);$('#dgbt').innerHTML=h}
 {const lim=num(gv('dgdc')),v=num(gv('dgdv'));$('#dgdr').innerHTML=isNaN(v)?box('','—',['Informe a queda medida.']):box(v<=lim?'ok':v<=lim*1.5?'warn':'bad',`${fmt(v,2)} V`,[v<=lim?`Dentro do limite de ${fmt(lim,1)} V.`:`Acima do limite de ${fmt(lim,1)} V. Procure terminal oxidado, cabo fino ou conexão frouxa. Meça por trechos.`])}}

/* ================= ESTILO ================= */
const css=`
.dg-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}
.dg-stp{display:flex;align-items:center;gap:8px;text-align:left;padding:9px 10px;border:1px solid var(--ln);border-top:4px solid var(--ln);border-radius:10px;background:var(--sf);color:var(--mut);margin:0;min-width:0}
.dg-stp b{font:600 15px "Barlow Condensed",sans-serif;flex:none}.dg-stp span{font-size:13px;line-height:1.2}
.dg-stp.ok{border-top-color:#2E8B57;color:var(--ink)}.dg-stp.on{border-top-color:var(--hi);color:var(--ink);background:color-mix(in srgb,var(--hi) 12%,var(--sf))}.dg-stp.on span{font-weight:700}
.dg-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px}.dg-h b{font:600 19px "Barlow Condensed",sans-serif}
.dg-row{display:flex;gap:8px;align-items:stretch}.dg-row input{margin:0;flex:1;min-width:0}.dg-row button{margin:0}
.dg-code{font:700 20px ui-monospace,Menlo,monospace!important;letter-spacing:.08em;text-transform:uppercase}
.dg-prev{margin:8px 0 10px;padding:8px 11px;border:1px dashed var(--ln);border-radius:8px;font-size:14px}.dg-prev b{font-family:ui-monospace,Menlo,monospace}
.dg-err{color:#B4472E;font-weight:600}
.dg-ro{font:700 15px ui-monospace,Menlo,monospace;padding:5px 9px;border-radius:5px;background:#15212B;color:#F5B700;white-space:nowrap;letter-spacing:.04em}.dg-ro.sm{font-size:12.5px;padding:2px 7px}
.dg-cc{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid var(--ln);border-radius:8px;background:var(--bg);margin-bottom:6px}
.dg-cct b{display:block;line-height:1.25;margin-bottom:3px}.dg-cca{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.dg-cca button{margin:0}
.dg-sugrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--mut);margin-bottom:8px}.dg-sugrow button{margin:0}
.dg-sugs{display:grid;gap:6px;margin:6px 0 4px}
.dg-sug{text-align:left;border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 12%,var(--sf));border-radius:8px;padding:9px 12px;margin:0}.dg-sug small{display:block;color:var(--mut);font-weight:500}
.dg-gl{display:block;margin:12px 0 5px;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:600}
.dg-chips{display:flex;gap:6px;flex-wrap:wrap}
.dg-chip{border:1px solid var(--ln);background:var(--sf);border-radius:99px;padding:7px 12px;margin:0;font-weight:500;font-size:14px}
.dg-chip[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}.dg-chip[aria-pressed="true"]::before{content:"✓ "}
.dg-next{position:sticky;bottom:calc(8px + env(safe-area-inset-bottom,0px));margin-right:72px!important;z-index:5;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:var(--sf);border:1px solid var(--ln);border-radius:12px;padding:10px 12px;margin:12px 0 4px;box-shadow:0 6px 22px rgba(0,0,0,.18)}
.dg-next span{flex:1 1 160px;font-size:13px}.dg-next button{margin:0;padding:10px 16px}
.dg-sum{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.dg-sum button{margin:0}
.dg-tg{font-size:13px;padding:3px 9px;border-radius:99px;border:1px solid var(--ln);background:var(--sf)}
.dg-fast{border:2px solid var(--hi);background:color-mix(in srgb,var(--hi) 9%,var(--sf))}
.dg-case{display:grid;gap:4px;background:var(--sf);border:1px solid var(--ln);border-radius:8px;padding:10px 12px;margin-top:8px}.dg-case small{color:var(--mut);font-size:13px}.dg-case button{margin:4px 0 0}
.dg-ct{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.dg-ct b{font-size:16px}
.dg-n{font:600 12px Barlow,sans-serif;padding:2px 8px;border-radius:99px;background:var(--ink);color:var(--bg);white-space:nowrap}
.dg-causes{list-style:none;margin:0;padding:0;display:grid;gap:6px;counter-reset:c}
.dg-causes li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--ln);border-radius:8px;background:var(--bg);counter-increment:c}
.dg-causes li::before{content:counter(c);font:600 15px "Barlow Condensed",sans-serif;color:var(--mut);width:1.2em;text-align:right}
.dg-causes li.hist{border-color:var(--hi);background:color-mix(in srgb,var(--hi) 10%,var(--sf))}
.dg-causes small{display:block;color:var(--mut);font-size:12px}.dg-causes i{display:block;height:4px;max-width:200px;border-radius:2px;margin-top:4px;background:linear-gradient(90deg,var(--hi) var(--w),var(--ln) var(--w))}.dg-causes button{margin:0}
.dg-bar{height:6px;border-radius:3px;background:var(--ln);overflow:hidden;margin:0 0 12px}.dg-bar i{display:block;height:100%;background:#2E8B57}
.dg-tc{border:1px solid var(--ln);border-left:5px solid var(--ln);border-radius:10px;padding:11px 12px;margin-bottom:8px;background:var(--bg);display:grid;gap:7px}
.dg-tc.r-ok{border-left-color:#2E8B57}.dg-tc.r-falha{border-left-color:#B4472E;background:color-mix(in srgb,#B4472E 9%,var(--sf))}.dg-tc.r-inc{border-left-color:#C98200}
.dg-tc p{margin:4px 0;font-size:14px}.dg-tc details summary{cursor:pointer;color:var(--ac);font-weight:600;font-size:14px}.dg-tc input{margin:0}.dg-tc>button{justify-self:start;margin:0}
.dg-th{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start}
.dg-eqs{display:flex;gap:4px;flex-wrap:wrap}.dg-eq{font-size:11.5px;font-weight:600;padding:2px 6px;border-radius:4px;border:1px solid var(--ln);background:var(--sf);color:var(--mut);white-space:nowrap}.dg-eq.miss{border-style:dashed;opacity:.7}
.dg-hb{font-size:11.5px;font-weight:700;padding:2px 7px;border-radius:4px;background:var(--hi);color:#15212B;white-space:nowrap}
.dg-seg{display:grid;grid-template-columns:repeat(3,auto);width:fit-content;max-width:100%;border:1px solid var(--ln);border-radius:8px;overflow:hidden}
.dg-seg button{border:0;border-right:1px solid var(--ln);border-radius:0;margin:0;background:var(--sf);padding:8px 14px}.dg-seg button:last-child{border-right:0}
.dg-seg button[aria-pressed="true"][data-r="ok"]{background:#2E8B57;color:#fff}.dg-seg button[aria-pressed="true"][data-r="falha"]{background:#B4472E;color:#fff}.dg-seg button[aria-pressed="true"][data-r="inc"]{background:#C98200;color:#fff}
.dg-tin{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:8px}
.dg-miss summary{cursor:pointer;color:var(--ac);font-weight:600;margin:6px 0 8px}
.dg-ok{border:2px solid #2E8B57;background:color-mix(in srgb,#2E8B57 10%,var(--sf))}
.dg-msg{border-top:6px solid var(--hi)}.dg-msg.warn{border-top-color:#B4472E}.dg-msg ul{margin:0;padding-left:1.2em;display:grid;gap:6px}
.dg-ed{max-width:560px}.dg-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:2px;max-height:240px;overflow:auto;border:1px solid var(--ln);border-radius:8px;padding:4px;background:var(--bg);margin-top:4px}
.dg-pick label{display:flex;gap:8px;align-items:flex-start;margin:0;padding:5px 6px;color:var(--ink);font-size:13.5px}.dg-pick input,.dg-eqlist input{width:auto;margin:2px 0 0;accent-color:#2E8B57}
.dg-eqlist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px}.dg-eqlist label{display:flex;gap:10px;align-items:center;margin:0;padding:9px 12px;border:1px solid var(--ln);border-radius:8px;background:var(--bg);color:var(--ink);font-size:14px}
.dg-how ol{margin:6px 0 0;padding-left:1.2em;display:grid;gap:4px}
.dg-v{font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:nowrap}
.dg-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dg-tools .card{margin:0}.dg-tools .card>b{display:block;font:600 19px "Barlow Condensed",sans-serif;margin-bottom:8px}
.dg-out{border-radius:8px;padding:10px 12px;margin-top:6px;background:var(--bg);border:1px solid var(--ln)}.dg-out b{font:700 19px ui-monospace,Menlo,monospace}.dg-out p{margin:4px 0 0;font-size:14px}
.dg-out.ok{background:color-mix(in srgb,#2E8B57 12%,var(--sf));border-color:transparent}.dg-out.ok>b{color:#2E8B57}
.dg-out.warn{background:color-mix(in srgb,#C98200 13%,var(--sf));border-color:transparent}.dg-out.warn>b{color:#C98200}
.dg-out.bad{background:color-mix(in srgb,#B4472E 12%,var(--sf));border-color:transparent}.dg-out.bad>b{color:#B4472E}
.dg-cyl{display:grid;gap:5px;margin-top:6px}.dg-cyl div{display:grid;grid-template-columns:30px 1fr 48px;gap:8px;align-items:center;font:500 13px ui-monospace,Menlo,monospace}.dg-cyl i{height:12px;border-radius:2px;background:linear-gradient(90deg,var(--c) var(--w),var(--ln) var(--w))}.dg-cyl span:last-child{text-align:right}
@media (max-width:760px){.dg-stp{flex-direction:column;align-items:flex-start;gap:2px}.dg-stp span{font-size:12px}.dg-tin{grid-template-columns:1fr}.dg-tools{grid-template-columns:1fr}.dg-causes li{grid-template-columns:auto minmax(0,1fr)}.dg-causes li button{grid-column:2;justify-self:start}}
`;
const st=document.createElement('style');st.id='dg-css';st.textContent=css;document.head.appendChild(st);

/* ================= LIGAÇÃO COM O GESTOR ================= */
DG.ui=UI;G.DG=DG;G.DGtab=DGtab;G.dgInfo=dgInfo;G.Vdiag=Vdiag;
/* "+ Diagnosticar": depois de criar a O.S., abre direto na aba Diagnóstico */
if(typeof go=='function'){const _go=go;go=function(v,id,tab,f){if(v=='order'&&DG.next){tab=DG.next;DG.next=null}return _go(v,id,tab,f)}}
/* ao trocar de O.S., limpa o que estava digitado */
let _last=null;const _rs=setInterval(()=>{if(S&&S.v=='order'&&S.id!==_last){_last=S.id;UI.code='';UI.sym='';UI.tf='todos'}},400);
})(window);
