document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-cadastro");
    if (form) {
      form.addEventListener("submit", salvarPeca);
    }
  
    const formBusca = document.getElementById("form-busca");
    if (formBusca) {
      formBusca.addEventListener("submit", buscarPeca);
  
      // Mostrar histórico de buscas
      const hist = document.getElementById("historicoBusca");
      const dados = JSON.parse(localStorage.getItem("historicoBusca")) || [];
      if (dados.length > 0 && hist) {
        hist.innerHTML = `<h4>Buscas Recentes:</h4>` + dados.map(item =>
          `<button onclick="preencherBusca('${item}')">${item}</button>`
        ).join(" ");
      }
    }
  
    // Cria banco se não existir
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pecas")) {
        db.createObjectStore("pecas", { keyPath: "id", autoIncrement: true });
      }
    };
  });
  
  // Função de preenchimento rápido no campo de busca
  function preencherBusca(termo) {
    document.getElementById("busca").value = termo;
  }
  
  // Salvar nova peça
  function salvarPeca(event) {
    event.preventDefault();
    const data = new FormData(event.target);
  
    const objeto = {
      fabricante: data.get("fabricante"),
      modelo: data.get("modelo"),
      nome: data.get("nome"),
      localizacao: data.get("localizacao"),
      partnumber: data.get("partnumber"),
      obs: data.get("obs"),
      anotacoes: [], // inicia o array vazio
      foto: null,
    };
  
    const file = data.get("foto");
    if (file && file.size > 0) {
      const reader = new FileReader();
      reader.onload = function () {
        objeto.foto = reader.result;
        salvarNoDB(objeto);
      };
      reader.readAsDataURL(file);
    } else {
      salvarNoDB(objeto);
    }
  }
  
  function salvarNoDB(objeto) {
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readwrite");
      const store = tx.objectStore("pecas");
      store.add(objeto);
      tx.oncomplete = () => {
        alert("Peça salva com sucesso!");
        location.href = "index.html";
      };
    };
  }
  
  // BUSCA por Nome ou PartNumber
  function buscarPeca(event) {
    event.preventDefault();
    const termo = document.getElementById("busca").value.toLowerCase();
    const resultado = document.getElementById("resultado");
  
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const todos = store.getAll();
  
      todos.onsuccess = () => {
        const lista = todos.result;
        const encontrada = lista.find(p =>
          p.nome.toLowerCase().includes(termo) ||
          p.partnumber.toLowerCase().includes(termo)
        );
  
        if (encontrada) {
          salvarHistorico(termo);
          buscarPecaPorId(encontrada.id);
        } else {
          resultado.innerHTML = "<p>Nenhum resultado encontrado.</p>";
          
        }
      };
    };
  }
  
  // Utilitário: salvar no localStorage
  function salvarHistorico(termo) {
    if (!termo) return;
    let historico = JSON.parse(localStorage.getItem("historicoBusca")) || [];
    historico.unshift(termo);
    historico = [...new Set(historico)].slice(0, 5);
    localStorage.setItem("historicoBusca", JSON.stringify(historico));
  }
  
  function buscarPecaPorId(id) {
    const container = document.getElementById("resultado");
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const get = store.get(id);
  
      get.onsuccess = () => {
        const peca = get.result;
        if (!peca || !container) return;
  
        const favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
        const favoritoAtivo = favoritos.includes(peca.id);
  
        container.innerHTML = `
          <h3>${peca.nome} ${favoritoAtivo ? '⭐' : ''}</h3>
          <p><strong>Fabricante:</strong> ${peca.fabricante}</p>
          <p><strong>Modelo:</strong> ${peca.modelo}</p>
          <p><strong>Localização:</strong> ${peca.localizacao}</p>
          <p><strong>Part Number:</strong> ${peca.partnumber}</p>
          <p><strong>Observações:</strong> ${peca.obs || 'Nenhuma'}</p>
          ${peca.foto ? `<img src="${peca.foto}" alt="Foto da peça" style="max-width:100%;border-radius:8px;margin-top:10px;">` : ''}
          <div style="margin-top: 10px;">
            <button class="btn-acao" onclick="alternarFavorito(${peca.id})" id="btn-fav-${peca.id}">
              <img src="icons/${favoritoAtivo ? 'star.svg' : 'star-outline.svg'}" alt="Favorito" style="width:20px; vertical-align:middle; margin-right:5px;" />
              ${favoritoAtivo ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
            </button>
            <a href="editar.html?id=${peca.id}" class="btn-acao">✏️ Editar</a>
            <button class="btn-acao excluir" onclick="excluirPeca(${peca.id})">🗑️ Excluir</button>
            <button class="btn-acao" onclick="gerarPDF(${peca.id})">📄 PDF</button>
          </div>
          <hr>
        <h4>Anotações Técnicas</h4>
        <ul id="lista-anotacoes">
        ${peca.anotacoes?.map((a, i) => `<li>
            ${a.texto} <small style="color:gray;">(${a.data})</small>
            <button onclick="excluirAnotacao(${peca.id}, ${i})" style="font-size:0.8rem;">🗑️</button>
        </li>`).join("") || "<li>Nenhuma anotação registrada.</li>"}
        </ul>

        <form onsubmit="adicionarAnotacao(event, ${peca.id})" style="margin-top:1rem;">
        <input type="text" id="nova-anotacao" placeholder="Escreva a observação..." required />
        <button type="submit" class="btn-acao">💬 Adicionar</button>
        </form>

        `;
      };
    };
  }
  
  
  
  function alternarFavorito(id) {
    let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
    const btn = document.getElementById(`btn-fav-${id}`);
    const isFavorito = favoritos.includes(id);
  
    if (isFavorito) {
      favoritos = favoritos.filter(fav => fav !== id);
    } else {
      favoritos.push(id);
    }
  
    localStorage.setItem("favoritos", JSON.stringify(favoritos));
  
    // Atualiza visual do botão (se existir na página)
    if (btn) {
      const novoIcone = isFavorito ? 'star-outline.svg' : 'star.svg';
      const novoTexto = isFavorito ? 'Adicionar aos Favoritos' : 'Remover dos Favoritos';
      btn.innerHTML = `<img src="icons/${novoIcone}" alt="Favorito" style="width:20px; vertical-align:middle; margin-right:5px;" /> ${novoTexto}`;
    }
  }
  
  
  function limparBusca() {
    document.getElementById("busca").value = "";
    document.getElementById("resultado").innerHTML = "";
  }
  document.addEventListener("DOMContentLoaded", () => {
    const formEdit = document.getElementById("form-editar");
    if (formEdit) {
      const params = new URLSearchParams(window.location.search);
      const id = Number(params.get("id"));
      carregarParaEdicao(id);
  
      formEdit.addEventListener("submit", function (e) {
        e.preventDefault();
        const data = new FormData(formEdit);
        const objeto = {
          id: id,
          fabricante: data.get("fabricante"),
          modelo: data.get("modelo"),
          nome: data.get("nome"),
          localizacao: data.get("localizacao"),
          partnumber: data.get("partnumber"),
          obs: data.get("obs"),
          foto: null
        };
  
        const file = data.get("foto");
        if (file && file.size > 0) {
          const reader = new FileReader();
          reader.onload = function () {
            objeto.foto = reader.result;
            atualizarNoDB(objeto);
          };
          reader.readAsDataURL(file);
        } else {
          objeto.foto = localStorage.getItem("fotoTemp") || null;
          atualizarNoDB(objeto);
        }
        if (document.getElementById("filtroFabricante")) {
            carregarFiltros();
          }
          
      });
    }
  });
  
  function carregarParaEdicao(id) {
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const get = store.get(id);
      get.onsuccess = () => {
        const p = get.result;
        if (!p) return;
  
        localStorage.setItem("fotoTemp", p.foto || "");
  
        document.getElementById("edit-id").value = p.id;
        document.getElementById("edit-fabricante").value = p.fabricante;
        document.getElementById("edit-modelo").value = p.modelo;
        document.getElementById("edit-nome").value = p.nome;
        document.getElementById("edit-localizacao").value = p.localizacao;
        document.getElementById("edit-partnumber").value = p.partnumber;
        document.getElementById("edit-obs").value = p.obs;
      };
    };
  }
  
  function atualizarNoDB(objeto) {
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readwrite");
      const store = tx.objectStore("pecas");
      store.put(objeto);
      tx.oncomplete = () => {
        localStorage.removeItem("fotoTemp");
        alert("Peça atualizada com sucesso!");
        location.href = "index.html";
      };
    };
  }
  function excluirPeca(id) {
    if (!confirm("Tem certeza que deseja excluir esta peça?")) return;
  
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readwrite");
      const store = tx.objectStore("pecas");
      store.delete(id);
      tx.oncomplete = () => {
        alert("Peça excluída com sucesso!");
        location.href = "index.html";
      };
    };
  }
  function exportarJSON() {
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const getAll = store.getAll();
  
      getAll.onsuccess = () => {
        const dados = JSON.stringify(getAll.result, null, 2);
        const blob = new Blob([dados], { type: "application/json" });
        const url = URL.createObjectURL(blob);
  
        const a = document.createElement("a");
        a.href = url;
        a.download = "pecas_backup.json";
        a.click();
  
        URL.revokeObjectURL(url);
      };
    };
  }
  
  function importarJSON() {
    const input = document.getElementById("importarArquivo");
    const arquivo = input.files[0];
    if (!arquivo) {
      alert("Selecione um arquivo JSON para importar.");
      return;
    }
  
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const dados = JSON.parse(reader.result);
        const request = indexedDB.open("GuiaRapidoDB", 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("pecas", "readwrite");
          const store = tx.objectStore("pecas");
  
          dados.forEach(item => {
            delete item.id; // remove ID para evitar conflito
            store.add(item);
          });
  
          tx.oncomplete = () => {
            alert("Importação concluída com sucesso!");
            location.reload();
          };
        };
      } catch (e) {
        alert("Erro ao importar JSON. Verifique o arquivo.");
      }
    };
    reader.readAsText(arquivo);
  }
  function lerFoto() {
    const arquivo = document.getElementById("imagemFoto").files[0];
    if (!arquivo) {
      alert("Escolha uma imagem para continuar.");
      return;
    }
  
    const resultadoOCR = document.getElementById("ocrResultado");
    resultadoOCR.innerHTML = "Lendo imagem... Aguarde.";
  
    Tesseract.recognize(arquivo, 'eng', {
      logger: m => {
        resultadoOCR.innerHTML = `Processando imagem... ${Math.round(m.progress * 100)}%`;
      }
    }).then(({ data: { text } }) => {
      resultadoOCR.innerHTML = `<strong>Texto lido:</strong><br><pre>${text}</pre>`;
      const termo = text.trim().split(/\s+/)[0]; // Pega primeira palavra como PartNumber
      if (termo.length >= 3) {
        buscarPorPartNumber(termo);
      } else {
        resultado.innerHTML = "<p>Texto muito curto para buscar. Tente novamente.</p>";
      }
    });
  }
  
  function buscarPorPartNumber(partnumberOCR) {
    const resultado = document.getElementById("resultado");
    const termo = partnumberOCR.toLowerCase();
  
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const getAll = store.getAll();
  
      getAll.onsuccess = () => {
        const lista = getAll.result;
        const encontrada = lista.find(p =>
          p.partnumber.toLowerCase().includes(termo)
        );
  
        if (encontrada) {
          buscarPecaPorId(encontrada.id);
        } else {
          resultado.innerHTML = "<p>Part Number não encontrado.</p>";
        }
      };
    };
  }
  async function gerarPDF(id) {
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const get = store.get(id);
  
      get.onsuccess = async () => {
        const p = get.result;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
  
        doc.setFontSize(18);
        doc.text("Ficha Técnica da Peça – Guia Rápido", 14, 20);
  
        doc.setFontSize(12);
        doc.autoTable({
          startY: 30,
          theme: 'grid',
          styles: { fontSize: 11 },
          head: [['Campo', 'Valor']],
          body: [
            ['Nome', p.nome],
            ['Fabricante', p.fabricante],
            ['Modelo', p.modelo],
            ['Localização', p.localizacao],
            ['Part Number', p.partnumber],
            ['Observações', p.obs || 'Nenhuma']
          ]
        });
  
        let alturaAtual = doc.previousAutoTable.finalY + 10;
  
        // Se tiver imagem
        if (p.foto) {
          const img = await carregarImagemBase64(p.foto);
          doc.text("Imagem da Peça:", 14, alturaAtual);
          alturaAtual += 5;
          doc.addImage(img, 'JPEG', 14, alturaAtual, 60, 60);
          alturaAtual += 65;
        }
  
        // Se tiver anotações técnicas
        if (p.anotacoes && p.anotacoes.length > 0) {
          doc.setFontSize(14);
          doc.text("Anotações Técnicas:", 14, alturaAtual);
          alturaAtual += 6;
  
          doc.setFontSize(11);
          p.anotacoes.forEach((a, i) => {
            const texto = `• ${a.texto} (${a.data})`;
            doc.text(texto, 14, alturaAtual);
            alturaAtual += 6;
          });
        } else {
          doc.setFontSize(12);
          doc.text("Sem anotações técnicas registradas.", 14, alturaAtual);
        }
  
        doc.save(`peca_${p.nome.replace(/\s+/g, "_")}.pdf`);
      };
    };
  }
  
  
  function carregarImagemBase64(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      };
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    const lista = document.getElementById("listaFavoritos");
    if (lista) {
      carregarFavoritos(lista);
    }
  });
  
  function carregarFavoritos(container) {
    const favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
    if (favoritos.length === 0) {
      container.innerHTML = "<p>Nenhuma peça foi marcada como favorita ainda.</p>";
      return;
    }
  
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const getAll = store.getAll();
  
      getAll.onsuccess = () => {
        const todas = getAll.result;
        const favoritas = todas.filter(p => favoritos.includes(p.id));
        if (favoritas.length === 0) {
          container.innerHTML = "<p>Nenhuma peça favorita encontrada.</p>";
          return;
        }
  
        container.innerHTML = favoritas.map(p => `
          <div class="card" style="margin-bottom:1rem;">
            <h3>${p.nome} ⭐</h3>
            <p><strong>Modelo:</strong> ${p.modelo}</p>
            <p><strong>Part Number:</strong> ${p.partnumber}</p>
            <button class="btn-acao" onclick="exibirFavorito(${p.id})">🔍 Ver</button>
            <a href="editar.html?id=${p.id}" class="btn-acao">✏️ Editar</a>
            <button class="btn-acao excluir" onclick="excluirPeca(${p.id})">🗑️ Excluir</button>
          </div>
        `).join("");
      };
    };
  }
  function exibirFavorito(id) {
    const area = document.getElementById("resultado");
    if (!area) {
      alert("Elemento de resultado não encontrado.");
      return;
    }
    area.innerHTML = ""; // Limpa antes de mostrar
    buscarPecaPorId(id);
  }
  function adicionarAnotacao(e, id) {
    e.preventDefault();
    const input = document.getElementById("nova-anotacao");
    const texto = input.value.trim();
    if (!texto) return;
  
    const nova = {
      texto,
      data: new Date().toLocaleString()
    };
  
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readwrite");
      const store = tx.objectStore("pecas");
      const get = store.get(id);
  
      get.onsuccess = () => {
        const p = get.result;
        p.anotacoes = p.anotacoes || [];
        p.anotacoes.push(nova);
        store.put(p);
  
        tx.oncomplete = () => {
          buscarPecaPorId(id);
        };
      };
    };
  }
  
  function excluirAnotacao(id, index) {
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readwrite");
      const store = tx.objectStore("pecas");
      const get = store.get(id);
  
      get.onsuccess = () => {
        const p = get.result;
        if (p.anotacoes && p.anotacoes[index]) {
          p.anotacoes.splice(index, 1);
          store.put(p);
        }
  
        tx.oncomplete = () => {
          buscarPecaPorId(id);
        };
      };
    };
  }
  function carregarFiltros() {
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const getAll = store.getAll();
  
      getAll.onsuccess = () => {
        const pecas = getAll.result;
  
        const fabricantes = [...new Set(pecas.map(p => p.fabricante).filter(Boolean))];
        const modelos = [...new Set(pecas.map(p => p.modelo).filter(Boolean))];
        const locais = [...new Set(pecas.map(p => p.localizacao).filter(Boolean))];
  
        preencherSelect("filtroFabricante", fabricantes);
        preencherSelect("filtroModelo", modelos);
        preencherSelect("filtroLocalizacao", locais);
      };
    };
  }
  
  function preencherSelect(id, opcoes) {
    const select = document.getElementById(id);
    opcoes.forEach(op => {
      const option = document.createElement("option");
      option.value = op;
      option.textContent = op;
      select.appendChild(option);
    });
  }
  
  function filtrarPecas() {
    const fab = document.getElementById("filtroFabricante").value.trim().toLowerCase();
    const mod = document.getElementById("filtroModelo").value.trim().toLowerCase();
    const loc = document.getElementById("filtroLocalizacao").value.trim().toLowerCase();
  
    const container = document.getElementById("filtroResultados");
    container.innerHTML = "Carregando...";
  
    const request = indexedDB.open("GuiaRapidoDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("pecas", "readonly");
      const store = tx.objectStore("pecas");
      const getAll = store.getAll();
  
      getAll.onsuccess = () => {
        const pecas = getAll.result.filter(p => {
          const pfab = (p.fabricante || "").toLowerCase();
          const pmod = (p.modelo || "").toLowerCase();
          const ploc = (p.localizacao || "").toLowerCase();
  
          return (!fab || pfab === fab) &&
                 (!mod || pmod === mod) &&
                 (!loc || ploc === loc);
        });
  
        if (pecas.length === 0) {
          container.innerHTML = "<p>Nenhuma peça encontrada com esse filtro.</p>";
          return;
        }
        const contador = document.getElementById("contadorResultados");
        if (contador) {
        contador.innerHTML = `🔎 <strong>${pecas.length}</strong> peça${pecas.length !== 1 ? 's' : ''} encontrada${pecas.length !== 1 ? 's' : ''}`;
        }

        container.innerHTML = pecas.map(p => `
            <div class="card" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
              ${p.foto ? `<img src="${p.foto}" alt="Foto" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">` : '<div style="width:80px; height:80px; background:#ccc; border-radius:8px;"></div>'}
              <div style="flex: 1;">
                <h3 style="margin: 0;">${p.nome || 'Peça sem nome'}</h3>
                <p style="margin: 0.2rem 0;"><strong>Modelo:</strong> ${p.modelo || '---'}</p>
                <p style="margin: 0.2rem 0;"><strong>Part Number:</strong> ${p.partnumber || '---'}</p>
              </div>
              <div>
                <button class="btn-acao" onclick="buscarPecaPorId(${p.id})">🔍 Ver</button>
              </div>
            </div>
          `).join("");
          
      };
    };
  }
  
  function limparFiltros() {
    document.getElementById("filtroFabricante").value = "";
    document.getElementById("filtroModelo").value = "";
    document.getElementById("filtroLocalizacao").value = "";
  
    const resultados = document.getElementById("filtroResultados");
    const contador = document.getElementById("contadorResultados");
  
    if (resultados) resultados.innerHTML = "";
    if (contador) contador.innerHTML = "";
  }
  