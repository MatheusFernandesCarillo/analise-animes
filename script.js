let dadosCompletos = [];
let dadosFiltrados = [];

document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
});

async function carregarDados() {
    mostrarLoading(true);
    
    try {
        const response = await fetch('https://matheusfernandescarillo.github.io/analise-animes/animes_limpo.csv');
        
 
        if (!response.ok) throw new Error('Não foi possível carregar os dados');
        
        const csvText = await response.text();
        dadosCompletos = processarCSV(csvText);
        dadosFiltrados = [...dadosCompletos];
        
        prepararFiltros();
        atualizarDashboard();
        mostrarLoading(false);
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        await carregarDadosLocalmente();
    }
}

async function carregarDadosLocalmente() {
    try {
        const response = await fetch('./data/animes_limpo.csv');
        if (response.ok) {
            const csvText = await response.text();
            dadosCompletos = processarCSV(csvText);
            dadosFiltrados = [...dadosCompletos];
            prepararFiltros();
            atualizarDashboard();
        }
    } catch (localError) {
        alert('Erro ao carregar dados. Tente recarregar a página mais tarde.');
    } finally {
        mostrarLoading(false);
    }
}

function processarCSV(csvText) {
    const linhas = csvText.split('\n').filter(linha => linha.trim());
    
    if (linhas.length < 2) return [];
    
    const cabecalho = linhas[0].split(',').map(h => h.trim());
    const dados = [];
    
    for (let i = 1; i < linhas.length; i++) {
        try {
            const linha = linhas[i];
            if (linha.includes('Present (Music')) continue;
            
            const valores = processarLinhaCSV(linha);
            const anime = {};
            
            cabecalho.forEach((coluna, index) => {
                let valor = valores[index] || '';
                valor = valor.trim().replace(/^['"]|['"]$/g, '');
                
                if (['Nota', 'Avaliado por', 'Episodio'].includes(coluna)) {
                    anime[coluna] = parseFloat(valor) || 0;
                } else if (coluna === 'Data de Exibição') {
                    const data = new Date(valor);
                    anime['Ano'] = data.getFullYear() || 2000;
                } else if (coluna === 'Genero' || coluna === 'Estudio') {
                    if (valor.startsWith('[') && valor.endsWith(']')) {
                        try {
                            const valorLimpo = valor.slice(1, -1);
                            anime[coluna] = valorLimpo.split(',').map(item => 
                                item.trim().replace(/'/g, '').replace(/"/g, '')
                            ).filter(item => item && item !== 'null' && item !== 'undefined');
                        } catch {
                            anime[coluna] = valor ? [valor] : [];
                        }
                    } else {
                        anime[coluna] = valor ? [valor] : [];
                    }
                } else {
                    anime[coluna] = valor;
                }
            });
            
            if (anime.Nome && anime.Nome.trim() !== '') {
                if (!anime.Ano || anime.Ano < 1900) anime.Ano = 2000;
                dados.push(anime);
            }
            
        } catch (e) {
            continue;
        }
    }
    
    return dados;
}

function processarLinhaCSV(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

function prepararFiltros() {
    $('.filter-select').select2({
        placeholder: 'Selecione...',
        allowClear: true,
        width: '100%'
    });
    
    const anos = [...new Set(dadosCompletos.map(d => d.Ano))].filter(ano => ano > 1960 && ano < 2030).sort();
    $('#ano-select').empty().append(anos.map(ano => new Option(ano, ano)));
    
    const todosGeneros = [];
    dadosCompletos.forEach(anime => {
        if (anime.Genero && Array.isArray(anime.Genero)) {
            anime.Genero.forEach(genero => {
                if (genero && genero !== 'null' && genero !== 'undefined' && genero.trim() !== '' && 
                    !genero.includes('Status') && !genero.includes('Source') && genero.length > 1) {
                    todosGeneros.push(genero);
                }
            });
        }
    });
    
    const generos = [...new Set(todosGeneros)].sort();
    $('#genero-select').empty().append(generos.map(g => new Option(g, g)));
    
    const todosEstudios = [];
    dadosCompletos.forEach(anime => {
        if (anime.Estudio && Array.isArray(anime.Estudio)) {
            anime.Estudio.forEach(estudio => {
                if (estudio && 
                    estudio !== 'null' && 
                    estudio !== 'undefined' && 
                    estudio.trim() !== '' && 
                    !estudio.includes('Status') && 
                    !estudio.includes('Finish') &&
                    !estudio.includes('Airing') &&
                    estudio.length > 2 &&
                    !estudio.match(/^\d+$/)
                ) {
                    todosEstudios.push(estudio);
                }
            });
        }
    });
    
    const estudios = [...new Set(todosEstudios)].sort();
    $('#estudio-select').empty().append(estudios.map(e => new Option(e, e)));
    
    $('.filter-select').trigger('change');
}

function aplicarFiltros() {
    const anos = $('#ano-select').val() || [];
    const generos = $('#genero-select').val() || [];
    const estudios = $('#estudio-select').val() || [];

    dadosFiltrados = dadosCompletos.filter(anime => {
        const anoMatch = !anos.length || anos.includes(anime.Ano.toString());
        
        const generosAnime = Array.isArray(anime.Genero) ? anime.Genero : [anime.Genero];
        const generoMatch = !generos.length || generos.some(g => generosAnime.includes(g));
        
        const estudiosAnime = Array.isArray(anime.Estudio) ? anime.Estudio : [anime.Estudio];
        const estudioMatch = !estudios.length || estudios.some(e => estudiosAnime.includes(e));
        
        return anoMatch && generoMatch && estudioMatch;
    });

    atualizarDashboard();
}

function atualizarDashboard() {
    const metrica = $('#metrica-select').val();
    $('#metrica-atual').text(`Métrica: ${getNomeMetrica(metrica)}`);
    
    atualizarMetricas();
    atualizarGraficos(metrica);
    atualizarTabela();
}

function atualizarMetricas() {
    const dados = dadosFiltrados.length ? dadosFiltrados : dadosCompletos;
    
    if (dados.length === 0) {
        $('#metric-ano').text('-');
        $('#metric-nota').text('-');
        $('#metric-genero').text('-');
        $('#metric-estudio').text('-');
        return;
    }
    
    const contagemAno = {};
    dados.forEach(a => { 
        if (a.Ano) contagemAno[a.Ano] = (contagemAno[a.Ano] || 0) + 1; 
    });
    const anoTop = Object.entries(contagemAno).reduce((a, b) => a[1] > b[1] ? a : b, ['-', 0]);
    $('#metric-ano').text(anoTop[0]);
    
    const animesComNota = dados.filter(a => a.Nota && a.Nota > 0);
    const notaMedia = animesComNota.length > 0 ? 
        animesComNota.reduce((s, a) => s + a.Nota, 0) / animesComNota.length : 0;
    $('#metric-nota').text(notaMedia.toFixed(2));
    
    const contagemGenero = {};
    dados.forEach(anime => {
        if (anime.Genero && Array.isArray(anime.Genero)) {
            anime.Genero.forEach(genero => {
                if (genero && 
                    genero !== 'null' && 
                    genero !== 'undefined' && 
                    genero.trim() !== '' && 
                    !genero.includes('Status') && 
                    !genero.includes('Source') &&
                    genero.length > 2) {
                    contagemGenero[genero] = (contagemGenero[genero] || 0) + 1;
                }
            });
        }
    });
    
    const generoTop = Object.entries(contagemGenero).reduce((a, b) => a[1] > b[1] ? a : b, ['-', 0]);
    $('#metric-genero').text(generoTop[0]);
    
    const contagemEstudio = {};
    dados.forEach(anime => {
        if (anime.Estudio && Array.isArray(anime.Estudio)) {
            anime.Estudio.forEach(estudio => {
                if (estudio && 
                    estudio !== 'null' && 
                    estudio !== 'undefined' && 
                    estudio.trim() !== '' && 
                    !estudio.includes('Status') && 
                    !estudio.includes('Finish') &&
                    !estudio.includes('Airing') &&
                    estudio.length > 2 &&
                    !estudio.match(/^\d+$/)
                ) {
                    contagemEstudio[estudio] = (contagemEstudio[estudio] || 0) + 1;
                }
            });
        }
    });
    
    const estudioTop = Object.entries(contagemEstudio).reduce((a, b) => a[1] > b[1] ? a : b, ['-', 0]);
    $('#metric-estudio').text(estudioTop[0]);
}

function atualizarGraficos(metrica) {
    const dados = dadosFiltrados.length ? dadosFiltrados : dadosCompletos;
    
    if (dados.length === 0) {
        document.getElementById('chart-estudio').innerHTML = '<div class="no-data">Nenhum dado disponível</div>';
        document.getElementById('chart-ano').innerHTML = '<div class="no-data">Nenhum dado disponível</div>';
        document.getElementById('chart-top-animes').innerHTML = '<div class="no-data">Nenhum dado disponível</div>';
        document.getElementById('chart-comparacao-genero').innerHTML = '<div class="no-data">Nenhum dado disponível</div>';
        document.getElementById('chart-evolucao-genero').innerHTML = '<div class="no-data">Nenhum dado disponível</div>';
        document.getElementById('chart-comparacao-metricas').innerHTML = '<div class="no-data">Nenhum dado disponível</div>';
        return;
    }
    
    const estudiosData = {};
    let estudiosValidos = 0;

    dados.forEach(anime => {
        if (anime.Estudio && Array.isArray(anime.Estudio) && anime.Nota && anime.Nota > 0) {
            anime.Estudio.forEach(estudio => {
                if (estudio && 
                    typeof estudio === 'string' && 
                    estudio.trim() !== '' && 
                    !estudio.includes('Status') && 
                    !estudio.includes('Finish') &&
                    !estudio.includes('Airing') &&
                    estudio.length > 2 &&
                    !estudio.match(/^\d+$/)
                ) {
                    if (!estudiosData[estudio]) {
                        estudiosData[estudio] = { totalNota: 0, count: 0 };
                    }
                    estudiosData[estudio].totalNota += anime.Nota;
                    estudiosData[estudio].count += 1;
                    estudiosValidos++;
                }
            });
        }
    });

    const topEstudios = Object.entries(estudiosData)
        .filter(([estudio, data]) => data.count >= 3)
        .map(([estudio, data]) => ({
            estudio: estudio,
            media: data.totalNota / data.count,
            quantidade: data.count
        }))
        .sort((a, b) => b.media - a.media)
        .slice(0, 10);

    if (topEstudios.length > 0) {
        const traceEstudios = {
            x: topEstudios.map(e => e.estudio),
            y: topEstudios.map(e => e.media),
            type: 'bar',
            marker: { 
                color: '#FF6B6B',
                opacity: 0.9
            },
            hovertemplate: 
                '<b>%{x}</b><br>' +
                'Nota Média: %{y:.2f}<br>' +
                'Quantidade de Animes: %{customdata}<br>' +
                '<extra></extra>',
            customdata: topEstudios.map(e => e.quantidade)
        };

        const layoutEstudios = {
            title: {
                text: '🎬 TOP 10 ESTÚDIOS - NOTA MÉDIA',
                font: { size: 16, color: '#f0f0f0' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#f0f0f0', size: 12 },
            xaxis: { 
                title: 'Estúdio',
                tickangle: -45,
                gridcolor: '#374151',
                tickfont: { size: 10 }
            },
            yaxis: { 
                title: 'Nota Média', 
                gridcolor: '#374151', 
                range: [0, 10],
                tickformat: '.2f'
            },
            margin: { t: 60, r: 30, b: 100, l: 80 }
        };

        Plotly.react('chart-estudio', [traceEstudios], layoutEstudios);
    } else {
        document.getElementById('chart-estudio').innerHTML = `
            <div class="no-data">
                <h3>🎬 Estúdios</h3>
                <p>Nenhum estúdio com dados suficientes encontrado</p>
            </div>
        `;
    }

    const anosData = {};
    
    dados.forEach(anime => {
        if (anime.Ano && anime.Nota && anime.Nota > 0) {
            if (!anosData[anime.Ano]) {
                anosData[anime.Ano] = { totalNota: 0, count: 0 };
            }
            anosData[anime.Ano].totalNota += anime.Nota;
            anosData[anime.Ano].count += 1;
        }
    });

    const anosOrdenados = Object.entries(anosData)
        .map(([ano, data]) => ({ 
            ano: parseInt(ano), 
            media: data.totalNota / data.count,
            quantidade: data.count
        }))
        .sort((a, b) => a.ano - b.ano)
        .filter(a => a.quantidade >= 5);

    if (anosOrdenados.length > 0) {
        const todasNotas = anosOrdenados.map(a => a.media);
        const notaMin = Math.min(...todasNotas);
        const notaMax = Math.max(...todasNotas);
        const rangeMin = Math.max(0, notaMin - 0.3);
        const rangeMax = Math.min(10, notaMax + 0.3);

        const traceAnos = {
            x: anosOrdenados.map(a => a.ano),
            y: anosOrdenados.map(a => a.media),
            type: 'scatter',
            mode: 'lines+markers',
            line: { 
                color: '#bb86fc', 
                width: 3,
                shape: 'spline'
            },
            marker: { 
                color: '#bb86fc', 
                size: 8,
                line: { color: '#ffffff', width: 1 }
            },
            text: anosOrdenados.map(a => `Ano: ${a.ano}<br>Média: ${a.media.toFixed(2)}<br>Animes: ${a.quantidade}`),
            hoverinfo: 'text'
        };

        const layoutAnos = {
            title: {
                text: '📅 Evolução da Nota Média por Ano',
                font: { size: 16, color: '#f0f0f0' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#f0f0f0' },
            xaxis: { 
                title: 'Ano', 
                gridcolor: '#374151',
                tickmode: 'linear',
                dtick: 5
            },
            yaxis: { 
                title: 'Nota Média', 
                gridcolor: '#374151', 
                range: [rangeMin, rangeMax],
                tickformat: '.2f'
            },
            margin: { t: 60, r: 30, b: 60, l: 80 }
        };

        Plotly.react('chart-ano', [traceAnos], layoutAnos);
    } else {
        document.getElementById('chart-ano').innerHTML = '<div class="no-data">Nenhum dado de ano disponível</div>';
    }

    const generosData = {};

    dados.forEach(anime => {
        if (anime.Genero && Array.isArray(anime.Genero)) {
            anime.Genero.forEach(genero => {
                if (genero && 
                    genero !== 'null' && 
                    genero !== 'undefined' && 
                    genero.trim() !== '' && 
                    !genero.includes('Status') && 
                    !genero.includes('Source') &&
                    genero.length > 2) {
                    
                    if (!generosData[genero]) {
                        generosData[genero] = { totalNota: 0, count: 0, totalAvaliadores: 0 };
                    }
                    generosData[genero].totalNota += anime.Nota;
                    generosData[genero].count += 1;
                    generosData[genero].totalAvaliadores += anime['Avaliado por'];
                }
            });
        }
    });

    const topGeneros = Object.entries(generosData)
        .filter(([_, data]) => data.count >= 5)
        .map(([genero, data]) => ({
            genero: genero,
            quantidade: data.count,
            media: data.totalNota / data.count,
            popularidade: data.totalAvaliadores
        }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 15);

    if (topGeneros.length > 0) {
        const traceGenero = {
            y: topGeneros.map(g => g.genero),
            x: topGeneros.map(g => g.quantidade),
            type: 'bar',
            orientation: 'h',
            marker: { 
                color: topGeneros.map(g => {
                    const qtd = g.quantidade;
                    if (qtd >= 1000) return '#4CAF50';
                    if (qtd >= 500) return '#8BC34A';
                    if (qtd >= 200) return '#FFC107';
                    if (qtd >= 100) return '#FF9800';
                    return '#FF5722';
                }),
                opacity: 0.8
            },
            hovertemplate: 
                '<b>%{y}</b><br>' +
                'Quantidade: %{x} animes<br>' +
                'Nota Média: %{customdata:.2f}<br>' +
                '<extra></extra>',
            customdata: topGeneros.map(g => g.media)
        };

        const layoutGenero = {
            title: {
                text: '📊 Distribuição por Gênero - Top 15',
                font: { size: 16, color: '#f0f0f0' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#f0f0f0', size: 12 },
            xaxis: { 
                title: 'Quantidade de Animes',
                gridcolor: '#374151'
            },
            yaxis: { 
                title: '',
                gridcolor: '#374151',
                automargin: true,
                tickfont: { size: 11 }
            },
            margin: { t: 60, r: 30, b: 60, l: 150 },
            height: 500,
            hoverlabel: {
                bgcolor: 'rgba(30, 30, 30, 0.9)',
                bordercolor: '#bb86fc',
                font: { color: 'white' }
            }
        };

        Plotly.react('chart-comparacao-genero', [traceGenero], layoutGenero);
    } else {
        document.getElementById('chart-comparacao-genero').innerHTML = `
            <div class="no-data">
                <h3>🎭 Distribuição por Gênero</h3>
                <p>Nenhum gênero com dados suficientes encontrado</p>
            </div>
        `;
    }

    const generosPopulares = topGeneros.slice(0, 5).map(g => g.genero);
    const evolucaoGeneros = {};
    
    generosPopulares.forEach(genero => {
        evolucaoGeneros[genero] = {};
    });
    
    dados.forEach(anime => {
        if (anime.Ano && anime.Nota && anime.Nota > 0 && anime.Genero) {
            anime.Genero.forEach(genero => {
                if (generosPopulares.includes(genero)) {
                    if (!evolucaoGeneros[genero][anime.Ano]) {
                        evolucaoGeneros[genero][anime.Ano] = { totalNota: 0, count: 0 };
                    }
                    evolucaoGeneros[genero][anime.Ano].totalNota += anime.Nota;
                    evolucaoGeneros[genero][anime.Ano].count += 1;
                }
            });
        }
    });
    
    const tracesEvolucao = [];
    const cores = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    
    generosPopulares.forEach((genero, index) => {
        const dadosGenero = evolucaoGeneros[genero];
        const anos = Object.keys(dadosGenero).map(ano => parseInt(ano)).sort();
        const medias = anos.map(ano => dadosGenero[ano].totalNota / dadosGenero[ano].count);
        const quantidades = anos.map(ano => dadosGenero[ano].count);
        
        if (anos.length >= 3) {
            const trace = {
                x: anos,
                y: medias,
                type: 'scatter',
                mode: 'lines+markers',
                name: genero,
                line: { 
                    color: cores[index % cores.length],
                    width: 3,
                    shape: 'spline'
                },
                marker: { 
                    color: cores[index % cores.length],
                    size: 6,
                    line: { color: '#ffffff', width: 1 }
                },
                hovertemplate: 
                    `<b>${genero}</b><br>` +
                    'Ano: %{x}<br>' +
                    'Nota Média: %{y:.2f}<br>' +
                    'Animes: %{customdata}<br>' +
                    '<extra></extra>',
                customdata: quantidades
            };
            
            tracesEvolucao.push(trace);
        }
    });
    
    if (tracesEvolucao.length > 0) {
        const todasNotasEvolucao = tracesEvolucao.flatMap(trace => trace.y);
        const notaMinEvolucao = Math.min(...todasNotasEvolucao);
        const notaMaxEvolucao = Math.max(...todasNotasEvolucao);
        const rangeMinEvolucao = Math.max(0, notaMinEvolucao - 0.3);
        const rangeMaxEvolucao = Math.min(10, notaMaxEvolucao + 0.3);
        
        const layoutEvolucao = {
            title: {
                text: '📈 Evolução Temporal - Top 5 Gêneros',
                font: { size: 16, color: '#f0f0f0' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#f0f0f0', size: 12 },
            xaxis: { 
                title: 'Ano',
                gridcolor: '#374151',
                tickmode: 'linear',
                dtick: 5
            },
            yaxis: { 
                title: 'Nota Média',
                gridcolor: '#374151',
                range: [rangeMinEvolucao, rangeMaxEvolucao],
                tickformat: '.2f'
            },
            margin: { t: 60, r: 30, b: 60, l: 80 },
            legend: {
                orientation: 'h',
                y: -0.2,
                x: 0.5,
                xanchor: 'center',
                bgcolor: 'rgba(0,0,0,0.7)',
                bordercolor: '#374151',
                borderwidth: 1
            },
            hoverlabel: {
                bgcolor: 'rgba(30, 30, 30, 0.9)',
                bordercolor: '#bb86fc',
                font: { color: 'white' }
            }
        };

        Plotly.react('chart-evolucao-genero', tracesEvolucao, layoutEvolucao);
    } else {
        document.getElementById('chart-evolucao-genero').innerHTML = `
            <div class="no-data">
                <h3>📈 Evolução Temporal</h3>
                <p>Dados insuficientes para análise temporal</p>
            </div>
        `;
    }

    const generosComparacao = topGeneros.slice(0, 8);
    
    if (generosComparacao.length > 0) {
        const metricasGeneros = generosComparacao.map(genero => ({
            genero: genero.genero,
            notaMedia: genero.media,
            quantidade: genero.quantidade,
            popularidade: genero.popularidade / genero.quantidade,
            densidade: genero.quantidade / dados.length * 100
        }));
        
        const categorias = ['Nota Média', 'Quantidade', 'Popularidade', 'Densidade'];
        
        const notas = metricasGeneros.map(g => g.notaMedia);
        const quantidades = metricasGeneros.map(g => g.quantidade);
        const popularidades = metricasGeneros.map(g => g.popularidade);
        const densidades = metricasGeneros.map(g => g.densidade);
        
        const maxNota = Math.max(...notas);
        const maxQuantidade = Math.max(...quantidades);
        const maxPopularidade = Math.max(...popularidades);
        const maxDensidade = Math.max(...densidades);
        
        const tracesRadar = [];
        const coresRadar = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#87CEEB', '#98FB98'];
        
        metricasGeneros.forEach((genero, index) => {
            const trace = {
                type: 'scatterpolar',
                r: [
                    (genero.notaMedia / maxNota) * 10,
                    (genero.quantidade / maxQuantidade) * 10,
                    (genero.popularidade / maxPopularidade) * 10,
                    (genero.densidade / maxDensidade) * 10
                ],
                theta: categorias,
                fill: 'toself',
                name: genero.genero,
                line: {
                    color: coresRadar[index % coresRadar.length],
                    width: 2
                },
                marker: {
                    color: coresRadar[index % coresRadar.length],
                    size: 4
                },
                hovertemplate: 
                    `<b>${genero.genero}</b><br>` +
                    'Nota Média: %{customdata[0]:.2f}<br>' +
                    'Quantidade: %{customdata[1]} animes<br>' +
                    'Popularidade: %{customdata[2]:.0f} avaliadores/anime<br>' +
                    'Densidade: %{customdata[3]:.1f}%<br>' +
                    '<extra></extra>',
                customdata: [
                    [genero.notaMedia, genero.quantidade, genero.popularidade, genero.densidade]
                ]
            };
            
            tracesRadar.push(trace);
        });
        
        const layoutRadar = {
            title: {
                text: '🔄 Comparação entre Gêneros - Múltiplas Métricas',
                font: { size: 16, color: '#f0f0f0' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#f0f0f0', size: 12 },
            polar: {
                bgcolor: 'rgba(0,0,0,0)',
                radialaxis: {
                    visible: true,
                    range: [0, 10],
                    gridcolor: '#374151',
                    tickfont: { color: '#f0f0f0' }
                },
                angularaxis: {
                    gridcolor: '#374151',
                    tickfont: { color: '#f0f0f0' }
                }
            },
            margin: { t: 60, r: 30, b: 60, l: 80 },
            legend: {
                orientation: 'h',
                y: -0.1,
                x: 0.5,
                xanchor: 'center',
                bgcolor: 'rgba(0,0,0,0.7)',
                bordercolor: '#374151',
                borderwidth: 1,
                font: { color: '#f0f0f0' }
            },
            hoverlabel: {
                bgcolor: 'rgba(30, 30, 30, 0.9)',
                bordercolor: '#bb86fc',
                font: { color: 'white' }
            }
        };

        Plotly.react('chart-comparacao-metricas', tracesRadar, layoutRadar);
    } else {
        document.getElementById('chart-comparacao-metricas').innerHTML = `
            <div class="no-data">
                <h3>🔄 Comparação entre Gêneros</h3>
                <p>Dados insuficientes para comparação</p>
            </div>
        `;
    }

    const topAnimes = dados
        .filter(anime => anime.Nota && anime.Nota > 0 && anime.Nome && anime.Nome.trim() !== '')
        .sort((a, b) => b.Nota - a.Nota)
        .slice(0, 15);

    if (topAnimes.length > 0) {
        const traceTopAnimes = {
            x: topAnimes.map(a => a.Nome.length > 30 ? a.Nome.substring(0, 30) + '...' : a.Nome),
            y: topAnimes.map(a => a.Nota),
            type: 'bar',
            marker: { 
                color: topAnimes.map(a => {
                    if (a.Nota >= 8.5) return '#4CAF50';
                    if (a.Nota >= 7.5) return '#8BC34A';
                    if (a.Nota >= 6.5) return '#FFC107';
                    return '#FF9800';
                }),
                opacity: 0.8
            },
            text: topAnimes.map(a => `Nota: ${a.Nota.toFixed(2)}`),
            hoverinfo: 'text'
        };

        const layoutTopAnimes = {
            title: {
                text: '⭐ Top 15 Animes - Melhores Notas',
                font: { size: 16, color: '#f0f0f0' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#f0f0f0' },
            xaxis: { 
                tickangle: -45, 
                gridcolor: '#374151',
                tickfont: { size: 10 }
            },
            yaxis: { 
                title: 'Nota', 
                gridcolor: '#374151', 
                range: [0, 10],
                tickformat: '.2f'
            },
            margin: { t: 60, r: 30, b: 150, l: 80 }
        };

        Plotly.react('chart-top-animes', [traceTopAnimes], layoutTopAnimes);
    } else {
        document.getElementById('chart-top-animes').innerHTML = '<div class="no-data">Nenhum anime com nota disponível</div>';
    }

    setTimeout(() => {
        ['chart-estudio', 'chart-ano', 'chart-top-animes', 'chart-comparacao-genero', 'chart-evolucao-genero', 'chart-comparacao-metricas'].forEach(containerId => {
            const element = document.getElementById(containerId);
            if (element) {
                Plotly.Plots.resize(element);
            }
        });
    }, 500);
}

function atualizarTabela() {
    const dados = (dadosFiltrados.length ? dadosFiltrados : dadosCompletos)
        .filter(a => a.Nota && a.Nota > 0 && a.Nome && a.Nome.trim() !== '')
        .sort((a, b) => b.Nota - a.Nota)
        .slice(0, 15);
    
    if (dados.length === 0) {
        $('#tabela-dados').html('<div class="no-data">Nenhum dado disponível para exibir</div>');
        return;
    }
    
    const html = `
        <div class="table-info">
            <p>Top ${dados.length} Animes por Nota</p>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Ano</th>
                    <th>Gêneros</th>
                    <th>Nota</th>
                    <th>Avaliado por</th>
                </tr>
            </thead>
            <tbody>
                ${dados.map(anime => `
                    <tr>
                        <td>${anime.Nome || '-'}</td>
                        <td>${anime.Ano || '-'}</td>
                        <td>${Array.isArray(anime.Genero) ? anime.Genero.slice(0, 2).join(', ') : anime.Genero || '-'}</td>
                        <td>${anime.Nota ? anime.Nota.toFixed(2) : '-'}</td>
                        <td>${anime['Avaliado por'] ? anime['Avaliado por'].toLocaleString() : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    $('#tabela-dados').html(html);
}

function getNomeMetrica(metrica) {
    return { 'Nota': 'Nota', 'Avaliado por': 'Popularidade', 'Episodio': 'Episódios' }[metrica] || metrica;
}

function mostrarLoading(mostrar) {
    $('#loading').css('display', mostrar ? 'flex' : 'none');
}

function limparFiltros() {
    $('.filter-select').val(null).trigger('change');
    dadosFiltrados = [...dadosCompletos];
    atualizarDashboard();
}

$('#metrica-select').on('change', atualizarDashboard);
